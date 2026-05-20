import { ApiParseError, ApiValidationError } from "./errors.js";
import type {
  ApiRequestContext,
  ApiRequestOptions,
  OptionalSchema,
  SchemaOutput
} from "./types.js";

// Request parsing
export const parseRequestBody = <
  TRequestSchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  options: ApiRequestOptions<TRequestSchema, TResponseSchema, TResult>,
  context: ApiRequestContext
): unknown => {
  if (options.body === undefined) {
    return undefined;
  }

  if (!options.requestSchema) {
    return options.body;
  }

  const parsedBody = options.requestSchema.safeParse(options.body);

  if (!parsedBody.success) {
    throw new ApiValidationError(
      "request",
      parsedBody.error,
      options.body,
      context
    );
  }

  return parsedBody.data;
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
