import type { z } from "zod";

// HTTP types
export const HttpMethod = {
  GET   : "GET",
  POST  : "POST",
  PUT   : "PUT",
  PATCH : "PATCH",
  DELETE: "DELETE"
} as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

export type QueryValue = string | number | boolean | null | undefined;

export type QueryParams =
  | URLSearchParams
  | Array<[string, QueryValue]>
  | Record<string, QueryValue | QueryValue[]>;

export type ApiHeadersInit = ConstructorParameters<typeof Headers>[0];

export type HeaderFactory<TParams> = (params: TParams) => ApiHeadersInit | undefined;

// Schema types
export type AnySchema = z.ZodType;
export type OptionalSchema = z.ZodType | undefined;

export type SchemaInput<TSchema extends OptionalSchema> =
  TSchema extends z.ZodType ? z.input<TSchema> : unknown;

export type SchemaOutput<TSchema extends OptionalSchema> =
  TSchema extends z.ZodType ? z.output<TSchema> : unknown;

// Fetch types
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type AuthMode = boolean | "optional";

export type MaybePromise<T> = T | Promise<T>;

export type ApiRequestContext = Readonly<{
  method: HttpMethod;
  path  : string;
}>;

export type ApiRequestOptions<
  TRequestSchema extends OptionalSchema = undefined,
  TResponseSchema extends OptionalSchema = undefined,
  TResult = SchemaOutput<TResponseSchema>
> = Omit<RequestInit, "body" | "headers" | "method"> & {
  method        ?: HttpMethod;
  body          ?: SchemaInput<TRequestSchema>;
  requestSchema ?: TRequestSchema;
  responseSchema?: TResponseSchema;
  transform     ?: (data: SchemaOutput<TResponseSchema>) => TResult;
  baseUrl       ?: string;
  headers       ?: ApiHeadersInit;
  query         ?: QueryParams;
  accessToken   ?: string;
  auth          ?: AuthMode;
  retryOnUnauthorized?: boolean;
};

export type ApiRequest = <
  TRequestSchema extends OptionalSchema = undefined,
  TResponseSchema extends OptionalSchema = undefined,
  TResult = SchemaOutput<TResponseSchema>
>(
  path: string,
  options?: ApiRequestOptions<TRequestSchema, TResponseSchema, TResult>
) => Promise<TResult>;

// Token refresh types
export type TokenReader<TToken> = () => MaybePromise<TToken | null | undefined>;

export type TokenWriter<TToken> = (token: TToken) => MaybePromise<void>;

export type TokenClearer = () => MaybePromise<void>;

export type TokenRefresher<TToken> = (
  token: TToken | null | undefined
) => MaybePromise<TToken | null | undefined>;

export type TokenAuthOptions<TToken> = {
  getToken             : TokenReader<TToken>;
  getAccessToken       : (token: TToken) => string | undefined;
  refreshToken         : TokenRefresher<TToken>;
  setToken            ?: TokenWriter<TToken>;
  clearToken          ?: TokenClearer;
  shouldRefreshToken  ?: (token: TToken) => boolean;
  shouldRefreshOnError?: (error: unknown) => boolean;
  onRefreshError      ?: (error: unknown) => MaybePromise<void>;
};

export type ApiClientOptions<TToken = unknown> = {
  baseUrl              ?: string;
  headers              ?: ApiHeadersInit;
  fetch                ?: FetchLike;
  auth                 ?: AuthMode;
  accessToken          ?: string;
  retryOnUnauthorized  ?: boolean;
  token                ?: TokenAuthOptions<TToken>;
};

export type ApiClient<TToken = unknown> = Readonly<{
  request: ApiRequest;
  call   : ApiRequest;
  endpoint: <TEndpoint extends AnyApiEndpoint>(
    endpoint: TEndpoint
  ) => EndpointHandler<TEndpoint>;
  options: ApiClientOptions<TToken>;
}>;

// Endpoint types
export type EndpointInput<TParamsSchema extends OptionalSchema> =
  TParamsSchema extends z.ZodType ? z.input<TParamsSchema> : void | undefined;

export type EndpointParams<TParamsSchema extends OptionalSchema> =
  TParamsSchema extends z.ZodType ? z.output<TParamsSchema> : undefined;

export type EndpointResult<
  TResponseSchema extends OptionalSchema,
  TResultSchema extends OptionalSchema
> = TResultSchema extends z.ZodType
  ? z.output<TResultSchema>
  : SchemaOutput<TResponseSchema>;

export type ApiEndpointOptions<
  TParamsSchema extends OptionalSchema = undefined,
  TRequestSchema extends OptionalSchema = undefined,
  TResponseSchema extends OptionalSchema = undefined,
  TResultSchema extends OptionalSchema = undefined
> = Readonly<{
  path          : string | ((params: EndpointParams<TParamsSchema>) => string);
  method       ?: HttpMethod;
  paramsSchema ?: TParamsSchema;
  requestSchema?: TRequestSchema;
  responseSchema?: TResponseSchema;
  resultSchema ?: TResultSchema;
  mapBody      ?: (
    params: EndpointParams<TParamsSchema>
  ) => SchemaInput<TRequestSchema> | undefined;
  mapQuery     ?: (params: EndpointParams<TParamsSchema>) => QueryParams | undefined;
  mapHeaders   ?: HeaderFactory<EndpointParams<TParamsSchema>>;
  mapResult    ?: (
    response: SchemaOutput<TResponseSchema>
  ) => TResultSchema extends z.ZodType
    ? z.input<TResultSchema>
    : SchemaOutput<TResponseSchema>;
  auth         ?: AuthMode;
  retryOnUnauthorized?: boolean;
}>;

export type ApiEndpoint<
  TParamsSchema extends OptionalSchema = OptionalSchema,
  TRequestSchema extends OptionalSchema = OptionalSchema,
  TResponseSchema extends OptionalSchema = OptionalSchema,
  TResultSchema extends OptionalSchema = OptionalSchema
> = ApiEndpointOptions<
  TParamsSchema,
  TRequestSchema,
  TResponseSchema,
  TResultSchema
>;

export type AnyApiEndpoint = ApiEndpoint<any, any, any, any>;

export type EndpointCallOptions = Omit<
  ApiRequestOptions<undefined, undefined>,
  "body" | "method" | "requestSchema" | "responseSchema" | "transform"
>;

export type EndpointHandler<TEndpoint extends AnyApiEndpoint> =
  TEndpoint extends ApiEndpoint<
    infer TParamsSchema,
    OptionalSchema,
    infer TResponseSchema,
    infer TResultSchema
  >
    ? (
        params: EndpointInput<TParamsSchema>,
        options?: EndpointCallOptions
      ) => Promise<EndpointResult<TResponseSchema, TResultSchema>>
    : never;
