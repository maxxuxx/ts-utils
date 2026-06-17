# API fetch 모듈

[English](./readme.md)

Zod 검증, endpoint 정의, auth refresh, retry, timeout, hook, logging, route error 변환을 포함한 fetch 기반 API client입니다.

## 언제 사용하나

- base URL, header, JSON body, timeout, retry, auth header, response validation을 한 fetch wrapper에서 관리하고 싶을 때 사용합니다.
- params, query, body, response를 검증하는 재사용 endpoint를 정의하고 싶을 때 사용합니다.
- server-side API 호출에서 upstream `Date` header를 shared server clock에 샘플링해야 할 때 사용합니다.
- server route에서 API client error를 Web `Response`로 변환해야 할 때 사용합니다.

## Import

```ts
import {
  createApiFetcher,
  endpoint,
  handleApiRoute,
  responseEnvelopeSchema,
  z
} from "@maxxuxx/ts-utils/api-fetch";
```

## 주요 export

| Export | 역할 |
|---|---|
| `createApiFetcher` | 설정된 fetch client와 method shortcut을 생성합니다. |
| `endpoint` | HTTP method별 typed endpoint factory namespace입니다. |
| `handleApiRoute`, `toApiRouteErrorResponse` | 알려진 API error를 route response로 변환합니다. |
| `ApiHttpError`, `ApiValidationError`, `ApiParseError`, `ApiTimeoutError`, `ApiAuthError` | client와 helper가 발생시키는 typed error입니다. |
| `createApiLoggerHooks`, `formatApiLogEvent` | hook 기반 API logging을 생성합니다. |
| `api-fetch/sveltekit` | cookie에 묶인 SvelteKit auth callback과 refresh dedupe adapter입니다. |

## 기본 예제

```ts
const api = createApiFetcher({
  baseURL: "https://api.example.com",
  timeout: 5000
});

const User = z.object({
  id: z.number(),
  name: z.string()
});

const getUser = endpoint.get("/users/:id", {
  params: z.object({
    id: z.number()
  }),
  responseSchema: User
});

const result = await api.call(getUser, {
  params: {
    id: 1
  }
});

result.response.name;
```

## Server time 샘플링

```ts
import { createServerClock } from "@maxxuxx/ts-utils/time";

const api = createApiFetcher({
  baseURL: "https://api.example.com",
  serverTime: true
});

await api.get("/me");

api.serverTime?.getServerTimeMs();
```

요청마다 fetcher를 새로 만드는 환경에서는 shared clock을 넘깁니다.

```ts
const apiServerClock = createServerClock();

const api = createApiFetcher({
  baseURL: "https://api.example.com",
  serverTime: {
    clock: apiServerClock
  }
});

await api.get("/me");

apiServerClock.getServerTimeMs();
```

## 동작 메모

- `bodySchema`가 있으면 요청 전 JSON body를 검증합니다.
- `rawBody`는 `FormData`, `Blob`, `URLSearchParams`, 이미 직렬화된 body에 사용합니다.
- `responseSchema`가 실패하면 response validation error가 발생합니다.
- 기본 성공 결과는 `{ code, message?, response }` 형태입니다.
- `serverTime: true`는 내부 clock을 만들고 `api.serverTime`으로 노출합니다. `serverTime.clock`은 호출자가 소유한 clock에 기록합니다.
- logging은 hook으로 구현되어 custom hook과 조합할 수 있습니다.

## 주의할 점

- 기본 auth refresh 대상은 401과 419이며, refresh 중복 호출은 dedupe됩니다.
- retry는 읽기 요청에 맞춘 보수적 기본값을 사용하므로 write 요청은 명시 설정이 필요합니다.
- HTTP error는 server의 `code`, `message`를 우선 사용하고 fallback은 비어 있는 값만 채웁니다.
- server time header가 없거나 올바르지 않으면 무시합니다.
- `handleApiRoute`는 알려진 API error만 변환하고 알 수 없는 error는 다시 throw합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/session`은 token 저장과 refresh 정책을 담당합니다.
- `@maxxuxx/ts-utils/http-response`는 간단한 Web Response helper입니다.
- `@maxxuxx/ts-utils/parser` 또는 `z` schema를 request/response 검증에 사용할 수 있습니다.
