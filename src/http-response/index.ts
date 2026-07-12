/** Represents message response body */
export type MessageResponseBody = Readonly<{
  message: string;
}>;

/** Returns a JSON Response with the provided body and init options */
export const jsonResponse = <TBody>(
  body: TBody,
  init?: ResponseInit
): Response => Response.json(body, init);

/** Returns a JSON Response containing a message field */
export const messageResponse = (
  message: string,
  status: number
): Response => jsonResponse({ message } satisfies MessageResponseBody, { status });

/** Returns a 204 Response without a body */
export const noContent = (): Response => new Response(null, { status: 204 });

/** Returns a 400 message Response */
export const badRequest = (message = "Bad Request"): Response => (
  messageResponse(message, 400)
);

/** Returns a 401 message Response */
export const unauthorized = (message = "Unauthorized"): Response => (
  messageResponse(message, 401)
);

/** Returns a 403 message Response */
export const forbidden = (message = "Forbidden"): Response => (
  messageResponse(message, 403)
);

/** Returns a 404 message Response */
export const notFound = (message = "Not Found"): Response => (
  messageResponse(message, 404)
);

/** Returns a 409 message Response */
export const conflict = (message = "Conflict"): Response => (
  messageResponse(message, 409)
);

/** Returns a 422 message Response */
export const unprocessableEntity = (message = "Unprocessable Entity"): Response => (
  messageResponse(message, 422)
);

/** Returns a 502 message Response */
export const badGateway = (message = "Bad Gateway"): Response => (
  messageResponse(message, 502)
);

/** Grouped helpers for the httpResponse module */
export const httpResponse = Object.freeze({
  badGateway,
  badRequest,
  conflict,
  forbidden,
  json:         jsonResponse,
  message:      messageResponse,
  noContent,
  notFound,
  unprocessableEntity,
  unauthorized
});
