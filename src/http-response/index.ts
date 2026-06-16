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

/** Returns a 400 message Response */
export const badRequest = (message = "Bad Request"): Response => (
  messageResponse(message, 400)
);

/** Returns a 401 message Response */
export const unauthorized = (message = "Unauthorized"): Response => (
  messageResponse(message, 401)
);

/** Returns a 502 message Response */
export const badGateway = (message = "Bad Gateway"): Response => (
  messageResponse(message, 502)
);

/** Grouped helpers for the httpResponse module */
export const httpResponse = Object.freeze({
  badGateway,
  badRequest,
  json:         jsonResponse,
  message:      messageResponse,
  unauthorized
});
