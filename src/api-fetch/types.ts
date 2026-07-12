import type { ApiLogging } from "./logging.js";
import type { ServerClock } from "../time/index.js";
import type { z } from "zod";

// HTTP types
/** Allowed values for api method */
export const ApiMethod = {
  DELETE: "DELETE",
  GET   : "GET",
  PATCH : "PATCH",
  POST  : "POST",
  PUT   : "PUT"
} as const;

/** HTTP method value accepted by API helpers */
export type ApiMethod = (typeof ApiMethod)[keyof typeof ApiMethod];

/** Value accepted in query string helpers */
export type QueryValue = string | number | boolean | null | undefined;

/** Query input accepted by URL and API helpers */
export type QueryParams =
  | URLSearchParams
  | Array<[string, QueryValue]>
  | Record<string, QueryValue | QueryValue[]>;

/** Header input accepted by the Fetch Headers constructor */
export type ApiHeadersInit = ConstructorParameters<typeof Headers>[0];

// Schema types
/** Accepts any Zod schema */
export type AnySchema = z.ZodType;

/** Accepts a Zod schema or no schema */
export type OptionalSchema = z.ZodType | undefined;

/** Input type inferred from an optional schema */
export type SchemaInput<TSchema extends OptionalSchema> =
  TSchema extends z.ZodType ? z.input<TSchema> : unknown;

/** Output type inferred from an optional schema */
export type SchemaOutput<TSchema extends OptionalSchema> =
  TSchema extends z.ZodType ? z.output<TSchema> : unknown;

/** Payload shape for api response */
export type ApiResponsePayload<TData> =
  TData extends { data?: infer TResponseData }
    ? TData extends { code: unknown } | { message: unknown }
      ? TResponseData
      : TData
    : TData;

/** Data value exposed from an API response payload */
export type ApiResponseData<TData> = ApiResponsePayload<TData>;

// Shared types
/** Allows a value or a promise of that value */
export type MaybePromise<TValue> = TValue | Promise<TValue>;

/** Standard success response returned by the API fetcher */
export type ApiResponse<TResponse> = Readonly<{
  code     : number;
  message ?: string;
  response : TResponse;
}>;

/** Application error code copied from an API error body */
export type ApiErrorCode = string | number;

/** Configured error code fallback and safe message used instead of upstream error text */
export type ApiErrorFallback = Readonly<{
  code   ?: ApiErrorCode;
  message?: string;
}>;

/** Safe code and message options for an API HTTP error */
export type ApiHttpErrorOptions = ApiErrorFallback;

/** Minimal compatible shape for fetch */
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

/** Context passed to api request */
export type ApiRequestContext = Readonly<{
  method: ApiMethod;
  path  : string;
  url   : string;
}>;

// Hooks
/** Context passed to api timed request */
export type ApiTimedRequestContext = ApiRequestContext & Readonly<{
  startedAt: number;
}>;

/** Context passed to api hook */
export type ApiHookContext = ApiTimedRequestContext;

/** Context passed to api response hook */
export type ApiResponseHookContext = ApiTimedRequestContext & Readonly<{
  data      : unknown;
  durationMs: number;
  response  : Response;
}>;

/** Context passed to api error hook */
export type ApiErrorHookContext = ApiTimedRequestContext & Readonly<{
  data      ?: unknown;
  durationMs: number;
  error     : unknown;
  response ?: Response;
}>;

/** Lifecycle hooks called around API requests and responses */
export type ApiHooks = Readonly<{
  onRequest      ?: (context: ApiHookContext) => MaybePromise<void>;
  onRequestError ?: (context: ApiErrorHookContext) => MaybePromise<void>;
  onResponse     ?: (context: ApiResponseHookContext) => MaybePromise<void>;
  onResponseError?: (context: ApiErrorHookContext) => MaybePromise<void>;
}>;

