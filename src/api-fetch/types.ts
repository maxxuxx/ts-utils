import type { ApiLogging } from "./logging.js";
import type { z } from "zod";

// HTTP types
export const ApiMethod = {
  DELETE: "DELETE",
  GET   : "GET",
  PATCH : "PATCH",
  POST  : "POST",
  PUT   : "PUT"
} as const;

export type ApiMethod = (typeof ApiMethod)[keyof typeof ApiMethod];

export type QueryValue = string | number | boolean | null | undefined;

export type QueryParams =
  | URLSearchParams
  | Array<[string, QueryValue]>
  | Record<string, QueryValue | QueryValue[]>;

export type ApiHeadersInit = ConstructorParameters<typeof Headers>[0];

// Schema types
export type AnySchema = z.ZodType;
export type OptionalSchema = z.ZodType | undefined;

export type SchemaInput<TSchema extends OptionalSchema> =
  TSchema extends z.ZodType ? z.input<TSchema> : unknown;

export type SchemaOutput<TSchema extends OptionalSchema> =
  TSchema extends z.ZodType ? z.output<TSchema> : unknown;

// Shared types
export type MaybePromise<TValue> = TValue | Promise<TValue>;

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type ApiRequestContext = Readonly<{
  method: ApiMethod;
  path  : string;
  url   : string;
}>;

// Hooks
export type ApiTimedRequestContext = ApiRequestContext & Readonly<{
  startedAt: number;
}>;

export type ApiHookContext = ApiTimedRequestContext;

export type ApiResponseHookContext = ApiTimedRequestContext & Readonly<{
  data      : unknown;
  durationMs: number;
  response  : Response;
}>;

export type ApiErrorHookContext = ApiTimedRequestContext & Readonly<{
  data      ?: unknown;
  durationMs: number;
  error     : unknown;
  response ?: Response;
}>;

export type ApiHooks = Readonly<{
  onRequest      ?: (context: ApiHookContext) => MaybePromise<void>;
  onRequestError ?: (context: ApiErrorHookContext) => MaybePromise<void>;
  onResponse     ?: (context: ApiResponseHookContext) => MaybePromise<void>;
  onResponseError?: (context: ApiErrorHookContext) => MaybePromise<void>;
}>;

// Retry
export type ApiRetryContext = ApiRequestContext & Readonly<{
  attempt : number;
  error   : unknown;
  response?: Response;
  status  ?: number;
}>;

export type ApiRetryOptions = Readonly<{
  delay      ?: number | ((context: ApiRetryContext) => number);
  limit      ?: number;
  methods    ?: readonly ApiMethod[];
  shouldRetry?: (context: ApiRetryContext) => MaybePromise<boolean | undefined>;
  statusCodes?: readonly number[];
}>;

export type ApiRetry = boolean | number | ApiRetryOptions;

// Auth
export type ApiAuthOptions = Readonly<{
  clear               ?: () => MaybePromise<void>;
  getAccessToken       : () => MaybePromise<string | null | undefined>;
  refresh            ?: (error: unknown) => MaybePromise<string | null | undefined>;
  shouldRefreshOnError?: (error: unknown) => boolean;
}>;

// Request options
export type ApiRequestOptions<
  TBodySchema extends OptionalSchema = undefined,
  TResponseSchema extends OptionalSchema = undefined,
  TResult = SchemaOutput<TResponseSchema>
> = Omit<RequestInit, "body" | "headers" | "method"> & {
  auth          ?: boolean;
  baseURL       ?: string;
  body          ?: SchemaInput<TBodySchema>;
  bodySchema    ?: TBodySchema;
  headers       ?: ApiHeadersInit;
  hooks         ?: ApiHooks;
  query         ?: QueryParams;
  rawBody       ?: RequestInit["body"];
  responseSchema?: TResponseSchema;
  retry         ?: ApiRetry;
  select        ?: (data: SchemaOutput<TResponseSchema>, response: Response) => TResult;
  timeout       ?: number;
};

export type ApiReadOptions<
  TResponseSchema extends OptionalSchema = undefined,
  TResult = SchemaOutput<TResponseSchema>
> = Omit<
  ApiRequestOptions<undefined, TResponseSchema, TResult>,
  "body" | "bodySchema" | "rawBody"
>;

export type ApiWriteOptions<
  TBodySchema extends OptionalSchema = undefined,
  TResponseSchema extends OptionalSchema = undefined,
  TResult = SchemaOutput<TResponseSchema>
> = ApiRequestOptions<TBodySchema, TResponseSchema, TResult>;

export type ApiReadMethod = {
  <TResponseSchema extends z.ZodType, TResult = SchemaOutput<TResponseSchema>>(
    path: string,
    options: ApiReadOptions<TResponseSchema, TResult> & {
      responseSchema: TResponseSchema;
    }
  ): Promise<TResult>;
  <TData = unknown>(
    path: string,
    options?: ApiReadOptions<undefined, TData>
  ): Promise<TData>;
};

export type ApiWriteMethod = {
  <
    TBodySchema extends OptionalSchema = undefined,
    TResponseSchema extends z.ZodType = z.ZodType,
    TResult = SchemaOutput<TResponseSchema>
  >(
    path: string,
    options: ApiWriteOptions<TBodySchema, TResponseSchema, TResult> & {
      responseSchema: TResponseSchema;
    }
  ): Promise<TResult>;
  <
    TData = unknown,
    TBodySchema extends OptionalSchema = undefined
  >(
    path: string,
    options?: ApiWriteOptions<TBodySchema, undefined, TData>
  ): Promise<TData>;
};

