import {
  parseRequestBody,
  parseResponseBody,
  readResponseBody,
  validateMaxResponseBytes
} from "./body.js";
import type { ParsedRequestBody } from "./body.js";
import {
  ApiAbortError,
  ApiAuthError,
  ApiHttpError,
  ApiParseError,
  ApiResponseSizeError,
  ApiTimeoutError,
  ApiValidationError,
  getApiErrorCode,
  getApiMessage
} from "./errors.js";
import { executeEndpoint } from "./endpoint.js";
import { buildHeaders, mergeHeaders } from "./headers.js";
import { createApiLoggerHooks } from "./logging.js";
import { isTrustedRequestOrigin } from "./origin.js";
import { getRetryDelay, resolveRetryOptions } from "./retry.js";
import { buildApiUrl, redactApiUrl } from "./url.js";
import { ApiMethod } from "./types.js";
import { sleep } from "../promise/index.js";
import {
  createServerClock,
  createTimeSyncSample,
  parseServerDateHeader
} from "../time/index.js";
import type {
  AnyApiEndpoint,
  ApiAuthOptions,
  ApiErrorHookContext,
  ApiErrorFallback,
  ApiFetcher,
  ApiFetcherOptions,
  ApiHookContext,
  ApiResponse,
  ApiRequest,
  ApiRequestContext,
  ApiRequestOptions,
  ApiResponseHookContext,
  ApiResponsePayload,
  ApiRetryContext,
  ApiServerTimeOptions,
  ApiTimedRequestContext,
  ApiTokenHeaderFormatter,
  FetchLike,
  OptionalSchema,
  QueryParams,
  SchemaOutput
} from "./types.js";
import type { ResolvedRetryOptions } from "./retry.js";

const AUTH_REFRESH_STATUS_CODES = [401, 419] as const;
const DEFAULT_SERVER_TIME_HEADER = "Date";
const MISSING_ACCESS_TOKEN = Symbol("missing-access-token");

type ResolvedApiFetcherOptions = Omit<ApiFetcherOptions, "serverTime"> & {
  serverTime?: ApiServerTimeOptions;
};

type RequestExecutionState = {
  auth?: Readonly<{
    configured         : boolean;
    expectedAccessToken: string | null | undefined;
    used               : boolean;
  }>;
  networkAttempt: number;
  parsedBody     ?: ParsedRequestBody;
  retriesUsed   : number;
};

type PreparedApiRequestOptions<
  TBodySchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
> = Omit<
  ApiRequestOptions<TBodySchema, TResponseSchema, TResult>,
  "baseURL" | "query"
>;

type AccessTokenResolver = () => Promise<unknown>;

class AuthCallbackFailure extends Error {
  constructor() {
    super("Auth callback failed");

    this.name = "AuthCallbackFailure";
  }
}

class AuthWaitAbortError extends ApiAbortError {}

class AuthRefreshUnavailable extends Error {}

