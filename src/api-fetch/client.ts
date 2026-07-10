import {
  parseRequestBody,
  parseResponseBody,
  readResponseBody,
  validateMaxResponseBytes
} from "./body.js";
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
  FetchLike,
  OptionalSchema,
  SchemaOutput
} from "./types.js";
import type { ResolvedRetryOptions } from "./retry.js";

const AUTH_REFRESH_STATUS_CODES = [401, 419] as const;
const DEFAULT_SERVER_TIME_HEADER = "Date";

type ResolvedApiFetcherOptions = Omit<ApiFetcherOptions, "serverTime"> & {
  serverTime?: ApiServerTimeOptions;
};

type RequestExecutionState = {
  networkAttempt: number;
  retriesUsed   : number;
};

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
  let refreshPromise: Promise<string | null | undefined> | null = null;

  const refreshOnce = async (
    error: unknown
  ): Promise<string | null | undefined> => {
    if (!options.auth?.refresh) {
      return null;
    }

    if (!refreshPromise) {
      refreshPromise = Promise.resolve(options.auth.refresh(error))
        .finally(() => {
          refreshPromise = null;
        });
    }

    return refreshPromise;
  };

  const request: ApiRequest = async <
    TBodySchema extends OptionalSchema = undefined,
    TResponseSchema extends OptionalSchema = undefined,
    TResult = ApiResponse<ApiResponsePayload<SchemaOutput<TResponseSchema>>>
  >(
    method: ApiMethod,
    path: string,
    requestOptions: ApiRequestOptions<TBodySchema, TResponseSchema, TResult> = {}
  ): Promise<TResult> => {
    const baseURL     = requestOptions.baseURL ?? options.baseURL;
    const resolvedURL = buildApiUrl(path, baseURL);
    const authContext = {
      method,
      path,
      url: redactApiUrl(resolvedURL)
    };
    const authEnabled = requestOptions.auth !== false
      && options.auth !== undefined
      && isTrustedRequestOrigin(resolvedURL, baseURL, options.allowedOrigins);
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
        executionState
      );
    }

    const accessToken = await options.auth?.getAccessToken();

    try {
      return await sendRequest(
        method,
        path,
        requestOptions,
        clientOptions,
        fetchImpl,
        accessToken ?? undefined,
        true,
        executionState
      );
    } catch (error) {
      if (!isRequestBodyReplayable(requestOptions) || !shouldRefreshAuth(error, options)) {
        throw error;
      }

      let nextAccessToken: string | null | undefined;

      try {
        nextAccessToken = await refreshOnce(error);
      } catch (refreshError) {
        return throwAuthError(options.auth, refreshError, authContext);
      }

      if (!nextAccessToken) {
        return throwAuthError(options.auth, error, authContext);
      }

      try {
        return await sendRequest(
          method,
          path,
          requestOptions,
          clientOptions,
          fetchImpl,
          nextAccessToken,
          true,
          executionState
        );
      } catch (retryError) {
        if (!shouldRefreshAuth(retryError, options)) {
          throw retryError;
        }

        return throwAuthError(options.auth, retryError, authContext);
      }
    }
  };

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
) => request(method, path, options);

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
    path,
    startedAt,
    url: redactApiUrl(url)
  };
  const retryOptions  = resolveRetryOptions(retry ?? clientOptions.retry);
  const timeoutMs     = timeout ?? clientOptions.timeout;
  const responseLimit = validateMaxResponseBytes(
    maxResponseBytes ?? clientOptions.maxResponseBytes
  );
  const bodyReplayable = isRequestBodyReplayable(options);
  let parsedBody       = await parseRequestBody(
    options,
    context,
    executionState.networkAttempt += 1
  );
  const headersInit = buildHeaders(
    mergeHeaders(clientOptions.headers, headers),
    accessToken,
    parsedBody.isJsonBody,
    clientOptions.auth?.formatTokenHeader
  );

  await callRequestHooks(clientOptions.hooks?.onRequest, hooks?.onRequest, context);

  for (let attempt = 0; ; attempt += 1) {
    if (attempt > 0) {
      parsedBody = await parseRequestBody(
        options,
        context,
        executionState.networkAttempt += 1
      );
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
      responseBody = await readResponseBody(response, context, responseLimit);

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
            message: getApiMessage(responseBody) ?? resolvedErrorFallback?.message
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
const shouldRefreshAuth = (
  error: unknown,
  options: ApiFetcherOptions
): boolean => {
  if (!options.auth?.refresh) {
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
  || typeof ReadableStream === "undefined"
  || !(options.rawBody instanceof ReadableStream)
);

const waitForRetry = async (
  options: ResolvedRetryOptions,
  context: ApiRetryContext,
  signal: AbortSignal | null | undefined
): Promise<void> => {
  const delay = getRetryDelay(options, context, Date.now(), Math.random());

  if (delay <= 0) {
    if (signal?.aborted) {
      await sleep(0, { signal });
    }

    return;
  }

  await sleep(delay, { signal: signal ?? undefined });
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
