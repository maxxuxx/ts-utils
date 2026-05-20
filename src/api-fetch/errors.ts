import type { ApiRequestContext } from "./types.js";

// HTTP errors
export class ApiHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly context: ApiRequestContext;

  constructor(response: Response, body: unknown, context: ApiRequestContext) {
    super(`API request failed: ${context.method} ${context.path} (${response.status})`);

    this.name       = "ApiHttpError";
    this.status     = response.status;
    this.statusText = response.statusText;
    this.body       = body;
    this.context    = context;
  }
}

// Validation errors
export class ApiValidationError extends Error {
  readonly target: "request" | "response";
  readonly validationError: unknown;
  readonly body: unknown;
  readonly context: ApiRequestContext;

  constructor(
    target: "request" | "response",
    validationError: unknown,
    body: unknown,
    context: ApiRequestContext
  ) {
    super(`API ${target} validation failed: ${context.method} ${context.path}`);

    this.name            = "ApiValidationError";
    this.target          = target;
    this.validationError = validationError;
    this.body            = body;
    this.context         = context;
  }
}

// Parse errors
export class ApiParseError extends Error {
  readonly status: number;
  readonly text: string;
  readonly context: ApiRequestContext;

  constructor(response: Response, text: string, context: ApiRequestContext) {
    super(`API response parse failed: ${context.method} ${context.path} (${response.status})`);

    this.name    = "ApiParseError";
    this.status  = response.status;
    this.text    = text;
    this.context = context;
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