// Client factory
/** Creates api fetcher */
export const createApiFetcher = (
  options: ApiFetcherOptions = {}
): ApiFetcher => {
  const {
    baseURL: clientBaseURL,
    ...optionSnapshot
  } = options;
  const resolvedOptions: ApiFetcherOptions = {
    ...optionSnapshot,
    baseURL: clientBaseURL
  };
  const fetchImpl = resolvedOptions.fetch ?? globalThis.fetch;
  const serverTime = resolveApiServerTime(resolvedOptions.serverTime);
  const clientHooks = mergeHooks(
    createApiLoggerHooks(resolvedOptions.logging),
    resolvedOptions.hooks
  );
  const clientOptions: ResolvedApiFetcherOptions = {
    ...resolvedOptions,
    hooks: clientHooks,
    serverTime
  };
  const refreshPromises = new Map<
    string | typeof MISSING_ACCESS_TOKEN,
    Promise<unknown>
  >();

  const refreshOnce = async (
    error: unknown,
    failedAccessToken: string | null | undefined
  ): Promise<unknown> => {
    if (!resolvedOptions.auth?.refresh) {
      return null;
    }

    const refreshKey = failedAccessToken ?? MISSING_ACCESS_TOKEN;
    const activeRefresh = refreshPromises.get(refreshKey);

    if (activeRefresh) {
      return activeRefresh;
    }

    const refreshPromise = Promise.resolve()
      .then(() => resolvedOptions.auth?.refresh?.(error, failedAccessToken));

    refreshPromises.set(refreshKey, refreshPromise);
    refreshPromise.then(
      () => refreshPromises.delete(refreshKey),
      () => refreshPromises.delete(refreshKey)
    );

    return refreshPromise;
  };

  const request = (async <
    TBodySchema extends OptionalSchema = undefined,
    TResponseSchema extends OptionalSchema = undefined,
    TResult = ApiResponse<ApiResponsePayload<SchemaOutput<TResponseSchema>>>
  >(
    method: ApiMethod,
    path: string,
    requestOptions: ApiRequestOptions<TBodySchema, TResponseSchema, TResult> = (
      {} as ApiRequestOptions<TBodySchema, TResponseSchema, TResult>
    )
  ): Promise<TResult> => {
    const {
      baseURL: requestBaseURL,
      query,
      snapshot
    } = snapshotRequestOptions(requestOptions);
    const resolvedURL = buildApiUrl(
      path,
      requestBaseURL ?? clientBaseURL,
      query
    );
    const trustedOrigin = isTrustedRequestOrigin(
      resolvedURL,
      clientBaseURL,
      resolvedOptions.allowedOrigins
    );
    const authContext = {
      method,
      path: redactApiUrl(path),
      url: redactApiUrl(resolvedURL)
    };
    const authEnabled = snapshot.auth !== false
      && resolvedOptions.auth !== undefined
      && trustedOrigin;
    const executionState: RequestExecutionState = {
      networkAttempt: 0,
      retriesUsed   : 0
    };

    const initialAccessTokenResolver = authEnabled
      ? createAccessTokenResolver(resolvedOptions.auth)
      : undefined;

    try {
      return await sendRequest(
        method,
        path,
        resolvedURL,
        snapshot,
        clientOptions,
        fetchImpl,
        initialAccessTokenResolver,
        trustedOrigin,
        executionState
      );
    } catch (error) {
      if (error instanceof AuthWaitAbortError) {
        throw error;
      }

      if (error instanceof AuthCallbackFailure) {
        return throwAuthCallbackError(
          resolvedOptions.auth,
          authContext,
          executionState.auth?.expectedAccessToken
        );
      }

      if (!executionState.auth?.configured) {
        throw error;
      }

      let authFailure: boolean;

      try {
        authFailure = isAuthFailure(error, resolvedOptions);
      } catch (classificationError) {
        return throwAuthCallbackError(
          resolvedOptions.auth,
          authContext,
          executionState.auth.expectedAccessToken
        );
      }

      if (!authFailure) {
        throw error;
      }

      const failedAccessToken = executionState.auth.expectedAccessToken;

      if (!resolvedOptions.auth?.refresh || !isRequestBodyReplayable(snapshot)) {
        return throwAuthError(
          resolvedOptions.auth,
          error,
          authContext,
          failedAccessToken
        );
      }

      let refreshedAccessToken: unknown;
      let refreshError: unknown;

      try {
        refreshedAccessToken = await waitForSignal(
          refreshOnce(error, failedAccessToken),
          snapshot.signal,
          authContext
        );
      } catch (nextRefreshError) {
        if (snapshot.signal?.aborted) {
          throw new AuthWaitAbortError(
            snapshot.signal.reason,
            authContext
          );
        }

        refreshError = nextRefreshError;
      }

      const retryAccessTokenResolver = createRetryAccessTokenResolver(
        resolvedOptions.auth,
        failedAccessToken,
        refreshedAccessToken,
        refreshError
      );

      try {
        return await sendRequest(
          method,
          path,
          resolvedURL,
          snapshot,
          clientOptions,
          fetchImpl,
          retryAccessTokenResolver,
          trustedOrigin,
          executionState
        );
      } catch (retryError) {
        if (retryError instanceof AuthWaitAbortError) {
          throw retryError;
        }

        if (retryError instanceof AuthRefreshUnavailable) {
          return throwAuthError(
            resolvedOptions.auth,
            error,
            authContext,
            failedAccessToken
          );
        }

        if (retryError instanceof AuthCallbackFailure) {
          return throwAuthCallbackError(
            resolvedOptions.auth,
            authContext,
            executionState.auth?.expectedAccessToken ?? failedAccessToken
          );
        }

        if (!executionState.auth?.configured) {
          throw retryError;
        }

        let retryAuthFailure: boolean;

        try {
          retryAuthFailure = isAuthFailure(retryError, resolvedOptions);
        } catch (classificationError) {
          return throwAuthCallbackError(
            resolvedOptions.auth,
            authContext,
            executionState.auth.expectedAccessToken
          );
        }

        if (!retryAuthFailure) {
          throw retryError;
        }

        return throwAuthError(
          resolvedOptions.auth,
          retryError,
          authContext,
          executionState.auth.expectedAccessToken
        );
      }
    }
  }) as ApiRequest;

  return Object.freeze({
    call: (apiEndpoint: AnyApiEndpoint, ...args: any[]) => (
      executeEndpoint(request, apiEndpoint, args[0])
    ),
    delete : createMethod(request, ApiMethod.DELETE),
    get    : createMethod(request, ApiMethod.GET),
    options: Object.freeze({ ...resolvedOptions }),
    patch  : createMethod(request, ApiMethod.PATCH),
    post   : createMethod(request, ApiMethod.POST),
    put    : createMethod(request, ApiMethod.PUT),
    request,
    serverTime: serverTime?.clock
  }) as ApiFetcher;
};

