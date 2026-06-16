import type {
  ApiErrorCode,
  ApiHttpErrorOptions,
  ApiRequestContext
} from "./types.js";

// HTTP errors
/** Error raised for api http failures */
export class ApiHttpError extends Error {
  readonly body: unknown;
  readonly code: ApiErrorCode | undefined;
  readonly context: ApiRequestContext;
  readonly response: Response;
  readonly status: number;
  readonly statusText: string;

  constructor(
    response: Response,
    body: unknown,
    context: ApiRequestContext,
    options: ApiHttpErrorOptions | string = {}
  ) {
    const defaultMessage = `API request failed: ${context.method} ${context.url} (${response.status})`;
    const message = typeof options === "string"
      ? options
      : options.message ?? defaultMessage;

    super(message);

    this.name       = "ApiHttpError";
    this.body       = body;
    this.code       = typeof options === "string" ? undefined : options.code;
    this.context    = context;
    this.response   = response;
    this.status     = response.status;
    this.statusText = response.statusText;
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
  readonly body: unknown;
  readonly context: ApiRequestContext;
  readonly target: "request" | "response";
  readonly validationError: unknown;

  constructor(
    target: "request" | "response",
    validationError: unknown,
    body: unknown,
    context: ApiRequestContext
  ) {
    super(`API ${target} validation failed: ${context.method} ${context.url}`);

    this.name            = "ApiValidationError";
    this.body            = body;
    this.context         = context;
    this.target          = target;
    this.validationError = validationError;
  }
}

// Parse errors
/** Error raised for api parse failures */
export class ApiParseError extends Error {
  readonly context: ApiRequestContext;
  readonly status: number;
  readonly text: string;

  constructor(response: Response, text: string, context: ApiRequestContext) {
    super(`API response parse failed: ${context.method} ${context.url} (${response.status})`);

    this.name    = "ApiParseError";
    this.context = context;
    this.status  = response.status;
    this.text    = text;
  }
}

// Timeout errors
/** Error raised for api timeout failures */
export class ApiTimeoutError extends Error {
  readonly context: ApiRequestContext;
  readonly timeout: number;

  constructor(timeout: number, context: ApiRequestContext) {
    super(`API request timed out: ${context.method} ${context.url} (${timeout}ms)`);

    this.name    = "ApiTimeoutError";
    this.context = context;
    this.timeout = timeout;
  }
}

// Auth errors
/** Error raised for api auth failures */
export class ApiAuthError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);

    this.name  = "ApiAuthError";
    this.cause = cause;
  }
}