// Retry
/** Context passed to api retry */
export type ApiRetryContext = ApiRequestContext & Readonly<{
  attempt : number;
  error   : unknown;
  response?: Response;
  status  ?: number;
}>;

/** Options for api retry */
export type ApiRetryOptions = Readonly<{
  delay            ?: number | ((context: ApiRetryContext) => number);
  jitter           ?: number;
  limit            ?: number;
  methods          ?: readonly ApiMethod[];
  respectRetryAfter?: boolean;
  shouldRetry      ?: (context: ApiRetryContext) => MaybePromise<boolean | undefined>;
  statusCodes      ?: readonly number[];
  strategy         ?: RetryStrategy;
}>;

/** Retry setting accepted by API requests */
export type ApiRetry = boolean | number | ApiRetryOptions;

/** Delay strategy applied between API retry attempts */
export type RetryStrategy = "fixed" | "exponential";

// Server time
/** Options for sampling server time from API response headers */
export type ApiServerTimeOptions = Readonly<{
  clock : ServerClock;
  header?: string;
  now   ?: () => number;
}>;

/** Server time sampling setting accepted by API fetchers */
export type ApiServerTime = boolean | ApiServerTimeOptions;

// Auth
/** Converts an access token into request headers */
export type ApiTokenHeaderFormatter = (
  accessToken: string
) => ApiHeadersInit | null | undefined;

/** Options for api auth */
export type ApiAuthOptions = Readonly<{
  clear               ?: () => MaybePromise<void>;
  formatTokenHeader   ?: ApiTokenHeaderFormatter;
  getAccessToken       : () => MaybePromise<string | null | undefined>;
  refresh            ?: (error: unknown) => MaybePromise<string | null | undefined>;
  shouldRefreshOnError?: (error: unknown) => boolean;
}>;

/** Creates a fresh raw request body for each network attempt */
export type RawBodyFactory = (
  attempt: number
) => MaybePromise<RequestInit["body"] | undefined>;

// Request options
type ApiDefaultResponse<TResponseSchema extends OptionalSchema> =
  ApiResponse<ApiResponsePayload<SchemaOutput<TResponseSchema>>>;

type ApiIsAny<TValue> = 0 extends (1 & TValue) ? true : false;

type ApiSchemaProperty<
  TKey extends PropertyKey,
  TSchema extends OptionalSchema
> = ApiIsAny<TSchema> extends true
  ? { [TProperty in TKey]?: TSchema }
  : TSchema extends z.ZodType
    ? { [TProperty in TKey]-?: TSchema }
    : { [TProperty in TKey]?: undefined };

type ApiTypesEqual<TLeft, TRight> =
  (<TValue>() => TValue extends TLeft ? 1 : 2) extends
  (<TValue>() => TValue extends TRight ? 1 : 2)
    ? (<TValue>() => TValue extends TRight ? 1 : 2) extends
      (<TValue>() => TValue extends TLeft ? 1 : 2)
        ? true
        : false
    : false;

type ApiSelectionProperty<
  TResponseSchema extends OptionalSchema,
  TResult
> = ApiIsAny<TResult> extends true
  ? {
    select?: (data: SchemaOutput<TResponseSchema>, response: Response) => TResult;
  }
  : ApiTypesEqual<TResult, ApiDefaultResponse<TResponseSchema>> extends true
    ? {
      select?: (data: SchemaOutput<TResponseSchema>, response: Response) => TResult;
    }
    : {
      select: (data: SchemaOutput<TResponseSchema>, response: Response) => TResult;
    };

/** Options for api request */
export type ApiRequestOptions<
  TBodySchema extends OptionalSchema = undefined,
  TResponseSchema extends OptionalSchema = undefined,
  TResult = ApiDefaultResponse<TResponseSchema>
