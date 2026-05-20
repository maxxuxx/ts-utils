import { ApiParseError, ApiValidationError } from "./errors.js";
import type {
  ApiRequestContext,
  ApiRequestOptions,
  OptionalSchema,
  SchemaOutput
} from "./types.js";

// Request body parsing
export type ParsedRequestBody = Readonly<{
  body       : RequestInit["body"] | undefined;
  isJsonBody : boolean;
}>;

export const parseRequestBody = <
  TBodySchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  options: ApiRequestOptions<TBodySchema, TResponseSchema, TResult>,
  context: ApiRequestContext
): ParsedRequestBody => {
  const hasJsonBody = "body" in options || options.bodySchema !== undefined;

  if (hasJsonBody && options.rawBody !== undefined) {
    throw new TypeError("Use either body or rawBody for an API request, not both");
  }

  if (!hasJsonBody) {
    return {
      body      : options.rawBody ?? undefined,
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

export const readResponseBody = async (
  response: Response,
  context: ApiRequestContext
): Promise<unknown> => {
  if (response.status === 204 || response.status === 205 || response.status === 304) {
    return undefined;
  }

  const text = await response.text();

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
