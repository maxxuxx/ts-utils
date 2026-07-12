import type {
  ApiErrorCode,
  ApiHttpErrorOptions,
  ApiRequestContext
} from "./types.js";
import { redactApiUrl } from "./url.js";

const sanitizeContext = (context: ApiRequestContext): ApiRequestContext => ({
  method: context.method,
  path  : redactApiUrl(context.path),
  url   : redactApiUrl(context.url)
});

const AUTH_CALLBACK_FAILURE = Object.freeze({
  type: "AUTH_CALLBACK_FAILURE" as const
});

/** Safe request failure categories that never retain the original thrown value */
export type ApiRequestErrorReason =
  | "TRANSPORT_FAILURE"
  | "URL_RESOLUTION_FAILURE";

/** Error raised when an API URL cannot be resolved or its transport fails */
export class ApiRequestError extends Error {
  readonly context: ApiRequestContext;
  readonly reason: ApiRequestErrorReason;

  constructor(reason: ApiRequestErrorReason, context: ApiRequestContext) {
    const safeContext = sanitizeContext(context);

    super(`API request failed: ${safeContext.method} ${safeContext.url}`);

    this.name    = "ApiRequestError";
    this.context = safeContext;
    this.reason  = reason;
  }
}

// HTTP errors
/** Error raised for api http failures */
export class ApiHttpError extends Error {
  readonly code: ApiErrorCode | undefined;
  readonly context: ApiRequestContext;
  readonly status: number;

  constructor(
    response: Response,
    _body: unknown,
    context: ApiRequestContext,
    options: ApiHttpErrorOptions | string = {}
  ) {
    const safeContext    = sanitizeContext(context);
    const defaultMessage = `API request failed: ${safeContext.method} ${safeContext.url} (${response.status})`;
    const message = typeof options === "string"
      ? options
      : options.message ?? defaultMessage;

    super(message);

    this.name       = "ApiHttpError";
    this.code       = typeof options === "string" ? undefined : options.code;
    this.context    = safeContext;
    this.status     = response.status;
  }
}

/** Returns api message */
export const getApiMessage = (data: unknown): string | undefined => {
  if (typeof data !== "object" || data === null || !("message" in data)) {
    return undefined;
  }

  const message = data.message;

  return typeof message === "string" ? message : undefined;
};

/** Returns api error code */
export const getApiErrorCode = (data: unknown): ApiErrorCode | undefined => {
  if (typeof data !== "object" || data === null || !("code" in data)) {
    return undefined;
  }

  const code = data.code;

  return typeof code === "string" || typeof code === "number" ? code : undefined;
};

// Validation errors
/** Error raised for api validation failures */
export class ApiValidationError extends Error {
  readonly context: ApiRequestContext;
  readonly target: "request" | "response";

  constructor(
    target: "request" | "response",
    _validationError: unknown,
    _body: unknown,
    context: ApiRequestContext
  ) {
    const safeContext = sanitizeContext(context);

    super(`API ${target} validation failed: ${safeContext.method} ${safeContext.url}`);

    this.name    = "ApiValidationError";
    this.context = safeContext;
    this.target  = target;
  }
}

// Parse errors
/** Error raised for api parse failures */
export class ApiParseError extends Error {
  readonly context: ApiRequestContext;
  readonly status: number;

  constructor(response: Response, _text: string, context: ApiRequestContext) {
    const safeContext = sanitizeContext(context);

    super(`API response parse failed: ${safeContext.method} ${safeContext.url} (${response.status})`);

    this.name    = "ApiParseError";
    this.context = safeContext;
    this.status  = response.status;
  }
}

// Timeout errors
/** Error raised for api timeout failures */
export class ApiTimeoutError extends Error {
  readonly context: ApiRequestContext;
  readonly timeout: number;

  constructor(timeout: number, context: ApiRequestContext) {
    const safeContext = sanitizeContext(context);

    super(`API request timed out: ${safeContext.method} ${safeContext.url} (${timeout}ms)`);

    this.name    = "ApiTimeoutError";
    this.context = safeContext;
    this.timeout = timeout;
  }
}

// Abort errors
/** Error raised when the caller aborts an API request */
export class ApiAbortError extends Error {
  readonly cause: unknown;
  readonly context: ApiRequestContext;

  constructor(cause: unknown, context: ApiRequestContext) {
    const safeContext = sanitizeContext(context);

    super(`API request aborted: ${safeContext.method} ${safeContext.url}`);

    this.name    = "ApiAbortError";
    this.cause   = cause;
    this.context = safeContext;
  }
}

// Response size errors
/** Error raised when an API response exceeds its configured byte limit */
export class ApiResponseSizeError extends Error {
  readonly context: ApiRequestContext;
  readonly limit: number;
  readonly size: number;

  constructor(limit: number, size: number, context: ApiRequestContext) {
    const safeContext = sanitizeContext(context);

    super(`API response exceeded ${limit} bytes: ${safeContext.method} ${safeContext.url}`);

    this.name    = "ApiResponseSizeError";
    this.context = safeContext;
    this.limit   = limit;
    this.size    = size;
  }
}

// Auth errors
/** Sanitized cause retained by terminal API authentication errors */
export type ApiAuthErrorCause =
  | Readonly<{
    context: ApiRequestContext;
    status : number;
    type   : "HTTP_FAILURE";
  }>
  | Readonly<{ type: "AUTH_CALLBACK_FAILURE" }>;

/** Error raised for api auth failures */
export class ApiAuthError extends Error {
  readonly cause: ApiAuthErrorCause | undefined;
  readonly context: ApiRequestContext | undefined;

  constructor(
    message: string,
    cause?: unknown,
    context?: ApiRequestContext
  ) {
    super(message);

    this.name    = "ApiAuthError";
    this.cause   = sanitizeAuthCause(cause);
    this.context = context ? sanitizeContext(context) : undefined;
  }
}

const sanitizeAuthCause = (cause: unknown): ApiAuthErrorCause | undefined => {
  if (cause === undefined) {
    return undefined;
  }

  if (cause instanceof ApiHttpError) {
    return Object.freeze({
      context: Object.freeze(sanitizeContext(cause.context)),
      status : cause.status,
      type   : "HTTP_FAILURE" as const
    });
  }

  return AUTH_CALLBACK_FAILURE;
};
