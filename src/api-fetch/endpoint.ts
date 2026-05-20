import { ApiValidationError } from "./errors.js";
import { mergeHeaders } from "./headers.js";
import { mergeQuery } from "./query.js";
import { HttpMethod } from "./types.js";
import type {
  ApiEndpoint,
  ApiEndpointOptions,
  ApiRequestContext,
  ApiRequest,
  EndpointCallOptions,
  EndpointInput,
  EndpointParams,
  EndpointResult,
  OptionalSchema,
  SchemaInput,
  SchemaOutput
} from "./types.js";

// Definition
export const defineEndpoint = <
  const TParamsSchema extends OptionalSchema = undefined,
  const TRequestSchema extends OptionalSchema = undefined,
  const TResponseSchema extends OptionalSchema = undefined,
  const TResultSchema extends OptionalSchema = undefined
>(
  endpoint: ApiEndpointOptions<
    TParamsSchema,
    TRequestSchema,
    TResponseSchema,
    TResultSchema
  >
): ApiEndpointOptions<
  TParamsSchema,
  TRequestSchema,
  TResponseSchema,
  TResultSchema
> => Object.freeze(endpoint);

// Execution
export const executeEndpoint = async <
  TParamsSchema extends OptionalSchema,
  TRequestSchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResultSchema extends OptionalSchema
>(
  request: ApiRequest,
  endpoint: ApiEndpointOptions<
    TParamsSchema,
    TRequestSchema,
    TResponseSchema,
    TResultSchema
  >,
  rawParams: EndpointInput<TParamsSchema>,
  callOptions: EndpointCallOptions = {}
): Promise<EndpointResult<TResponseSchema, TResultSchema>> => {
  const method = endpoint.method ?? HttpMethod.GET;
  const contextPath = typeof endpoint.path === "string"
    ? endpoint.path
    : "[dynamic endpoint]";
  const context = {
    method,
    path: contextPath
  };
  const params = parseEndpointParams(endpoint, rawParams, context);
  const path   = typeof endpoint.path === "function"
    ? endpoint.path(params)
    : endpoint.path;
  const body   = endpoint.mapBody
    ? endpoint.mapBody(params)
    : endpoint.requestSchema
      ? params as SchemaInput<TRequestSchema>
      : undefined;

  const response = await request(path, {
    ...callOptions,
    method,
    body,
    requestSchema      : endpoint.requestSchema,
    responseSchema     : endpoint.responseSchema,
    headers            : mergeHeaders(endpoint.mapHeaders?.(params), callOptions.headers),
    query              : mergeQuery(endpoint.mapQuery?.(params), callOptions.query),
    auth               : callOptions.auth ?? endpoint.auth,
    retryOnUnauthorized: callOptions.retryOnUnauthorized ?? endpoint.retryOnUnauthorized
  });

  const resultInput = endpoint.mapResult
    ? endpoint.mapResult(response as SchemaOutput<TResponseSchema>)
    : response;

  if (!endpoint.resultSchema) {
    return resultInput as EndpointResult<TResponseSchema, TResultSchema>;
  }

  const parsedResult = endpoint.resultSchema.safeParse(resultInput);

  if (!parsedResult.success) {
    throw new ApiValidationError(
      "response",
      parsedResult.error,
      resultInput,
      {
        method,
        path
      }
    );
  }

  return parsedResult.data as EndpointResult<TResponseSchema, TResultSchema>;
};

const parseEndpointParams = <TParamsSchema extends OptionalSchema>(
  endpoint: Pick<ApiEndpoint<TParamsSchema>, "paramsSchema">,
  rawParams: EndpointInput<TParamsSchema>,
  context: ApiRequestContext
): EndpointParams<TParamsSchema> => {
  if (!endpoint.paramsSchema) {
    return undefined as EndpointParams<TParamsSchema>;
  }

  const parsedParams = endpoint.paramsSchema.safeParse(rawParams);

  if (!parsedParams.success) {
    throw new ApiValidationError(
      "request",
      parsedParams.error,
      rawParams,
      context
    );
  }

  return parsedParams.data as EndpointParams<TParamsSchema>;
};