const createMethod = (
  request: ApiRequest,
  method: ApiMethod
) => (
  path: string,
  options?: ApiRequestOptions
) => (
  request as unknown as (
    method: ApiMethod,
    path: string,
    options?: ApiRequestOptions
  ) => Promise<unknown>
)(method, path, options);

const snapshotRequestOptions = <
  TBodySchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  options: ApiRequestOptions<TBodySchema, TResponseSchema, TResult>
): Readonly<{
  baseURL?: string;
  query?: QueryParams;
  snapshot: PreparedApiRequestOptions<TBodySchema, TResponseSchema, TResult>;
}> => {
  const {
    baseURL,
    query,
    ...snapshot
  } = options;

  return {
    baseURL,
    query,
    snapshot
  };
};

// Request execution
const sendRequest = async <
  TBodySchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  method: ApiMethod,
  path: string,
  resolvedURL: string,
  options: PreparedApiRequestOptions<TBodySchema, TResponseSchema, TResult>,
  clientOptions: ResolvedApiFetcherOptions,
  fetchImpl: FetchLike,
  accessTokenResolver: AccessTokenResolver | undefined,
  trustedOrigin: boolean,
  executionState: RequestExecutionState
): Promise<TResult> => {
  const {
    auth: _auth,
    body: _body,
    bodySchema: _bodySchema,
    errorFallback,
    headers,
    hooks,
    maxResponseBytes,
    rawBody: _rawBody,
    rawBodyFactory: _rawBodyFactory,
    responseSchema,
    retry,
    select,
    timeout,
    ...fetchOptions
  } = options;
  const startedAt = Date.now();
  const context = {
    method,
    path: redactApiUrl(path),
    startedAt,
    url: redactApiUrl(resolvedURL)
  };
  const retryOptions  = resolveRetryOptions(retry ?? clientOptions.retry);
  const timeoutMs     = timeout ?? clientOptions.timeout;
  const responseLimit = validateMaxResponseBytes(
    maxResponseBytes ?? clientOptions.maxResponseBytes
  );
  const bodyReplayable = isRequestBodyReplayable(options);
  let parsedBody = await getRequestBody(
    options as ApiRequestOptions<TBodySchema, TResponseSchema, TResult>,
    context,
    executionState
  );
  const mergedHeaders = mergeHeaders(clientOptions.headers, headers);

  if (!trustedOrigin) {
    mergedHeaders?.delete("Authorization");
    mergedHeaders?.delete("Proxy-Authorization");
  }

  await callRequestHooks(clientOptions.hooks?.onRequest, hooks?.onRequest, context);

  for (let attempt = 0; ; attempt += 1) {
    if (attempt > 0) {
      parsedBody = await getRequestBody(
        options as ApiRequestOptions<TBodySchema, TResponseSchema, TResult>,
        context,
        executionState
      );
    }

    const signal = createRequestSignal(fetchOptions.signal, timeoutMs);
    let response: Response | undefined;
    let responseBody: unknown;
    let configuredAuthEnabled = false;

    try {
      const hasExplicitAuthHeader = mergedHeaders?.has("Authorization") === true
        || mergedHeaders?.has("Proxy-Authorization") === true;
      const shouldResolveAccessToken = accessTokenResolver !== undefined
        && !hasExplicitAuthHeader;
      const accessToken = shouldResolveAccessToken
        ? await resolveAttemptAccessToken(
          accessTokenResolver,
          fetchOptions.signal,
          context,
          executionState
        )
        : undefined;

      if (!shouldResolveAccessToken) {
        executionState.auth = {
          configured         : false,
          expectedAccessToken: undefined,
          used               : false
        };
      }

      const builtHeaders = buildHeaders(
        mergedHeaders,
        accessToken,
        parsedBody.isJsonBody,
        createSafeTokenHeaderFormatter(clientOptions.auth?.formatTokenHeader)
      );

      configuredAuthEnabled = shouldResolveAccessToken
        && (accessToken === undefined || builtHeaders.authApplied);
      executionState.auth = {
        configured         : configuredAuthEnabled,
        expectedAccessToken: executionState.auth?.expectedAccessToken,
        used               : shouldResolveAccessToken && builtHeaders.authApplied
      };

      const clientSendTimeMs = getServerTimeNow(clientOptions.serverTime);

      response = await fetchImpl(resolvedURL, {
        ...fetchOptions,
        body: parsedBody.body,
        headers: builtHeaders.headers,
        method,
        signal: signal.signal
      });
      updateServerTimeClock(
        clientOptions.serverTime,
        response,
        clientSendTimeMs,
        getServerTimeNow(clientOptions.serverTime)
      );

      try {
        responseBody = await readResponseBody(response, context, responseLimit);
      } catch (responseError) {
        const isUnreadableAuthResponse = !response.ok
          && configuredAuthEnabled
          && AUTH_REFRESH_STATUS_CODES.includes(response.status as 401 | 419)
          && (
            responseError instanceof ApiParseError
            || responseError instanceof ApiResponseSizeError
          );

        if (!isUnreadableAuthResponse) {
          throw responseError;
        }

        const resolvedErrorFallback = resolveErrorFallback(
          clientOptions.errorFallback,
          errorFallback
        );
        const error = new ApiHttpError(response, undefined, context, {
          code   : resolvedErrorFallback?.code,
          message: resolvedErrorFallback?.message
        });

        await callErrorHooks(
          clientOptions.hooks?.onResponseError,
          hooks?.onResponseError,
          {
            ...context,
            durationMs: getDurationMs(context),
            error,
            response
          }
        );

        throw error;
      }

      if (!response.ok) {
        const resolvedErrorFallback = resolveErrorFallback(
          clientOptions.errorFallback,
          errorFallback
        );
        const error = new ApiHttpError(
          response,
          responseBody,
          context,
          {
            code   : getApiErrorCode(responseBody) ?? resolvedErrorFallback?.code,
            message: resolvedErrorFallback?.message
          }
        );

        await callErrorHooks(
          clientOptions.hooks?.onResponseError,
          hooks?.onResponseError,
          {
            ...context,
            data: responseBody,
            durationMs: getDurationMs(context),
            error,
            response
          }
        );

        if (await shouldRetryRequest({
          attempt: executionState.retriesUsed,
          authEnabled: configuredAuthEnabled,
          bodyReplayable,
          context,
          error,
          method,
          response,
          retryOptions
        })) {
          executionState.retriesUsed += 1;
          signal.cleanup();
          await waitForRetry(retryOptions, {
            ...context,
            attempt: executionState.retriesUsed,
            error,
            response,
            status: response.status
          }, fetchOptions.signal);
          continue;
        }

        throw error;
      }

      const parsedResponse = parseResponseBody(
        responseBody,
        responseSchema,
        context
      ) as SchemaOutput<TResponseSchema>;
      const result         = select
        ? select(parsedResponse, response)
        : createApiResponse(parsedResponse, response, responseBody) as TResult;

      await callResponseHooks(clientOptions.hooks?.onResponse, hooks?.onResponse, {
        ...context,
        data: parsedResponse,
        durationMs: getDurationMs(context),
        response
      });

      return result;
    } catch (error) {
      const nextError = signal.isTimedOut()
        ? new ApiTimeoutError(timeoutMs ?? 0, context)
        : fetchOptions.signal?.aborted
          ? new ApiAbortError(fetchOptions.signal.reason, context)
          : error;

      if (nextError instanceof ApiHttpError) {
        throw nextError;
      }

      if (isResponseProcessingError(nextError) && response) {
        await callErrorHooks(
          clientOptions.hooks?.onResponseError,
          hooks?.onResponseError,
          {
            ...context,
            data: responseBody,
            durationMs: getDurationMs(context),
            error: nextError,
            response
          }
        );

        throw nextError;
      }

      await callErrorHooks(
        clientOptions.hooks?.onRequestError,
        hooks?.onRequestError,
        {
          ...context,
          durationMs: getDurationMs(context),
          error: nextError
        }
      );

      if (await shouldRetryRequest({
        attempt: executionState.retriesUsed,
        authEnabled: configuredAuthEnabled,
        bodyReplayable,
        context,
        error: nextError,
        method,
        retryOptions
      })) {
        executionState.retriesUsed += 1;
        signal.cleanup();
        await waitForRetry(retryOptions, {
          ...context,
          attempt: executionState.retriesUsed,
          error: nextError
        }, fetchOptions.signal);
        continue;
      }

      throw nextError;
    } finally {
      signal.cleanup();
    }
  }
};