> = Omit<RequestInit, "body" | "headers" | "method"> & {
  auth         ?: boolean;
  baseURL      ?: string;
  body         ?: SchemaInput<TBodySchema>;
  errorFallback?: ApiErrorFallback;
  headers      ?: ApiHeadersInit;
  hooks            ?: ApiHooks;
  maxResponseBytes?: number;
  query            ?: QueryParams;
  rawBody          ?: RequestInit["body"];
  rawBodyFactory   ?: RawBodyFactory;
  retry            ?: ApiRetry;
  timeout          ?: number;
} & ApiSchemaProperty<"bodySchema", TBodySchema>
  & ApiSchemaProperty<"responseSchema", TResponseSchema>
  & ApiSelectionProperty<TResponseSchema, TResult>;

/** Options for api read */
export type ApiReadOptions<
  TResponseSchema extends OptionalSchema = undefined,
  TResult = ApiDefaultResponse<TResponseSchema>
> = Omit<
  ApiRequestOptions<undefined, TResponseSchema, TResult>,
  "body" | "bodySchema" | "rawBody" | "rawBodyFactory"
>;

/** Options for api write */
export type ApiWriteOptions<
  TBodySchema extends OptionalSchema = undefined,
  TResponseSchema extends OptionalSchema = undefined,
  TResult = ApiDefaultResponse<TResponseSchema>
> = ApiRequestOptions<TBodySchema, TResponseSchema, TResult>;

/** Callable read method signature for GET and DELETE requests */
export type ApiReadMethod = {
  <
    TResponseSchema extends z.ZodType,
    TResult
  >(
    path: string,
    options: ApiReadOptions<TResponseSchema, TResult> & {
      responseSchema: TResponseSchema;
      select: (data: SchemaOutput<TResponseSchema>, response: Response) => TResult;
    }
  ): Promise<TResult>;
  <TResponseSchema extends z.ZodType>(
    path: string,
    options: ApiReadOptions<
      TResponseSchema,
      ApiDefaultResponse<TResponseSchema>
    > & {
      responseSchema: TResponseSchema;
      select?: undefined;
    }
  ): Promise<ApiDefaultResponse<TResponseSchema>>;
  <TResult>(
    path: string,
    options: ApiReadOptions<undefined, TResult> & {
      responseSchema?: undefined;
      select: (data: unknown, response: Response) => TResult;
    }
  ): Promise<TResult>;
  (
    path: string,
    options?: ApiReadOptions<undefined, ApiDefaultResponse<undefined>> & {
      responseSchema?: undefined;
      select?: undefined;
    }
  ): Promise<ApiDefaultResponse<undefined>>;
};

/** Callable write method signature for POST, PUT, and PATCH requests */
export type ApiWriteMethod = {
  <
    TBodySchema extends OptionalSchema = undefined,
    TResponseSchema extends z.ZodType = z.ZodType,
    TResult = ApiDefaultResponse<TResponseSchema>
  >(
    path: string,
    options: ApiWriteOptions<TBodySchema, TResponseSchema, TResult> & {
      bodySchema?: TBodySchema;
      responseSchema: TResponseSchema;
      select: (data: SchemaOutput<TResponseSchema>, response: Response) => TResult;
    }
  ): Promise<TResult>;
  <
    TBodySchema extends OptionalSchema = undefined,
    TResponseSchema extends z.ZodType = z.ZodType
  >(
    path: string,
    options: ApiWriteOptions<
      TBodySchema,
      TResponseSchema,
      ApiDefaultResponse<TResponseSchema>
    > & {
      bodySchema?: TBodySchema;
      responseSchema: TResponseSchema;
      select?: undefined;
    }
  ): Promise<ApiDefaultResponse<TResponseSchema>>;
  <
    TBodySchema extends OptionalSchema = undefined,
    TResult = unknown
  >(
    path: string,
    options: ApiWriteOptions<TBodySchema, undefined, TResult> & {
      bodySchema?: TBodySchema;
      responseSchema?: undefined;
      select: (data: unknown, response: Response) => TResult;
    }
  ): Promise<TResult>;
  <TBodySchema extends z.ZodType>(
    path: string,
    options: ApiWriteOptions<
      TBodySchema,
      undefined,
      ApiDefaultResponse<undefined>
    > & {
      bodySchema: TBodySchema;
      responseSchema?: undefined;
      select?: undefined;
    }
  ): Promise<ApiDefaultResponse<undefined>>;
  (
    path: string,
    options?: ApiWriteOptions<
      undefined,
      undefined,
      ApiDefaultResponse<undefined>
    > & {
      bodySchema?: undefined;
      responseSchema?: undefined;
      select?: undefined;
    }
  ): Promise<ApiDefaultResponse<undefined>>;
};

