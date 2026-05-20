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
  TJsonSchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  options: ApiRequestOptions<TJsonSchema, TResponseSchema, TResult>,
  context: ApiRequestContext
): ParsedRequestBody => {
  const hasJsonBody = "json" in options || options.jsonSchema !== undefined;

  if (hasJsonBody && options.body !== undefined) {
    throw new TypeError("Use either json or body for an API request, not both");
  }

  if (!hasJsonBody) {
    return {
      body      : options.body ?? undefined,
      isJsonBody: false
    };
  }

  const json = parseRequestJson(options, context);

  return {
    body      : JSON.stringify(json),
    isJsonBody: true
  };
};

const parseRequestJson = <
  TJsonSchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  options: ApiRequestOptions<TJsonSchema, TResponseSchema, TResult>,
  context: ApiRequestContext
): unknown => {
  if (!options.jsonSchema) {
    return options.json;
  }

  const parsedJson = options.jsonSchema.safeParse(options.json);

  if (!parsedJson.success) {
    throw new ApiValidationError(
      "request",
      parsedJson.error,
      options.json,
      context
    );
  }

  return parsedJson.data;
};

// Response parsing
export const parseResponseBody = <TResponseSchema extends OptionalSchema>(
  body: unknown,
  schema: TResponseSchema,
  context: ApiRequestContext
): SchemaOutput<TResponseSchema> => {
  if (!schema) {
    return body as SchemaOutput<TResponseSchema>;
  }

  const parsedBody = schema.safeParse(body);

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