const createApiResponse = <TData>(
  data: TData,
  httpResponse: Response,
  responseBody: unknown
): ApiResponse<ApiResponsePayload<TData>> => {
  const message         = getApiMessage(responseBody);
  const responsePayload = getApiResponsePayload(data);

  if (message === undefined) {
    return {
      code    : httpResponse.status,
      response: responsePayload
    };
  }

  return {
    code: httpResponse.status,
    message,
    response: responsePayload
  };
};

const getApiResponsePayload = <TData>(data: TData): ApiResponsePayload<TData> => (
  isApiResponseEnvelope(data)
    ? data.data as ApiResponsePayload<TData>
    : data as ApiResponsePayload<TData>
);

const isApiResponseEnvelope = (
  data: unknown
): data is { data: unknown } => (
  typeof data === "object"
  && data !== null
  && "data" in data
  && ("code" in data || "message" in data)
);

const resolveErrorFallback = (
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

const isResponseProcessingError = (
  error: unknown
): error is ApiParseError | ApiResponseSizeError | ApiValidationError => (
  error instanceof ApiParseError
  || error instanceof ApiResponseSizeError
  || (error instanceof ApiValidationError && error.target === "response")
);

// Auth helpers
const createAccessTokenResolver = (
  auth: ApiAuthOptions | undefined
): AccessTokenResolver => () => Promise.resolve()
  .then(() => auth?.getAccessToken());

const createRetryAccessTokenResolver = (
  auth: ApiAuthOptions | undefined,
  failedAccessToken: string | null | undefined,
  refreshedAccessToken: unknown,
  refreshError: unknown
): AccessTokenResolver => async () => {
  const currentAccessToken = await auth?.getAccessToken();
  const currentGeneration = normalizeComparableAccessToken(currentAccessToken);

  if (currentGeneration !== failedAccessToken) {
    return currentAccessToken;
  }

  if (refreshError !== undefined) {
    throw new AuthCallbackFailure();
  }

  const refreshResult = readUsableAccessToken(refreshedAccessToken);

  if (!refreshResult.ok) {
    if ("absent" in refreshResult && refreshResult.absent) {
      throw new AuthRefreshUnavailable();
    }

    throw new AuthCallbackFailure();
  }

  return refreshResult.token;
};

const resolveAttemptAccessToken = async (
  resolver: AccessTokenResolver,
  signal: AbortSignal | null | undefined,
  context: ApiRequestContext,
  state: RequestExecutionState
): Promise<string | undefined> => {
  let value: unknown;

  try {
    value = await waitForSignal(
      Promise.resolve().then(resolver),
      signal,
      context
    );
  } catch (error) {
    if (signal?.aborted) {
      throw new AuthWaitAbortError(signal.reason, context);
    }

    if (
      error instanceof AuthCallbackFailure
      || error instanceof AuthRefreshUnavailable
    ) {
      throw error;
    }

    throw new AuthCallbackFailure();
  }

  const expectedAccessToken = normalizeComparableAccessToken(value);

  state.auth = {
    configured: true,
    expectedAccessToken,
    used      : false
  };

  const result = readUsableAccessToken(value);

  if (!result.ok) {
    if ("absent" in result && result.absent) {
      return undefined;
    }

    throw new AuthCallbackFailure();
  }

  state.auth = {
    configured: true,
    expectedAccessToken: result.token,
    used      : false
  };

  return result.token;
};

const isAuthFailure = (
  error: unknown,
  options: ApiFetcherOptions
): boolean => {
  if (!options.auth) {
    return false;
  }

  if (options.auth.shouldRefreshOnError) {
    return options.auth.shouldRefreshOnError(error);
  }

  return error instanceof ApiHttpError
    && AUTH_REFRESH_STATUS_CODES.includes(error.status as 401 | 419);
};

const throwAuthError = (
  auth: ApiAuthOptions | undefined,
  cause: unknown,
  context: ApiRequestContext,
  expectedAccessToken: string | null | undefined
): never => {
  scheduleGenerationClear(auth, expectedAccessToken);

  throw new ApiAuthError("API authentication failed", cause, context);
};

const throwAuthCallbackError = (
  auth: ApiAuthOptions | undefined,
  context: ApiRequestContext,
  expectedAccessToken: string | null | undefined
): never => throwAuthError(
  auth,
  { type: "AUTH_CALLBACK_FAILURE" },
  context,
  expectedAccessToken
);

const scheduleGenerationClear = (
  auth: ApiAuthOptions | undefined,
  expectedAccessToken: string | null | undefined
): void => {
  if (!auth?.clear) {
    return;
  }

  void Promise.resolve()
    .then(() => auth.getAccessToken())
    .then((currentAccessToken) => {
      if (
        normalizeComparableAccessToken(currentAccessToken)
        !== expectedAccessToken
      ) {
        return;
      }

      return auth.clear?.(expectedAccessToken);
    })
    .catch(() => {
      // Session clearing is best effort and must not replace the primary failure
    });
};

const normalizeComparableAccessToken = (
  value: unknown
): string | null | undefined => {
  if (typeof value === "string") {
    return value.trim();
  }

  return value === null ? null : undefined;
};

type AccessTokenResult =
  | Readonly<{ ok: true; token: string }>
  | Readonly<{
    absent: boolean;
    error : TypeError;
    ok    : false;
  }>;

const readUsableAccessToken = (value: unknown): AccessTokenResult => {
  if (value === null || value === undefined) {
    return {
      absent: true,
      error : new TypeError("Auth callback did not return an access token"),
      ok    : false
    };
  }

  if (
    typeof value !== "string"
    || value.trim() === ""
    || /[\u0000-\u001f\u007f]/.test(value)
    || !isHeaderSafeAccessToken(value.trim())
  ) {
    return {
      absent: false,
      error : new TypeError("Auth callback returned an unusable access token"),
      ok    : false
    };
  }

  return {
    ok   : true,
    token: value.trim()
  };
};

const isHeaderSafeAccessToken = (value: string): boolean => {
  try {
    new Headers({
      Authorization: `Bearer ${value}`
    });

    return true;
  } catch {
    return false;
  }
};

const createSafeTokenHeaderFormatter = (
  formatter: ApiTokenHeaderFormatter | undefined
): ApiTokenHeaderFormatter | undefined => {
  if (!formatter) {
    return undefined;
  }

  return (accessToken) => {
    try {
      const headers = formatter(accessToken);

      return headers === null || headers === undefined
        ? headers
        : new Headers(headers);
    } catch {
      throw new AuthCallbackFailure();
    }
  };
};

const waitForSignal = <TValue>(
  promise: Promise<TValue>,
  signal: AbortSignal | null | undefined,
  context: ApiRequestContext
): Promise<TValue> => {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(new AuthWaitAbortError(signal.reason, context));
  }

  return new Promise<TValue>((resolve, reject) => {
    const cleanup = (): void => {
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = (): void => {
      cleanup();
      reject(new AuthWaitAbortError(signal.reason, context));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      }
    );
  });
};

