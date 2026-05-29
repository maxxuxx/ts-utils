import {
  badGateway,
  messageResponse,
  unauthorized
} from "../http-response/index.js";
import {
  ApiAuthError,
  ApiHttpError,
  ApiParseError,
  ApiValidationError
} from "./errors.js";
import type { MaybePromise } from "./types.js";

export type ApiRouteHandler = () => MaybePromise<Response>;

export type ApiRouteErrorOptions = Readonly<{
  authMessage?: string;
  responseMessage: string;
}>;

export const handleApiRoute = async (
  handler: ApiRouteHandler,
  options: ApiRouteErrorOptions
): Promise<Response> => {
  try {
    return await handler();
  } catch (error) {
    const response = toApiRouteErrorResponse(error, options);

    if (response) return response;

    throw error;
  }
};

export const toApiRouteErrorResponse = (
  error: unknown,
  options: ApiRouteErrorOptions
): Response | null => {
  if (error instanceof ApiAuthError) {
    return unauthorized(options.authMessage ?? error.message);
  }

  if (error instanceof ApiHttpError) {
    return messageResponse(error.message, error.status);
  }

  if (
    error instanceof ApiParseError
    || (error instanceof ApiValidationError && error.target === "response")
  ) {
    return badGateway(options.responseMessage);
  }

  return null;
};
