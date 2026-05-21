# HTTP response module

Small Web `Response` helpers for route handlers and server adapters

## Public API

```ts
import {
  badGateway,
  badRequest,
  httpResponse,
  jsonResponse,
  messageResponse,
  unauthorized
} from "@maxxuxx/ts-utils/http-response";
```

## JSON responses

Use `jsonResponse` when the caller already has the full response body

```ts
return jsonResponse({
  user
});
```

## Message responses

Use `messageResponse` when the caller decides both message and status code

```ts
return messageResponse("Login failed", 401);
```

Status helpers provide English defaults, but app routes should pass their own user-facing copy when the message is product specific

```ts
return unauthorized("로그인이 필요합니다");
```

Available status helpers

```ts
badRequest();
unauthorized();
badGateway();
```

## Namespace helper

Short namespace style imports are also available

```ts
return httpResponse.unauthorized("로그인이 필요합니다");
```