// Server time helpers
const resolveApiServerTime = (
  serverTime: ApiFetcherOptions["serverTime"]
): ApiServerTimeOptions | undefined => {
  if (!serverTime) {
    return undefined;
  }

  if (serverTime === true) {
    return {
      clock: createServerClock()
    };
  }

  return serverTime;
};

const getServerTimeNow = (
  options: ApiServerTimeOptions | undefined
): number => (
  options?.now?.() ?? Date.now()
);

const updateServerTimeClock = (
  options: ApiServerTimeOptions | undefined,
  response: Response,
  clientSendTimeMs: number,
  clientReceiveTimeMs: number
): void => {
  if (!options) {
    return;
  }

  const serverTimeMs = parseApiServerTimeHeader(
    response.headers.get(options.header ?? DEFAULT_SERVER_TIME_HEADER)
  );

  if (serverTimeMs === undefined) {
    return;
  }

  options.clock.update(createTimeSyncSample({
    clientSendTimeMs,
    serverReceiveTimeMs : serverTimeMs,
    serverTransmitTimeMs: serverTimeMs,
    clientReceiveTimeMs
  }));
};

const parseApiServerTimeHeader = (
  value: string | null
): number | undefined => {
  if (!value || value.trim() === "") {
    return undefined;
  }

  const dateTimeMs = parseServerDateHeader(value);

  if (dateTimeMs !== undefined) {
    return dateTimeMs;
  }

  const timeMs = Number(value);

  return Number.isFinite(timeMs) ? timeMs : undefined;
};

