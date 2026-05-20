import type { ApiRequestContext } from "./types.js";

// HTTP errors
export class ApiHttpError extends Error {
  readonly body: unknown;
  readonly context: ApiRequestContext;
  readonly response: Response;
  readonly status: number;
  readonly statusText: string;

  constructor(response: Response, body: unknown, context: ApiRequestContext) {
    super(`API request failed: ${context.method} ${context.url} (${response.status})`);

    this.name       = "ApiHttpError";
    this.body       = body;
    this.context    = context;
    this.response   = response;
    this.status     = response.status;
    this.statusText = response.statusText;
  }
}

// Validation errors
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
export class ApiAuthError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);

    this.name  = "ApiAuthError";
    this.cause = cause;
  }
}
