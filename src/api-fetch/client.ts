import { readResponseBody, parseRequestBody, parseResponseBody } from "./body.js";
import { ApiHttpError } from "./errors.js";
import { executeEndpoint } from "./endpoint.js";
import { buildHeaders, mergeHeaders } from "./headers.js";
import { buildApiUrl } from "./url.js";
import { HttpMethod } from "./types.js";
import type {
  ApiClient,
  ApiClientOptions,
  AnyApiEndpoint,
  ApiRequest,
  ApiRequestOptions,
  EndpointHandler,
  FetchLike,
  OptionalSchema,
  SchemaOutput
} from "./types.js";

// Client factory
export const createApiClient = <TToken = unknown>(
  options: ApiClientOptions<TToken> = {}
): ApiClient<TToken> => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  let refreshPromise: Promise<TToken | null | undefined> | null = null;

  const refreshOnce = async (
    token: TToken | null | undefined
  ): Promise<TToken | null | undefined> => {
    if (!options.token) {
      return null;
    }

    if (!refreshPromise) {
      refreshPromise = Promise.resolve(options.token.refreshToken(token))
        .then(async (nextToken) => {
          if (nextToken) {
            await options.token?.setToken?.(nextToken);
          }

          return nextToken;
        })
        .catch(async (error) => {
          await options.token?.clearToken?.();
          await options.token?.onRefreshError?.(error);
          throw error;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    return refreshPromise;
  };

  const request: ApiRequest = async <
    TRequestSchema extends OptionalSchema = undefined,
    TResponseSchema extends OptionalSchema = undefined,
    TResult = SchemaOutput<TResponseSchema>
  >(
    path: string,
    requestOptions: ApiRequestOptions<TRequestSchema, TResponseSchema, TResult> = {}
  ): Promise<TResult> => {
    const authMode = requestOptions.auth ?? options.auth ?? (options.token ? true : false);

    if (authMode === false) {
      return sendRequest(path, requestOptions, options, fetchImpl, requestOptions.accessToken);
    }

    const currentToken = await options.token?.getToken();
    const activeToken  = currentToken && options.token?.shouldRefreshToken?.(currentToken)
      ? await refreshOnce(currentToken)
      : currentToken;
    const accessToken  = activeToken
      ? options.token?.getAccessToken(activeToken)
      : requestOptions.accessToken ?? options.accessToken;

    try {
      return await sendRequest(path, requestOptions, options, fetchImpl, accessToken);
    } catch (error) {
      if (!shouldRetryWithRefresh(error, requestOptions, options)) {
        throw error;
      }

      const nextToken       = await refreshOnce(activeToken ?? currentToken);
      const nextAccessToken = nextToken ? options.token?.getAccessToken(nextToken) : undefined;

      if (!nextAccessToken) {
        throw error;
      }

      return sendRequest(path, requestOptions, options, fetchImpl, nextAccessToken);
    }
  };
  const endpoint = <TEndpoint extends AnyApiEndpoint>(
    apiEndpoint: TEndpoint
  ): EndpointHandler<TEndpoint> => {
    const handler = (
      params: Parameters<EndpointHandler<TEndpoint>>[0],
      callOptions?: Parameters<EndpointHandler<TEndpoint>>[1]
    ) => executeEndpoint(request, apiEndpoint, params, callOptions);

    return handler as EndpointHandler<TEndpoint>;
  };

  return Object.freeze({
    request,
    call    : request,
    endpoint,
    options : Object.freeze({ ...options })
  }) as ApiClient<TToken>;
};

// Request execution
const sendRequest = async <
  TToken,
  TRequestSchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  path: string,
  options: ApiRequestOptions<TRequestSchema, TResponseSchema, TResult>,
  clientOptions: ApiClientOptions<TToken>,
  fetchImpl: FetchLike,
  accessToken: string | undefined
): Promise<TResult> => {
  const {
    method = HttpMethod.GET,
    responseSchema,
    transform,
    baseUrl,
    headers,
    query,
    cache,
    accessToken: _accessToken,
    auth: _auth,
    retryOnUnauthorized: _retryOnUnauthorized,
    ...fetchOptions
  } = options;
  const context = {
    method,
    path
  };

  const body     = parseRequestBody(options, context);
  const response = await fetchImpl(buildApiUrl(path, baseUrl ?? clientOptions.baseUrl, query), {
    ...fetchOptions,
    method,
    headers: buildHeaders(
      mergeHeaders(clientOptions.headers, headers),
      accessToken,
      body !== undefined
    ),
    body   : body === undefined ? undefined : JSON.stringify(body),
    cache
  });
  const responseBody = await readResponseBody(response, context);

  if (!response.ok) {
    throw new ApiHttpError(response, responseBody, context);
  }

  const parsedResponse = parseResponseBody(
    responseBody,
    responseSchema as TResponseSchema,
    context
  );

  if (transform) {
    return transform(parsedResponse);
  }

  return parsedResponse as TResult;
};

// Auth helpers
const shouldRetryWithRefresh = <TToken>(
  error: unknown,
  requestOptions: Pick<ApiRequestOptions, "retryOnUnauthorized">,
  clientOptions: ApiClientOptions<TToken>
): boolean => {
  if (!clientOptions.token) {
    return false;
  }

  if (requestOptions.retryOnUnauthorized === false) {
    return false;
  }

  if (clientOptions.retryOnUnauthorized === false) {
    return false;
  }

  if (clientOptions.token.shouldRefreshOnError) {
    return clientOptions.token.shouldRefreshOnError(error);
  }

  return error instanceof ApiHttpError && (error.status === 401 || error.status === 419);
};
