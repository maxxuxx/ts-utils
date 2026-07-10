import {
  ApiParseError,
  ApiResponseSizeError,
  ApiValidationError
} from "./errors.js";
import type {
  ApiRequestContext,
  ApiRequestOptions,
  OptionalSchema,
  SchemaOutput
} from "./types.js";

// Request body parsing
/** Represents parsed request body */
export type ParsedRequestBody = Readonly<{
  body       : RequestInit["body"] | undefined;
  isJsonBody : boolean;
}>;

/** Validates and returns an optional response byte limit */
export const validateMaxResponseBytes = (
  limit: number | undefined
): number | undefined => {
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 0)) {
    throw new RangeError("maxResponseBytes must be a non-negative safe integer");
  }

  return limit;
};

/** Parses request body */
export const parseRequestBody = async <
  TBodySchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  options: ApiRequestOptions<TBodySchema, TResponseSchema, TResult>,
  context: ApiRequestContext,
  attempt = 1
): Promise<ParsedRequestBody> => {
  const hasJsonBody = "body" in options || options.bodySchema !== undefined;
  const hasRawBody  = options.rawBody !== undefined;
  const hasFactory  = options.rawBodyFactory !== undefined;

  if ([hasJsonBody, hasRawBody, hasFactory].filter(Boolean).length > 1) {
    throw new TypeError("Use either body, rawBody, or rawBodyFactory for an API request");
  }

  if (!hasJsonBody) {
    return {
      body      : options.rawBodyFactory
        ? await options.rawBodyFactory(attempt)
        : options.rawBody ?? undefined,
      isJsonBody: false
    };
  }

  const body = parseRequestJson(options, context);

  return {
    body      : JSON.stringify(body),
    isJsonBody: true
  };
};

const parseRequestJson = <
  TBodySchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  options: ApiRequestOptions<TBodySchema, TResponseSchema, TResult>,
  context: ApiRequestContext
): unknown => {
  if (!options.bodySchema) {
    return options.body;
  }

  const parsedJson = options.bodySchema.safeParse(options.body);

  if (!parsedJson.success) {
    throw new ApiValidationError(
      "request",
      parsedJson.error,
      options.body,
      context
    );
  }

  return parsedJson.data;
};

// Response parsing
/** Parses response body */
export const parseResponseBody = <TResponseSchema extends OptionalSchema>(
  body: unknown,
  responseSchema: TResponseSchema,
  context: ApiRequestContext
): SchemaOutput<TResponseSchema> => {
  if (!responseSchema) {
    return body as SchemaOutput<TResponseSchema>;
  }

  const parsedBody = responseSchema.safeParse(body);

  if (!parsedBody.success) {
    throw new ApiValidationError(
      "response",
      parsedBody.error,
      body,
      context
    );
  }

  return parsedBody.data as SchemaOutput<TResponseSchema>;
};

/** Reads response body */
export const readResponseBody = async (
  response: Response,
  context: ApiRequestContext,
  maxResponseBytes?: number
): Promise<unknown> => {
  if (response.status === 204 || response.status === 205 || response.status === 304) {
    return undefined;
  }

  const text = maxResponseBytes === undefined
    ? await response.text()
    : await readLimitedResponseText(response, context, maxResponseBytes);

  if (!text) {
    return undefined;
  }

  const contentType     = response.headers.get("Content-Type");
  const trimmedText     = text.trimStart();
  const shouldParseJson = contentType?.includes("application/json") === true
    || trimmedText.startsWith("{")
    || trimmedText.startsWith("[");

  if (!shouldParseJson) {
    return text;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiParseError(response, text, context);
  }
};

const readLimitedResponseText = async (
  response: Response,
  context: ApiRequestContext,
  limit: number
): Promise<string> => {
  validateMaxResponseBytes(limit);

  const contentLength = getContentLength(response.headers.get("Content-Length"));

  if (contentLength !== undefined && contentLength > limit) {
    try {
      await response.body?.cancel();
    } catch {
      // Stream cancellation is best effort and must not replace the size failure
    }

    throw new ApiResponseSizeError(limit, contentLength, context);
  }

  if (!response.body) {
    return "";
  }

  const decoder = new TextDecoder();
  const reader  = response.body.getReader();
  let size      = 0;
  let text      = "";

  try {
    for (;;) {
      const chunk = await reader.read();

      if (chunk.done) {
        return text + decoder.decode();
      }

      size += chunk.value.byteLength;

      if (size > limit) {
        try {
          await reader.cancel();
        } catch {
          // Stream cancellation is best effort and must not replace the size failure
        }

        throw new ApiResponseSizeError(limit, size, context);
      }

      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
};

const getContentLength = (value: string | null): number | undefined => {
  if (!value || !/^\d+$/.test(value.trim())) {
    return undefined;
  }

  const size = Number(value);

  return Number.isSafeInteger(size) ? size : undefined;
};
