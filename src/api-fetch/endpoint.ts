import { ApiValidationError } from "./errors.js";
import { mergeHeaders } from "./headers.js";
import { mergeQuery } from "./query.js";
import { redactApiUrl } from "./url.js";
import { ApiMethod } from "./types.js";
import type {
  AnyApiEndpoint,
  ApiEndpoint,
  ApiEndpointOptions,
  ApiErrorFallback,
  ApiHeadersInit,
  ApiRequest,
  ApiRequestContext,
  EndpointCallInput,
  EndpointFactory,
  EndpointHeaders,
  EndpointParams,
  EndpointQuery,
  EndpointResult,
  OptionalSchema,
  QueryParams
} from "./types.js";

/** Creates endpoint factory */
export const createEndpointFactory = <TMethod extends ApiMethod>(
  method: TMethod
): EndpointFactory<TMethod> => {
  const factory = <
    const TParamsSchema extends OptionalSchema = undefined,
    const TBodySchema extends OptionalSchema = undefined,
    const TResponseSchema extends OptionalSchema = undefined,
    TResult = unknown
  >(
    path: string,
    options: ApiEndpointOptions<
      TParamsSchema,
      TBodySchema,
      TResponseSchema,
      TResult
    > = {}
  ): ApiEndpoint<TParamsSchema, TBodySchema, TResponseSchema, TResult> => Object.freeze({
    method,
    options: Object.freeze(options),
    path
  });

  return Object.assign(factory, {
    method
  }) as EndpointFactory<TMethod>;
};

/** Grouped endpoint factories for each HTTP method */
export const endpoint = Object.freeze({
  delete: createEndpointFactory(ApiMethod.DELETE),
  get   : createEndpointFactory(ApiMethod.GET),
  patch : createEndpointFactory(ApiMethod.PATCH),
  post  : createEndpointFactory(ApiMethod.POST),
  put   : createEndpointFactory(ApiMethod.PUT)
});

// Endpoint execution
/** Calls an endpoint definition through an API fetcher */
export const executeEndpoint = async <TEndpoint extends AnyApiEndpoint>(
  request: ApiRequest,
  apiEndpoint: TEndpoint,
  input: EndpointCallInput<any, any> = {}
): Promise<EndpointResult<TEndpoint>> => {
  const {
    body,
    params: rawParams,
    rawBody,
    rawBodyFactory,
    ...callOptions
  } = input;
  const safePath = redactApiUrl(apiEndpoint.path);
  const context = {
    method   : apiEndpoint.method,
    path     : safePath,
    startedAt: Date.now(),
    url      : safePath
  };
  const params = parseEndpointParams(apiEndpoint, rawParams, context);
  const path   = buildEndpointPath(apiEndpoint.path, params);

  return request(apiEndpoint.method, path, {
    ...callOptions,
    auth         : callOptions.auth ?? apiEndpoint.options.auth,
    errorFallback: mergeErrorFallback(
      apiEndpoint.options.errorFallback,
      callOptions.errorFallback
    ),
    headers: mergeHeaders(
      resolveEndpointHeaders(apiEndpoint.options.headers, params),
      callOptions.headers
    ),
    ...(rawBody === undefined && rawBodyFactory === undefined ? { body } : {}),
    bodySchema      : apiEndpoint.options.bodySchema,
    hooks           : callOptions.hooks,
    maxResponseBytes: callOptions.maxResponseBytes ?? apiEndpoint.options.maxResponseBytes,
    query     : mergeQuery(
      resolveEndpointQuery(apiEndpoint.options.query, params),
      callOptions.query
    ),
    rawBody,
    rawBodyFactory,
    responseSchema: apiEndpoint.options.responseSchema,
    retry         : callOptions.retry ?? apiEndpoint.options.retry,
    select        : apiEndpoint.options.select,
    timeout       : callOptions.timeout ?? apiEndpoint.options.timeout
  }) as Promise<EndpointResult<TEndpoint>>;
};

const mergeErrorFallback = (
  base: ApiErrorFallback | undefined,
  override: ApiErrorFallback | undefined
): ApiErrorFallback | undefined => {
  if (!base) {
    return override;
  }

  if (!override) {
    return base;
  }

  return {
    code   : override.code ?? base.code,
    message: override.message ?? base.message
  };
};

const parseEndpointParams = <TEndpoint extends AnyApiEndpoint>(
  apiEndpoint: TEndpoint,
  rawParams: unknown,
  context: ApiRequestContext
): EndpointParams<TEndpoint["options"]["params"]> => {
  const paramsSchema = apiEndpoint.options.params;

  if (!paramsSchema) {
    return undefined as EndpointParams<TEndpoint["options"]["params"]>;
  }

  const parsedParams = paramsSchema.safeParse(rawParams);

  if (!parsedParams.success) {
    throw new ApiValidationError(
      "request",
      parsedParams.error,
      rawParams,
      context
    );
  }

  return parsedParams.data as EndpointParams<TEndpoint["options"]["params"]>;
};

const buildEndpointPath = (
  path: string,
  params: unknown
): string => {
  if (!path.includes(":")) {
    return path;
  }

  const record = isRecord(params) ? params : {};

  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (token, key: string) => {
    const value = record[key];

    if (value === undefined || value === null) {
      throw new Error(`Missing endpoint path param ${token}`);
    }

    return encodeURIComponent(String(value));
  });
};

const resolveEndpointQuery = <TParamsSchema extends OptionalSchema>(
  query: EndpointQuery<TParamsSchema> | undefined,
  params: EndpointParams<TParamsSchema>
): QueryParams | undefined => (
  typeof query === "function" ? query(params) : query
);

const resolveEndpointHeaders = <TParamsSchema extends OptionalSchema>(
  headers: EndpointHeaders<TParamsSchema> | undefined,
  params: EndpointParams<TParamsSchema>
): ApiHeadersInit | undefined => (
  typeof headers === "function" ? headers(params) : headers
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);