/** Callable API request function shared by read and write methods */
export type ApiRequest = {
  <
    TBodySchema extends OptionalSchema = undefined,
    TResponseSchema extends z.ZodType = z.ZodType,
    TResult = ApiDefaultResponse<TResponseSchema>
  >(
    method: ApiMethod,
    path: string,
    options: ApiRequestOptions<TBodySchema, TResponseSchema, TResult> & {
      bodySchema?: TBodySchema;
      responseSchema: TResponseSchema;
      select: (data: SchemaOutput<TResponseSchema>, response: Response) => TResult;
    }
  ): Promise<TResult>;
  <
    TBodySchema extends OptionalSchema = undefined,
    TResponseSchema extends z.ZodType = z.ZodType
  >(
    method: ApiMethod,
    path: string,
    options: ApiRequestOptions<
      TBodySchema,
      TResponseSchema,
      ApiDefaultResponse<TResponseSchema>
    > & {
      bodySchema?: TBodySchema;
      responseSchema: TResponseSchema;
      select?: undefined;
    }
  ): Promise<ApiDefaultResponse<TResponseSchema>>;
  <
    TBodySchema extends OptionalSchema = undefined,
    TResult = ApiDefaultResponse<undefined>
  >(
    method: ApiMethod,
    path: string,
    options: ApiRequestOptions<TBodySchema, undefined, TResult> & {
      bodySchema?: TBodySchema;
      responseSchema?: undefined;
      select: (data: unknown, response: Response) => TResult;
    }
  ): Promise<TResult>;
  <TBodySchema extends z.ZodType>(
    method: ApiMethod,
    path: string,
    options: ApiRequestOptions<
      TBodySchema,
      undefined,
      ApiDefaultResponse<undefined>
    > & {
      bodySchema: TBodySchema;
      responseSchema?: undefined;
      select?: undefined;
    }
  ): Promise<ApiDefaultResponse<undefined>>;
  (
    method: ApiMethod,
    path: string,
    options?: ApiRequestOptions<
      undefined,
      undefined,
      ApiDefaultResponse<undefined>
    > & {
      bodySchema?: undefined;
      responseSchema?: undefined;
      select?: undefined;
    }
  ): Promise<ApiDefaultResponse<undefined>>;
};

/** Options for api fetcher */
export type ApiFetcherOptions = Readonly<{
  allowedOrigins   ?: readonly string[];
  auth            ?: ApiAuthOptions;
  baseURL         ?: string;
  errorFallback   ?: ApiErrorFallback;
  fetch           ?: FetchLike;
  headers         ?: ApiHeadersInit;
  hooks           ?: ApiHooks;
  logging         ?: ApiLogging;
  maxResponseBytes?: number;
  retry           ?: ApiRetry;
  serverTime      ?: ApiServerTime;
  timeout         ?: number;
}>;

/** API client returned by createApiFetcher */
export type ApiFetcher = Readonly<{
  call: <TEndpoint extends AnyApiEndpoint>(
    endpoint: TEndpoint,
    ...args: EndpointCallArgs<TEndpoint>
  ) => Promise<EndpointResult<TEndpoint>>;
  delete : ApiWriteMethod;
  get    : ApiReadMethod;
  options: ApiFetcherOptions;
  patch  : ApiWriteMethod;
  post   : ApiWriteMethod;
  put    : ApiWriteMethod;
  request: ApiRequest;
  serverTime?: ServerClock;
}>;