export type ApiRequest = {
  <
    TBodySchema extends OptionalSchema = undefined,
    TResponseSchema extends z.ZodType = z.ZodType,
    TResult = SchemaOutput<TResponseSchema>
  >(
    method: ApiMethod,
    path: string,
    options: ApiRequestOptions<TBodySchema, TResponseSchema, TResult> & {
      responseSchema: TResponseSchema;
    }
  ): Promise<TResult>;
  <
    TData = unknown,
    TBodySchema extends OptionalSchema = undefined
  >(
    method: ApiMethod,
    path: string,
    options?: ApiRequestOptions<TBodySchema, undefined, TData>
  ): Promise<TData>;
};

export type ApiFetcherOptions = Readonly<{
  auth   ?: ApiAuthOptions;
  baseURL?: string;
  fetch  ?: FetchLike;
  headers?: ApiHeadersInit;
  hooks  ?: ApiHooks;
  logging?: ApiLogging;
  retry  ?: ApiRetry;
  timeout?: number;
}>;

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
}>;

// Endpoint types
export type EndpointParams<TParamsSchema extends OptionalSchema> =
  TParamsSchema extends z.ZodType ? z.output<TParamsSchema> : undefined;

export type EndpointQuery<TParamsSchema extends OptionalSchema> =
  | QueryParams
  | ((params: EndpointParams<TParamsSchema>) => QueryParams | undefined);

export type EndpointHeaders<TParamsSchema extends OptionalSchema> =
  | ApiHeadersInit
  | ((params: EndpointParams<TParamsSchema>) => ApiHeadersInit | undefined);

export type ApiEndpointOptions<
  TParamsSchema extends OptionalSchema = undefined,
  TBodySchema extends OptionalSchema = undefined,
  TResponseSchema extends OptionalSchema = undefined,
  TResult = SchemaOutput<TResponseSchema>
> = Readonly<{
  auth          ?: boolean;
  bodySchema    ?: TBodySchema;
  headers       ?: EndpointHeaders<TParamsSchema>;
  params        ?: TParamsSchema;
  query         ?: EndpointQuery<TParamsSchema>;
  responseSchema?: TResponseSchema;
  retry         ?: ApiRetry;
  select        ?: (data: SchemaOutput<TResponseSchema>, response: Response) => TResult;
  timeout       ?: number;
}>;

export type ApiEndpoint<
  TParamsSchema extends OptionalSchema = OptionalSchema,
  TBodySchema extends OptionalSchema = OptionalSchema,
  TResponseSchema extends OptionalSchema = OptionalSchema,
  TResult = SchemaOutput<TResponseSchema>
> = Readonly<{
  method : ApiMethod;
  options: ApiEndpointOptions<
    TParamsSchema,
    TBodySchema,
    TResponseSchema,
    TResult
  >;
  path   : string;
}>;

export type AnyApiEndpoint = ApiEndpoint<any, any, any, any>;

export type EndpointFactory<TMethod extends ApiMethod> = {
  <
    const TParamsSchema extends OptionalSchema = undefined,
    const TBodySchema extends OptionalSchema = undefined,
    const TResponseSchema extends z.ZodType = z.ZodType,
    TResult = SchemaOutput<TResponseSchema>
  >(
    path: string,
    options: ApiEndpointOptions<
      TParamsSchema,
      TBodySchema,
      TResponseSchema,
      TResult
    > & { responseSchema: TResponseSchema }
  ): ApiEndpoint<TParamsSchema, TBodySchema, TResponseSchema, TResult>;
  <
    const TParamsSchema extends OptionalSchema = undefined,
    const TBodySchema extends OptionalSchema = undefined,
    TResult = unknown
  >(
    path: string,
    options?: ApiEndpointOptions<
      TParamsSchema,
      TBodySchema,
      undefined,
      TResult
    >
  ): ApiEndpoint<TParamsSchema, TBodySchema, undefined, TResult>;
  method: TMethod;
};

export type EndpointCallOverrides = Omit<
  ApiRequestOptions<undefined, undefined>,
  "body" | "bodySchema" | "responseSchema" | "select"
>;

export type EndpointParamsInput<TParamsSchema extends OptionalSchema> =
  TParamsSchema extends z.ZodType
    ? { params: z.input<TParamsSchema> }
    : { params?: undefined };

export type EndpointBodyInput<TBodySchema extends OptionalSchema> =
  TBodySchema extends z.ZodType
    ? { body: z.input<TBodySchema> }
    : { body?: undefined };

export type EndpointCallInput<
  TParamsSchema extends OptionalSchema,
  TBodySchema extends OptionalSchema
> = EndpointCallOverrides
  & EndpointBodyInput<TBodySchema>
  & EndpointParamsInput<TParamsSchema>;

export type EndpointCallArgs<TEndpoint extends AnyApiEndpoint> =
  TEndpoint extends ApiEndpoint<infer TParamsSchema, infer TBodySchema, any, any>
    ? TParamsSchema extends z.ZodType
      ? [input: EndpointCallInput<TParamsSchema, TBodySchema>]
      : TBodySchema extends z.ZodType
        ? [input: EndpointCallInput<TParamsSchema, TBodySchema>]
        : [input?: EndpointCallInput<TParamsSchema, TBodySchema>]
    : never;

export type EndpointResult<TEndpoint extends AnyApiEndpoint> =
  TEndpoint extends ApiEndpoint<any, any, any, infer TResult>
    ? TResult
    : never;
