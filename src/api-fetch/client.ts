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
  networkAttempt: number;
  parsedBody     ?: ParsedRequestBody;
  retriesUsed   : number;
};

class AuthCallbackFailure extends Error {
  constructor() {
    super("Auth callback failed");

    this.name = "AuthCallbackFailure";
  }
}

class AuthWaitAbortError extends ApiAbortError {}

// Client factory
/** Creates api fetcher */
export const createApiFetcher = (
  options: ApiFetcherOptions = {}
): ApiFetcher => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const serverTime = resolveApiServerTime(options.serverTime);
  const clientHooks = mergeHooks(
    createApiLoggerHooks(options.logging),
    options.hooks
  );
  const clientOptions: ResolvedApiFetcherOptions = {
    ...options,
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
    if (!options.auth?.refresh) {
      return null;
    }

    const refreshKey = failedAccessToken ?? MISSING_ACCESS_TOKEN;
    const activeRefresh = refreshPromises.get(refreshKey);

    if (activeRefresh) {
      return activeRefresh;
    }

    const refreshPromise = Promise.resolve()
      .then(() => options.auth?.refresh?.(error));

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
    const baseURL       = requestOptions.baseURL ?? options.baseURL;
    const resolvedURL   = buildApiUrl(path, baseURL);
    const trustedOrigin = isTrustedRequestOrigin(
      resolvedURL,
      options.baseURL,
      options.allowedOrigins
    );
    const authContext = {
      method,
      path: redactApiUrl(path),
      url: redactApiUrl(resolvedURL)
    };
    const authEnabled = requestOptions.auth !== false
      && options.auth !== undefined
      && trustedOrigin;
    const executionState: RequestExecutionState = {
      networkAttempt: 0,
      retriesUsed   : 0
    };

    if (!authEnabled) {
      return sendRequest(
        method,
        path,
        requestOptions,
        clientOptions,
        fetchImpl,
        undefined,
        false,
        trustedOrigin,
        executionState
      );
    }

    let accessToken: string | null | undefined;

    try {
      accessToken = await options.auth?.getAccessToken();
    } catch (error) {
      return throwAuthCallbackError(options.auth, authContext);
    }

    const initialTokenResult = readUsableAccessToken(accessToken);

    if (!initialTokenResult.ok && !initialTokenResult.absent) {
      return throwAuthCallbackError(options.auth, authContext);
    }

    if (initialTokenResult.ok) {
      accessToken = initialTokenResult.token;
    }

    try {
      return await sendRequest(
        method,
        path,
        requestOptions,
        clientOptions,
        fetchImpl,
        accessToken ?? undefined,
        true,
        trustedOrigin,
        executionState
      );
    } catch (error) {
      if (error instanceof AuthCallbackFailure) {
        return throwAuthCallbackError(options.auth, authContext);
      }

      let authFailure: boolean;

      try {
        authFailure = isAuthFailure(error, options);
      } catch (classificationError) {
        return throwAuthCallbackError(options.auth, authContext);
      }

      if (!authFailure) {
        throw error;
      }

      if (!options.auth?.refresh || !isRequestBodyReplayable(requestOptions)) {
        return throwAuthError(options.auth, error, authContext);
      }

      let refreshedAccessToken: unknown;
      let refreshError: unknown;

      try {
        refreshedAccessToken = await waitForSignal(
          refreshOnce(error, accessToken),
          requestOptions.signal,
          authContext
        );
      } catch (nextRefreshError) {
        if (requestOptions.signal?.aborted) {
          throw new AuthWaitAbortError(
            requestOptions.signal.reason,
            authContext
          );
        }

        refreshError = nextRefreshError;
      }

      let currentAccessToken: unknown;

      try {
        currentAccessToken = await waitForSignal(
          Promise.resolve().then(() => options.auth?.getAccessToken()),
          requestOptions.signal,
          authContext
        );
      } catch (currentTokenError) {
        if (requestOptions.signal?.aborted) {
          throw new AuthWaitAbortError(
            requestOptions.signal.reason,
            authContext
          );
        }

        return throwAuthCallbackError(options.auth, authContext);
      }

      const currentTokenResult = readUsableAccessToken(currentAccessToken);

      if (!currentTokenResult.ok && !currentTokenResult.absent) {
        return throwAuthCallbackError(options.auth, authContext);
      }

      const normalizedCurrentAccessToken = currentTokenResult.ok
        ? currentTokenResult.token
        : currentAccessToken;
      const generationChanged = normalizedCurrentAccessToken !== accessToken;

      if (refreshError !== undefined && !generationChanged) {
        return throwAuthCallbackError(options.auth, authContext);
      }

      const retryTokenResult = readUsableAccessToken(
        generationChanged ? normalizedCurrentAccessToken : refreshedAccessToken
      );

      if (!retryTokenResult.ok) {
        return retryTokenResult.absent
          ? throwAuthError(options.auth, error, authContext)
          : throwAuthCallbackError(options.auth, authContext);
      }

      try {
        return await sendRequest(
          method,
          path,
          requestOptions,
          clientOptions,
          fetchImpl,
          retryTokenResult.token,
          true,
          trustedOrigin,
          executionState
        );
      } catch (retryError) {
        if (retryError instanceof AuthCallbackFailure) {
          return throwAuthCallbackError(options.auth, authContext);
        }

        let retryAuthFailure: boolean;

        try {
          retryAuthFailure = isAuthFailure(retryError, options);
        } catch (classificationError) {
          return throwAuthCallbackError(options.auth, authContext);
        }

        if (!retryAuthFailure) {
          throw retryError;
        }

        return throwAuthError(options.auth, retryError, authContext);
      }
    }
  }) as ApiRequest;

  return Object.freeze({
    call: (apiEndpoint: AnyApiEndpoint, ...args: any[]) => (
      executeEndpoint(request, apiEndpoint, args[0])
    ),
    delete : createMethod(request, ApiMethod.DELETE),
    get    : createMethod(request, ApiMethod.GET),
    options: Object.freeze({ ...options }),
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

// Request execution
const sendRequest = async <
  TBodySchema extends OptionalSchema,
  TResponseSchema extends OptionalSchema,
  TResult
>(
  method: ApiMethod,
  path: string,
  options: ApiRequestOptions<TBodySchema, TResponseSchema, TResult>,
  clientOptions: ResolvedApiFetcherOptions,
  fetchImpl: FetchLike,
  accessToken: string | undefined,
  authEnabled: boolean,
  trustedOrigin: boolean,
  executionState: RequestExecutionState
): Promise<TResult> => {
  const {
    auth: _auth,
    baseURL,
    body: _body,
    bodySchema: _bodySchema,
    errorFallback,
    headers,
    hooks,
    maxResponseBytes,
    query,
    rawBody: _rawBody,
    rawBodyFactory: _rawBodyFactory,
    responseSchema,
    retry,
    select,
    timeout,
    ...fetchOptions
  } = options;
  const url       = buildApiUrl(path, baseURL ?? clientOptions.baseURL, query);
  const startedAt = Date.now();
  const context = {
    method,
    path: redactApiUrl(path),
    startedAt,
    url: redactApiUrl(url)
  };
  const retryOptions  = resolveRetryOptions(retry ?? clientOptions.retry);
  const timeoutMs     = timeout ?? clientOptions.timeout;
  const responseLimit = validateMaxResponseBytes(
    maxResponseBytes ?? clientOptions.maxResponseBytes
  );
  const bodyReplayable = isRequestBodyReplayable(options);
  let parsedBody       = await getRequestBody(options, context, executionState);
  const mergedHeaders = mergeHeaders(clientOptions.headers, headers);

  if (!trustedOrigin) {
    mergedHeaders?.delete("Authorization");
    mergedHeaders?.delete("Proxy-Authorization");
  }

  const headersInit = buildHeaders(
    mergedHeaders,
    accessToken,
    parsedBody.isJsonBody,
    createSafeTokenHeaderFormatter(clientOptions.auth?.formatTokenHeader)
  );

  await callRequestHooks(clientOptions.hooks?.onRequest, hooks?.onRequest, context);

  for (let attempt = 0; ; attempt += 1) {
    if (attempt > 0) {
      parsedBody = await getRequestBody(options, context, executionState);
    }

    const signal = createRequestSignal(fetchOptions.signal, timeoutMs);
    let response: Response | undefined;
    let responseBody: unknown;

    try {
      const clientSendTimeMs = getServerTimeNow(clientOptions.serverTime);

      response = await fetchImpl(url, {
        ...fetchOptions,
        body: parsedBody.body,
        headers: headersInit,
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
          && authEnabled
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
          authEnabled,
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
        authEnabled,
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

const throwAuthError = async (
  auth: ApiAuthOptions | undefined,
  cause: unknown,
  context: ApiRequestContext
): Promise<never> => {
  try {
    await auth?.clear?.();
  } catch {
    // Session clearing is best effort and must not replace the primary failure
  }

  throw new ApiAuthError("API authentication failed", cause, context);
};

const throwAuthCallbackError = (
  auth: ApiAuthOptions | undefined,
  context: ApiRequestContext
): Promise<never> => throwAuthError(
  auth,
  { type: "AUTH_CALLBACK_FAILURE" },
  context
);

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