// Endpoint types
declare const apiEndpointType: unique symbol;

type ApiEndpointTypeState<
  TParamsSchema extends OptionalSchema,
  TBodySchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
> = Readonly<{
  bodySchema    : TBodySchema;
  paramsSchema  : TParamsSchema;
  responseSchema: TResponseSchema;
  result        : TResult;
}>;

/** Represents endpoint params */
export type EndpointParams<TParamsSchema extends OptionalSchema> =
  TParamsSchema extends z.ZodType ? z.output<TParamsSchema> : undefined;

/** Represents endpoint query */
export type EndpointQuery<TParamsSchema extends OptionalSchema> =
  | QueryParams
  | ((params: EndpointParams<TParamsSchema>) => QueryParams | undefined);

/** Represents endpoint headers */
export type EndpointHeaders<TParamsSchema extends OptionalSchema> =
  | ApiHeadersInit
  | ((params: EndpointParams<TParamsSchema>) => ApiHeadersInit | undefined);

/** Options for api endpoint */
export type ApiEndpointOptions<
  TParamsSchema extends OptionalSchema = undefined,
  TBodySchema extends OptionalSchema = undefined,
  TResponseSchema extends OptionalSchema = undefined,
  TResult = ApiDefaultResponse<TResponseSchema>
> = Readonly<{
  auth         ?: boolean;
  errorFallback    ?: ApiErrorFallback;
  headers          ?: EndpointHeaders<TParamsSchema>;
  maxResponseBytes?: number;
  query            ?: EndpointQuery<TParamsSchema>;
  retry            ?: ApiRetry;
  timeout          ?: number;
} & ApiSchemaProperty<"params", TParamsSchema>
  & ApiSchemaProperty<"bodySchema", TBodySchema>
  & ApiSchemaProperty<"responseSchema", TResponseSchema>
  & ApiSelectionProperty<TResponseSchema, TResult>>;

/** Represents api endpoint */
export type ApiEndpoint<
  TParamsSchema extends OptionalSchema = OptionalSchema,
  TBodySchema extends OptionalSchema = OptionalSchema,
  TResponseSchema extends OptionalSchema = OptionalSchema,
  TResult = ApiDefaultResponse<TResponseSchema>
> = Readonly<{
  [apiEndpointType]?: ApiEndpointTypeState<
    TParamsSchema,
    TBodySchema,
    TResponseSchema,
    TResult
  >;
  method : ApiMethod;
  options: ApiEndpointOptions<
    TParamsSchema,
    TBodySchema,
    TResponseSchema,
    TResult
  >;
  path   : string;
}>;

/** Endpoint definition with any supported schema combination */
export type AnyApiEndpoint = ApiEndpoint<any, any, any, any>;