const shouldRetryRequest = async ({
  attempt,
  authEnabled,
  bodyReplayable,
  context,
  error,
  method,
  response,
  retryOptions
}: Readonly<{
  attempt       : number;
  authEnabled   : boolean;
  bodyReplayable: boolean;
  context       : ApiRequestContext;
  error         : unknown;
  method        : ApiMethod;
  response     ?: Response;
  retryOptions  : ResolvedRetryOptions;
}>): Promise<boolean> => {
  if (!bodyReplayable || error instanceof ApiAbortError) {
    return false;
  }

  const retryContext = {
    ...context,
    attempt: attempt + 1,
    error,
    response,
    status : response?.status
  };
  const customDecision = await retryOptions.shouldRetry?.(retryContext);

  if (customDecision !== undefined) {
    return customDecision && attempt < retryOptions.limit;
  }

  if (attempt >= retryOptions.limit) {
    return false;
  }

  if (!retryOptions.methods.includes(method)) {
    return false;
  }

  if (!(error instanceof ApiHttpError)) {
    return false;
  }

  if (authEnabled && AUTH_REFRESH_STATUS_CODES.includes(error.status as 401 | 419)) {
    return false;
  }

  return retryOptions.statusCodes.includes(error.status);
};

const isRequestBodyReplayable = (
  options: Pick<ApiRequestOptions, "rawBody" | "rawBodyFactory">
): boolean => (
  options.rawBodyFactory !== undefined
  || !isOneShotStream(options.rawBody)
);

