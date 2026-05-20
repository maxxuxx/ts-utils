import type {
  ApiErrorHookContext,
  ApiHooks,
  ApiMethod,
  ApiResponseHookContext
} from "./types.js";

const METHOD_WIDTH = 6;
const TIME_WIDTH   = 4;
const TIME_UNIT    = "ms";

export type ApiLogLevel = "debug" | "info" | "warn" | "error" | "log";

export type ApiLogger = Readonly<Partial<Record<
  ApiLogLevel,
  (...data: unknown[]) => void
>>>;

export type ApiLogWriter = (
  message: string,
  event: ApiLogEvent
) => void;

export type ApiLogging = boolean | ApiLoggingOptions;

export type ApiLogEventType =
  | "response"
  | "response-error"
  | "request-error";

export type ApiLogEvent = Readonly<{
  durationMs: number;
  error     ?: unknown;
  method    : ApiMethod;
  path      : string;
  response  ?: Response;
  status    ?: number;
  statusText?: string;
  type      : ApiLogEventType;
  url       : string;
}>;

export type ApiLoggingOptions = Readonly<{
  enabled          ?: boolean;
  errorEmoji       ?: string;
  errorLevel       ?: ApiLogLevel;
  format           ?: (event: ApiLogEvent) => string;
  includeQuery     ?: boolean;
  logger           ?: ApiLogger | ApiLogWriter;
  requestErrorEmoji?: string;
  requestErrorLevel?: ApiLogLevel;
  successEmoji     ?: string;
  successLevel     ?: ApiLogLevel;
}>;

export const createApiLoggerHooks = (
  logging: ApiLogging | undefined
): ApiHooks => {
  if (!logging) {
    return {};
  }

  const options = normalizeLoggingOptions(logging);

  if (options.enabled === false) {
    return {};
  }

  return {
    onRequestError: (context) => {
      writeApiLog(options, options.requestErrorLevel ?? "error", toRequestErrorEvent(context));
    },
    onResponse: (context) => {
      writeApiLog(options, options.successLevel ?? "info", toResponseEvent(context));
    },
    onResponseError: (context) => {
      writeApiLog(options, options.errorLevel ?? "warn", toResponseErrorEvent(context));
    }
  };
};

export const formatApiLogEvent = (
  event: ApiLogEvent,
  options: Pick<
    ApiLoggingOptions,
    "errorEmoji" | "includeQuery" | "requestErrorEmoji" | "successEmoji"
  > = {}
): string => {
  const emoji    = getEventEmoji(event, options);
  const method   = event.method.padEnd(METHOD_WIDTH, " ");
  const code     = event.status === undefined ? "ERR" : String(event.status);
  const duration = `${Math.max(0, Math.round(event.durationMs))}`.padEnd(TIME_WIDTH, " ") + TIME_UNIT;
  const path     = getLogPath(event, options.includeQuery === true);

  return `${emoji} ${method} ${code} ${duration} ${path}`;
};

const normalizeLoggingOptions = (
  logging: ApiLogging
): ApiLoggingOptions => (
  typeof logging === "boolean" ? {} : logging
);

const writeApiLog = (
  options: ApiLoggingOptions,
  level: ApiLogLevel,
  event: ApiLogEvent
): void => {
  const message = options.format?.(event) ?? formatApiLogEvent(event, options);
  const logger  = options.logger ?? console;

  if (typeof logger === "function") {
    logger(message, event);
    return;
  }

  const writer = logger[level] ?? logger.log;

  writer?.(message);
};

const getEventEmoji = (
  event: ApiLogEvent,
  options: Pick<ApiLoggingOptions, "errorEmoji" | "requestErrorEmoji" | "successEmoji">
): string => {
  if (event.type === "request-error") {
    return options.requestErrorEmoji ?? "❌";
  }

  if (event.type === "response-error") {
    return options.errorEmoji ?? "⚠️";
  }

  return options.successEmoji ?? "🌐";
};

const getLogPath = (
  event: ApiLogEvent,
  includeQuery: boolean
): string => {
  const pathWithoutOrigin = removeOrigin(event.path);
  const pathWithoutQuery  = stripQuery(pathWithoutOrigin);

  if (!includeQuery) {
    return pathWithoutQuery;
  }

  const query = getSearch(event.url) || getSearch(pathWithoutOrigin);

  return `${pathWithoutQuery}${query}`;
};

const removeOrigin = (path: string): string => {
  try {
    const url = new URL(path);

    return `${url.pathname}${url.search}`;
  } catch {
    return path;
  }
};

const stripQuery = (path: string): string => {
  const index = path.indexOf("?");

  return index === -1 ? path : path.slice(0, index);
};

const getSearch = (path: string): string => {
  try {
    return new URL(path).search;
  } catch {
    const index = path.indexOf("?");

    return index === -1 ? "" : path.slice(index);
  }
};

const toResponseEvent = (context: ApiResponseHookContext): ApiLogEvent => ({
  durationMs: context.durationMs,
  method    : context.method,
  path      : context.path,
  response  : context.response,
  status    : context.response.status,
  statusText: context.response.statusText,
  type      : "response",
  url       : context.url
});

const toResponseErrorEvent = (context: ApiErrorHookContext): ApiLogEvent => ({
  durationMs: context.durationMs,
  error     : context.error,
  method    : context.method,
  path      : context.path,
  response  : context.response,
  status    : context.response?.status,
  statusText: context.response?.statusText,
  type      : "response-error",
  url       : context.url
});

const toRequestErrorEvent = (context: ApiErrorHookContext): ApiLogEvent => ({
  durationMs: context.durationMs,
  error     : context.error,
  method    : context.method,
  path      : context.path,
  response  : context.response,
  status    : context.response?.status,
  statusText: context.response?.statusText,
  type      : "request-error",
  url       : context.url
});
