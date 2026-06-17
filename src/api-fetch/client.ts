import { parseRequestBody, parseResponseBody, readResponseBody } from "./body.js";
import {
  ApiHttpError,
  ApiParseError,
  ApiTimeoutError,
  ApiValidationError,
  getApiErrorCode,
  getApiMessage
} from "./errors.js";
import { executeEndpoint } from "./endpoint.js";
import { buildHeaders, mergeHeaders } from "./headers.js";
import { createApiLoggerHooks } from "./logging.js";
import { buildApiUrl } from "./url.js";
import { ApiMethod } from "./types.js";
import {
  createServerClock,
  createTimeSyncSample,
  parseServerDateHeader
} from "../time/index.js";
import type {
  AnyApiEndpoint,
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
  ApiRetry,
  ApiRetryContext,
  ApiRetryOptions,
  ApiServerTimeOptions,
  ApiTimedRequestContext,
  FetchLike,
  OptionalSchema,
  SchemaOutput
} from "./types.js";

const AUTH_REFRESH_STATUS_CODES = [401, 419] as const;
const DEFAULT_SERVER_TIME_HEADER = "Date";
const DEFAULT_RETRY_METHODS = [ApiMethod.GET] as const;
const DEFAULT_RETRY_STATUS_CODES = [
  408,
  409,
  425,
  429,
  500,
  502,
  503,
  504
] as const;

type ResolvedApiFetcherOptions = Omit<ApiFetcherOptions, "serverTime"> & {
  serverTime?: ApiServerTimeOptions;
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
        .catch(async (refreshError) => {
          await options.auth?.clear?.();
          throw refreshError;
        })
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
    const authEnabled = requestOptions.auth !== false && options.auth !== undefined;

    if (!authEnabled) {
      return sendRequest(method, path, requestOptions, clientOptions, fetchImpl, undefined, false);
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
        true
      );
    } catch (error) {
      if (!shouldRefreshAuth(error, options)) {
        throw error;
      }

      const nextAccessToken = await refreshOnce(error);

      if (!nextAccessToken) {
        throw error;
      }

      return sendRequest(
        method,
        path,
        requestOptions,
        clientOptions,
        fetchImpl,
        nextAccessToken,
        true
      );
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
  authEnabled: boolean
): Promise<TResult> => {
  const {
    auth: _auth,
    baseURL,
    body: _body,
    bodySchema: _bodySchema,
    errorFallback,
    headers,
    hooks,
    query,
    rawBody: _rawBody,
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
    url
  };
  const parsedBody = parseRequestBody(options, context);
  const headersInit = buildHeaders(
    mergeHeaders(clientOptions.headers, headers),
    accessToken,
    parsedBody.isJsonBody,
    clientOptions.auth?.formatTokenHeader
  );
  const retryOptions = resolveRetryOptions(retry ?? clientOptions.retry);
  const timeoutMs    = timeout ?? clientOptions.timeout;

  await callRequestHooks(clientOptions.hooks?.onRequest, hooks?.onRequest, context);

  for (let attempt = 0; ; attempt += 1) {
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
      responseBody = await readResponseBody(response, context);

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
          attempt,
          authEnabled,
          context,
          error,
          method,
          response,
          retryOptions
        })) {
          await waitForRetry(retryOptions, {
            ...context,
            attempt: attempt + 1,
            error,
            response,
            status: response.status
          });
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
        attempt,
        authEnabled,
        context,
        error: nextError,
        method,
        retryOptions
      })) {
        await waitForRetry(retryOptions, {
          ...context,
          attempt: attempt + 1,
          error: nextError
        });
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
): error is ApiParseError | ApiValidationError => (
  error instanceof ApiParseError
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

// Retry helpers
type ResolvedRetryOptions = Readonly<{
  delay      : NonNullable<ApiRetryOptions["delay"]>;
  limit      : number;
  methods    : readonly ApiMethod[];
  shouldRetry: ApiRetryOptions["shouldRetry"];
  statusCodes: readonly number[];
}>;

const resolveRetryOptions = (
  retry: ApiRetry | undefined
): ResolvedRetryOptions => {
  if (retry === undefined || retry === false) {
    return {
      delay      : 0,
      limit      : 0,
      methods    : DEFAULT_RETRY_METHODS,
      shouldRetry: undefined,
      statusCodes: DEFAULT_RETRY_STATUS_CODES
    };
  }

  if (retry === true) {
    return {
      delay      : 0,
      limit      : 1,
      methods    : DEFAULT_RETRY_METHODS,
      shouldRetry: undefined,
      statusCodes: DEFAULT_RETRY_STATUS_CODES
    };
  }

  if (typeof retry === "number") {
    return {
      delay      : 0,
      limit      : retry,
      methods    : DEFAULT_RETRY_METHODS,
      shouldRetry: undefined,
      statusCodes: DEFAULT_RETRY_STATUS_CODES
    };
  }

  return {
    delay      : retry.delay ?? 0,
    limit      : retry.limit ?? 0,
    methods    : retry.methods ?? DEFAULT_RETRY_METHODS,
    shouldRetry: retry.shouldRetry,
    statusCodes: retry.statusCodes ?? DEFAULT_RETRY_STATUS_CODES
  };
};

const shouldRetryRequest = async ({
  attempt,
  authEnabled,
  context,
  error,
  method,
  response,
  retryOptions
}: Readonly<{
  attempt     : number;
  authEnabled : boolean;
  context     : ApiRequestContext;
  error       : unknown;
  method      : ApiMethod;
  response   ?: Response;
  retryOptions: ResolvedRetryOptions;
}>): Promise<boolean> => {
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

const waitForRetry = async (
  options: ResolvedRetryOptions,
  context: ApiRetryContext
): Promise<void> => {
  const delay = typeof options.delay === "function"
    ? options.delay(context)
    : options.delay;

  if (delay <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
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

  const abortFromSource = (): void => {
    controller.abort(sourceSignal?.reason);
  };
  const timeoutId = setTimeout(() => {
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
      clearTimeout(timeoutId);
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