/** Factory signature for endpoint */
export type EndpointFactory<TMethod extends ApiMethod> = {
  <
    const TParamsSchema extends OptionalSchema = undefined,
    const TBodySchema extends OptionalSchema = undefined,
    const TResponseSchema extends z.ZodType = z.ZodType,
    TResult = ApiDefaultResponse<TResponseSchema>
  >(
    path: string,
    options: ApiEndpointOptions<
      TParamsSchema,
      TBodySchema,
      TResponseSchema,
      TResult
    > & {
      bodySchema?: TBodySchema;
      params?: TParamsSchema;
      responseSchema: TResponseSchema;
      select: (data: SchemaOutput<TResponseSchema>, response: Response) => TResult;
    }
  ): ApiEndpoint<TParamsSchema, TBodySchema, TResponseSchema, TResult>;
  <
    const TParamsSchema extends OptionalSchema = undefined,
    const TBodySchema extends OptionalSchema = undefined,
    const TResponseSchema extends z.ZodType = z.ZodType
  >(
    path: string,
    options: ApiEndpointOptions<
      TParamsSchema,
      TBodySchema,
      TResponseSchema,
      ApiDefaultResponse<TResponseSchema>
    > & {
      bodySchema?: TBodySchema;
      params?: TParamsSchema;
      responseSchema: TResponseSchema;
      select?: undefined;
    }
  ): ApiEndpoint<
    TParamsSchema,
    TBodySchema,
    TResponseSchema,
    ApiDefaultResponse<TResponseSchema>
  >;
  <
    const TParamsSchema extends OptionalSchema = undefined,
    const TBodySchema extends OptionalSchema = undefined,
    const TResponseSchema extends undefined = undefined,
    TResult = unknown
  >(
    path: string,
    options: ApiEndpointOptions<
      TParamsSchema,
      TBodySchema,
      TResponseSchema,
      TResult
    > & {
      bodySchema?: TBodySchema;
      params?: TParamsSchema;
      responseSchema?: undefined;
      select: (data: unknown, response: Response) => TResult;
    }
  ): ApiEndpoint<TParamsSchema, TBodySchema, TResponseSchema, TResult>;
  <
    const TParamsSchema extends OptionalSchema = undefined,
    const TBodySchema extends OptionalSchema = undefined
  >(
    path: string,
    options: ApiEndpointOptions<
      TParamsSchema,
      TBodySchema,
      undefined,
      ApiDefaultResponse<undefined>
    > & {
      bodySchema?: TBodySchema;
      params?: TParamsSchema;
      responseSchema?: undefined;
      select?: undefined;
    }
  ): ApiEndpoint<
    TParamsSchema,
    TBodySchema,
    undefined,
    ApiDefaultResponse<undefined>
  >;
  (
    path: string,
    options?: ApiEndpointOptions<
      undefined,
      undefined,
      undefined,
      ApiDefaultResponse<undefined>
    >
  ): ApiEndpoint<
    undefined,
    undefined,
    undefined,
    ApiDefaultResponse<undefined>
  >;
  method: TMethod;
};

/** Represents endpoint call overrides */
export type EndpointCallOverrides = Omit<
  ApiRequestOptions<undefined, undefined>,
  "body" | "bodySchema" | "responseSchema" | "select"
>;

/** Path params input inferred from an endpoint schema */
export type EndpointParamsInput<TParamsSchema extends OptionalSchema> =
  TParamsSchema extends z.ZodType
    ? { params: z.input<TParamsSchema> }
    : { params?: undefined };

/** Request body input inferred from an endpoint schema */
export type EndpointBodyInput<TBodySchema extends OptionalSchema> =
  TBodySchema extends z.ZodType
    ? { body: z.input<TBodySchema> }
    : { body?: undefined };

/** Input object accepted when calling an endpoint */
export type EndpointCallInput<
  TParamsSchema extends OptionalSchema,
  TBodySchema extends OptionalSchema
> = EndpointCallOverrides
  & EndpointBodyInput<TBodySchema>
  & EndpointParamsInput<TParamsSchema>;

/** Argument tuple required to call an endpoint */
export type EndpointCallArgs<TEndpoint extends AnyApiEndpoint> =
  NonNullable<TEndpoint[typeof apiEndpointType]> extends ApiEndpointTypeState<
    infer TParamsSchema,
    infer TBodySchema,
    any,
    any
  >
    ? TParamsSchema extends z.ZodType
      ? [input: EndpointCallInput<TParamsSchema, TBodySchema>]
      : TBodySchema extends z.ZodType
        ? [input: EndpointCallInput<TParamsSchema, TBodySchema>]
        : [input?: EndpointCallInput<TParamsSchema, TBodySchema>]
    : never;

/** Result returned by endpoint */
export type EndpointResult<TEndpoint extends AnyApiEndpoint> =
  NonNullable<TEndpoint[typeof apiEndpointType]>["result"];