const isOneShotStream = (value: unknown): boolean => (
  typeof value === "object"
  && value !== null
  && typeof (value as { getReader?: unknown }).getReader === "function"
);

const getRequestBody = async <
  TBodySchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  options: ApiRequestOptions<TBodySchema, TResponseSchema, TResult>,
  context: ApiRequestContext,
  state: RequestExecutionState
): Promise<ParsedRequestBody> => {
  state.networkAttempt += 1;

  if (options.rawBodyFactory) {
    return parseRequestBody(options, context, state.networkAttempt);
  }

  if (!state.parsedBody) {
    state.parsedBody = await parseRequestBody(options, context, state.networkAttempt);
  }

  return state.parsedBody;
};

const waitForRetry = async (
  options: ResolvedRetryOptions,
  context: ApiRetryContext,
  signal: AbortSignal | null | undefined
): Promise<void> => {
  const delay = getRetryDelay(options, context, Date.now(), Math.random());

  try {
    if (delay <= 0) {
      if (signal?.aborted) {
        await sleep(0, { signal });
      }

      return;
    }

    await sleep(delay, { signal: signal ?? undefined });
  } catch (error) {
    if (signal?.aborted) {
      throw new ApiAbortError(signal.reason, context);
    }

    throw error;
  }
};

// Signal helpers
const createRequestSignal = (
  sourceSignal: AbortSignal | null | undefined,
  timeout: number | undefined
): Readonly<{
  cleanup   : () => void;
  isTimedOut: () => boolean;
  signal    : AbortSignal | undefined;
}> => {
  if (!timeout || timeout <= 0) {
    return {
      cleanup   : () => undefined,
      isTimedOut: () => false,
      signal    : sourceSignal ?? undefined
    };
  }

  const controller = new AbortController();
  let timedOut     = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const abortFromSource = (): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    controller.abort(sourceSignal?.reason);
  };
  timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);

  if (sourceSignal?.aborted) {
    abortFromSource();
  } else {
    sourceSignal?.addEventListener("abort", abortFromSource, {
      once: true
    });
  }

  return {
    cleanup: () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      sourceSignal?.removeEventListener("abort", abortFromSource);
    },
    isTimedOut: () => timedOut,
    signal    : controller.signal
  };
};

