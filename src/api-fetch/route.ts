import {
  badGateway,
  jsonResponse,
  messageResponse,
  unauthorized
} from "../http-response/index.js";
import {
  ApiAuthError,
  ApiHttpError,
  ApiParseError,
  ApiRequestError,
  ApiValidationError
} from "./errors.js";
import type {
  ApiErrorCode,
  MaybePromise
} from "./types.js";

/** Handler signature for api route */
export type ApiRouteHandler = () => MaybePromise<Response>;

/** Message override for api route error responses */
export type ApiRouteErrorMessage = string | ((error: ApiHttpError) => string | undefined);

/** Options for api route error */
export type ApiRouteErrorOptions = Readonly<{
  authMessage   ?: string;
  codeMessages  ?: Partial<Record<ApiErrorCode, ApiRouteErrorMessage>>;
  responseMessage?: string;
  statusMessages?: Partial<Record<number, ApiRouteErrorMessage>>;
}>;

const DEFAULT_API_ROUTE_ERROR_MESSAGE = "API request failed";

/** Runs a route handler and converts known API errors to HTTP responses */
export const handleApiRoute = async (
  handler: ApiRouteHandler,
  options: ApiRouteErrorOptions = {}
): Promise<Response> => {
  try {
    return await handler();
  } catch (error) {
    const response = toApiRouteErrorResponse(error, options);

    if (response) return response;

    throw error;
  }
};

/** Converts a value to api route error response */
export const toApiRouteErrorResponse = (
  error: unknown,
  options: ApiRouteErrorOptions = {}
): Response | null => {
  if (error instanceof ApiAuthError) {
    return unauthorized(options.authMessage ?? error.message);
  }

  if (error instanceof ApiHttpError) {
    const message = getApiRouteHttpErrorMessage(error, options);

    if (error.code !== undefined) {
      return jsonResponse({
        code: error.code,
        message
      }, {
        status: error.status
      });
    }

    return messageResponse(message, error.status);
  }

  if (
    error instanceof ApiParseError
    || error instanceof ApiRequestError
    || (error instanceof ApiValidationError && error.target === "response")
  ) {
    return badGateway(options.responseMessage ?? DEFAULT_API_ROUTE_ERROR_MESSAGE);
  }

  return null;
};

const getApiRouteHttpErrorMessage = (
  error: ApiHttpError,
  options: ApiRouteErrorOptions
): string => (
  resolveApiRouteErrorMessage(error, error.code === undefined ? undefined : options.codeMessages?.[error.code])
  ?? resolveApiRouteErrorMessage(error, options.statusMessages?.[error.status])
  ?? options.responseMessage
  ?? DEFAULT_API_ROUTE_ERROR_MESSAGE
);

const resolveApiRouteErrorMessage = (
  error: ApiHttpError,
  message: ApiRouteErrorMessage | undefined
): string | undefined => {
  if (typeof message === "function") {
    return message(error);
  }

  return message;
};
