# HTTP response 모듈

[English](./readme.md)

JSON body와 자주 쓰는 message response를 위한 작은 Web `Response` helper입니다.

## 언제 사용하나

- framework-specific helper 없이 route handler에서 표준 Web `Response`를 반환하고 싶을 때 사용합니다.
- JSON `{ message }` error response convention이 필요할 때 사용합니다.
- server adapter에서 400, 401, 502 response helper가 필요할 때 사용합니다.

## Import

```ts
import {
  httpResponse,
  jsonResponse,
  messageResponse,
  badRequest,
  unauthorized,
  badGateway
} from "@maxxuxx/ts-utils/http-response";
```

## 주요 export

| Export | 역할 |
|---|---|
| `jsonResponse` | `Response.json(body, init)`를 반환합니다. |
| `messageResponse` | 명시 status와 함께 `{ message }` JSON을 반환합니다. |
| `badRequest` | 400 message response를 반환합니다. |
| `unauthorized` | 401 message response를 반환합니다. |
| `badGateway` | 502 message response를 반환합니다. |
| `httpResponse` | 동일 helper를 묶은 namespace입니다. |

## 기본 예제

```ts
return httpResponse.unauthorized("로그인이 필요합니다");

return jsonResponse({
  user
}, {
  status: 200
});
```

## 동작 메모

- helper는 platform Web `Response` 구현을 사용합니다.
- status helper는 generic server error용 English default message를 제공합니다.
- product-specific user-facing 문구는 application route에서 넘기는 것이 좋습니다.

## 주의할 점

- status shortcut은 400, 401, 502만 포함합니다. 다른 status는 `messageResponse`를 사용합니다.
- `jsonResponse`는 body shape을 검증하지 않습니다.
- typed API client error를 변환할 때는 `api-fetch` route helper를 사용합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/api-fetch`는 API error를 response로 변환합니다.
- `@maxxuxx/ts-utils/json`은 명시적 JSON parse/stringify boundary에 사용합니다.
