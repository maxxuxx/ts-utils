export type MessageResponseBody = Readonly<{
  message: string;
}>;

export const jsonResponse = <TBody>(
  body: TBody,
  init?: ResponseInit
): Response => Response.json(body, init);

export const messageResponse = (
  message: string,
  status: number
): Response => jsonResponse({ message } satisfies MessageResponseBody, { status });

export const badRequest = (message = "Bad Request"): Response => (
  messageResponse(message, 400)
);

export const unauthorized = (message = "Unauthorized"): Response => (
  messageResponse(message, 401)
);

export const badGateway = (message = "Bad Gateway"): Response => (
  messageResponse(message, 502)
);

export const httpResponse = Object.freeze({
  badGateway,
  badRequest,
  json:         jsonResponse,
  message:      messageResponse,
  unauthorized
});
