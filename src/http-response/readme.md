# HTTP response module

[한국어](./readme.kr.md)

Small Web `Response` helpers for JSON bodies and common message responses.

## Use this when

- Route handlers should return standard Web `Response` objects without framework-specific helpers.
- You need a tiny convention for JSON `{ message }` error responses.
- Server adapters need default helpers for common 204, 400, 401, 403, 404, 409, 422, and 502 responses

## Import

```ts
import {
  httpResponse,
  jsonResponse,
  messageResponse,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessableEntity,
  badGateway
} from "@maxxuxx/ts-utils/http-response";
```

## Core exports

| Export | Role |
|---|---|
| `jsonResponse` | Returns `Response.json(body, init)`. |
| `messageResponse` | Returns `{ message }` JSON with an explicit status. |
| `noContent` | Returns an empty 204 response |
| `badRequest` | Returns a 400 message response. |
| `unauthorized` | Returns a 401 message response. |
| `forbidden`, `notFound` | Return 403 and 404 message responses |
| `conflict`, `unprocessableEntity` | Return 409 and 422 message responses |
| `badGateway` | Returns a 502 message response. |
| `httpResponse` | Namespace containing the same helpers. |

## Basic example

```ts
return httpResponse.unauthorized("Login required");

return jsonResponse({
  user
}, {
  status: 200
});
```

## Behavior notes

- The helpers use the platform Web `Response` implementation.
- Status helpers provide English defaults for generic server errors.
- Product-specific user-facing text should be passed by the application route.

## Edge cases

- Common 400, 401, 403, 404, 409, 422, and 502 shortcuts return `{ message }` JSON
- `noContent` returns status 204 with an empty body
- Use `messageResponse` for other status codes
- `jsonResponse` does not validate the body shape.
- Use `api-fetch` route helpers when converting typed API client errors.

## Related modules

- `@maxxuxx/ts-utils/api-fetch` for API error to response conversion.
- `@maxxuxx/ts-utils/json` for explicit JSON parse/stringify boundaries.