const getDurationMs = (context: ApiTimedRequestContext): number => (
  Math.max(0, Date.now() - context.startedAt)
);

// Hook helpers
const mergeHooks = (
  ...sources: Array<ApiFetcherOptions["hooks"] | undefined>
): ApiFetcherOptions["hooks"] | undefined => {
  const hooks = sources.filter(hasAnyHook);

  if (hooks.length === 0) {
    return undefined;
  }

  return {
    onRequest: async (context) => {
      for (const hook of hooks) {
        await hook.onRequest?.(context);
      }
    },
    onRequestError: async (context) => {
      for (const hook of hooks) {
        await hook.onRequestError?.(context);
      }
    },
    onResponse: async (context) => {
      for (const hook of hooks) {
        await hook.onResponse?.(context);
      }
    },
    onResponseError: async (context) => {
      for (const hook of hooks) {
        await hook.onResponseError?.(context);
      }
    }
  };
};

const hasAnyHook = (
  source: ApiFetcherOptions["hooks"] | undefined
): source is NonNullable<ApiFetcherOptions["hooks"]> => (
  source?.onRequest !== undefined
  || source?.onRequestError !== undefined
  || source?.onResponse !== undefined
  || source?.onResponseError !== undefined
);

const callRequestHooks = async (
  ...args: [
    ...hooks: Array<((context: ApiHookContext) => unknown) | undefined>,
    context: ApiHookContext
  ]
): Promise<void> => {
  const context = args[args.length - 1] as ApiHookContext;
  const hooks   = args.slice(0, -1) as Array<((context: ApiHookContext) => unknown) | undefined>;

  for (const hook of hooks) {
    await hook?.(context);
  }
};

const callResponseHooks = async (
  ...args: [
    ...hooks: Array<((context: ApiResponseHookContext) => unknown) | undefined>,
    context: ApiResponseHookContext
  ]
): Promise<void> => {
  const context = args[args.length - 1] as ApiResponseHookContext;
  const hooks   = args.slice(0, -1) as Array<((context: ApiResponseHookContext) => unknown) | undefined>;

  for (const hook of hooks) {
    await hook?.(context);
  }
};

const callErrorHooks = async (
  ...args: [
    ...hooks: Array<((context: ApiErrorHookContext) => unknown) | undefined>,
    context: ApiErrorHookContext
  ]
): Promise<void> => {
  const context = args[args.length - 1] as ApiErrorHookContext;
  const hooks   = args.slice(0, -1) as Array<((context: ApiErrorHookContext) => unknown) | undefined>;

  for (const hook of hooks) {
    await hook?.(context);
  }
};
