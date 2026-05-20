import { ApiValidationError } from "./errors.js";
import { mergeHeaders } from "./headers.js";
import { mergeQuery } from "./query.js";
import { ApiMethod } from "./types.js";
import type {
  AnyApiEndpoint,
  ApiEndpoint,
  ApiEndpointOptions,
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

export const createEndpointFactory = <TMethod extends ApiMethod>(
  method: TMethod
): EndpointFactory<TMethod> => {
  const factory = <
    const TParamsSchema extends OptionalSchema = undefined,
    const TJsonSchema extends OptionalSchema = undefined,
    const TResponseSchema extends OptionalSchema = undefined,
    TResult = unknown
  >(
    path: string,
    options: ApiEndpointOptions<
      TParamsSchema,
      TJsonSchema,
      TResponseSchema,
      TResult
    > = {}
  ): ApiEndpoint<TParamsSchema, TJsonSchema, TResponseSchema, TResult> => Object.freeze({
    method,
    options: Object.freeze(options),
    path
  });

  return Object.assign(factory, {
    method
  }) as EndpointFactory<TMethod>;
};

export const endpoint = Object.freeze({
  delete: createEndpointFactory(ApiMethod.DELETE),
  get   : createEndpointFactory(ApiMethod.GET),
  patch : createEndpointFactory(ApiMethod.PATCH),
  post  : createEndpointFactory(ApiMethod.POST),
  put   : createEndpointFactory(ApiMethod.PUT)
});

// Endpoint execution
export const executeEndpoint = async <TEndpoint extends AnyApiEndpoint>(
  request: ApiRequest,
  apiEndpoint: TEndpoint,
  input: EndpointCallInput<any, any> = {}
): Promise<EndpointResult<TEndpoint>> => {
  const {
    params: rawParams,
    ...callOptions
  } = input;
  const context = {
    method   : apiEndpoint.method,
    path     : apiEndpoint.path,
    startedAt: Date.now(),
    url      : apiEndpoint.path
  };
  const params = parseEndpointParams(apiEndpoint, rawParams, context);
  const path   = buildEndpointPath(apiEndpoint.path, params);

  return request(apiEndpoint.method, path, {
    ...callOptions,
    auth      : callOptions.auth ?? apiEndpoint.options.auth,
    headers   : mergeHeaders(
      resolveEndpointHeaders(apiEndpoint.options.headers, params),
      callOptions.headers
    ),
    hooks     : callOptions.hooks,
    json      : callOptions.json,
    jsonSchema: apiEndpoint.options.json,
    query     : mergeQuery(
      resolveEndpointQuery(apiEndpoint.options.query, params),
      callOptions.query
    ),
    retry     : callOptions.retry ?? apiEndpoint.options.retry,
    schema    : apiEndpoint.options.schema,
    select    : apiEndpoint.options.select,
    timeout   : callOptions.timeout ?? apiEndpoint.options.timeout
  }) as Promise<EndpointResult<TEndpoint>>;
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
