# API fetch 모듈

[English](./readme.md)

Zod 검증, trusted-origin auth, 재생 가능한 body, response 크기 제한, retry, timeout, hook, logging, route error 변환을 포함한 fetch 기반 API client입니다

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
| `ApiHttpError`, `ApiValidationError`, `ApiParseError`, `ApiTimeoutError` | HTTP, validation, parse, deadline 실패를 나타냅니다 |
| `ApiAuthError`, `ApiAbortError`, `ApiResponseSizeError` | 최종 auth 실패, caller 취소, response byte 제한 실패를 나타냅니다 |
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

## SvelteKit refresh 공유

SvelteKit adapter는 shared refresh result 생성과 cookie 저장을 분리합니다

```ts
import {
  createApiFetcher,
  createSvelteKitRefreshNamespace
} from "@maxxuxx/ts-utils/api-fetch/sveltekit";

type CookieContext = {
  accessToken: string;
  refreshKey : string;
};

type RefreshResult = {
  accessToken: string;
};

const refreshNamespace = createSvelteKitRefreshNamespace<RefreshResult>();

const api = createApiFetcher<CookieContext, RefreshResult>({
  cookies,
  auth: {
    namespace     : refreshNamespace,
    getAccessToken: (context) => context.accessToken,
    getRefreshKey : (context) => context.refreshKey,
    refresh       : async (_context, error) => refreshTokens(error),
    applyRefresh  : async (context, result) => {
      context.accessToken = result.accessToken;

      return context.accessToken;
    },
    clear: async (context) => {
      context.accessToken = "";
    }
  }
});
```

typed namespace handle은 fetcher construction 밖에서 한 번 만들고 refresh 작업을 공유할 fetcher instance에서 같은 handle과 stable refresh key를 재사용합니다

`refresh`는 handle과 key마다 한 번 실행되고 모든 cookie context는 request retry 전에 `applyRefresh`를 실행합니다

서로 다른 handle은 result type과 refresh key가 같아도 격리되며 하나의 handle에는 호환되지 않는 refresh result contract를 지정할 수 없습니다

adapter sharing은 in-flight work만 유지하며 successful refresh result를 cache하거나 cache duration별로 flight를 분리하지 않습니다

namespace handle을 생략하면 refresh single-flight state는 해당 adapter instance 안에만 유지됩니다

`refresh`가 cookie context를 직접 갱신하고 다음 access token을 반환하는 경우에만 `dedupeRefresh: false`로 `applyRefresh`를 생략합니다

## 동작 메모

- `bodySchema`가 있으면 요청 전 JSON body를 검증합니다.
- JSON validation, transformation, serialization은 logical request마다 한 번 실행하고 retry에서는 직렬화된 body를 재사용합니다
- `rawBody`는 `FormData`, `Blob`, `URLSearchParams`, 이미 직렬화된 body에 사용합니다.
- auth 또는 일반 retry마다 새 raw body가 필요하면 one-based `rawBodyFactory(attempt)`를 사용합니다
- `rawBody`와 `rawBodyFactory`는 함께 사용할 수 없고 one-shot `ReadableStream`은 retry하지 않습니다
- `maxResponseBytes`는 선언되었거나 stream으로 읽힌 response가 제한을 넘으면 parsing 전에 거부합니다
- `responseSchema`가 실패하면 response validation error가 발생합니다.
- `responseSchema`가 없으면 기본 `response` payload type은 `unknown`이며 schema 없이 custom result가 필요하면 runtime `select` callback을 사용합니다
- body, response, params, endpoint result generic은 runtime `bodySchema`, `responseSchema`, `params`, `select` contract를 대신할 수 없습니다
- 기본 성공 결과는 `{ code, message?, response }` 형태입니다.
- `serverTime: true`는 내부 clock을 만들고 `api.serverTime`으로 노출합니다. `serverTime.clock`은 호출자가 소유한 clock에 기록합니다.
- logging은 hook으로 구현되어 custom hook과 조합할 수 있습니다.

## 주의할 점

- 기본 auth refresh 대상은 401과 419이며, 실패한 access-token 값마다 하나의 in-flight refresh를 공유합니다
- 현재 access token이 달라진 새 login generation은 이전 refresh에 합류하거나 이전 결과로 retry하지 않습니다
- shared refresh를 기다리는 각 caller는 자신의 abort signal을 관찰하며 한 caller의 abort가 shared refresh를 취소하지 않습니다
- refresh 결과는 비어 있지 않고 control character가 없는 string이어야 하며 사용할 수 없는 값은 retry 없이 terminal auth 처리됩니다
- SvelteKit adapter dedupe에는 `applyRefresh`가 필요하며 실패하거나 비어 있는 shared result는 유지하지 않습니다
- shared typed SvelteKit namespace handle은 하나의 in-flight runner를 사용하므로 같은 stable key는 cache configuration 없이 work를 공유합니다
- SvelteKit `applyRefresh` 실패는 terminal auth 처리에서 해당 request의 cookie context만 clear합니다
- auth는 relative request, client `baseURL` origin, 명시한 `allowedOrigins`에만 전송하며 request-level `baseURL`은 implicit trust anchor가 아닙니다
- untrusted request에서는 client, endpoint, request 설정에서 합쳐진 `Authorization`, `Proxy-Authorization` header를 제거합니다
- refresh callback이 없거나 auth request를 재생할 수 없거나 refresh가 소진되면 session을 best effort로 clear하고 `ApiAuthError`를 throw합니다
- retry는 GET, 요청 전체에서 하나의 budget, `Retry-After`, fixed delay, jitter 없음이 기본이며 write method는 명시해야 합니다
- 관찰된 caller abort는 `ApiAbortError`, deadline 만료는 `ApiTimeoutError`이며 retry delay는 항상 caller signal을 관찰합니다
- custom fetch 구현은 active work 중 caller signal을 직접 관찰하거나 reject해야 합니다
- HTTP error는 server code만 보존할 수 있고 raw body, response, header, parse text, validation input, URL userinfo, query, fragment, upstream message는 보존하지 않습니다
- `ApiAuthError.cause`는 정제된 `HTTP_FAILURE` 또는 `AUTH_CALLBACK_FAILURE` descriptor이며 auth callback error object나 message를 보존하지 않습니다
- `errorFallback.message`는 upstream message가 없을 때만 쓰는 fallback이 아니라 항상 사용하는 configured safe HTTP error message입니다
- configured safe message가 없으면 generic request failure를 사용하고 upstream message는 항상 무시합니다
- `handleApiRoute`는 `ApiHttpError.code`를 보존하고 `codeMessages`, `statusMessages`, `responseMessage`, `API request failed` 순서로 message를 정합니다
- 명시한 mapping callback이 선택하지 않는 한 raw upstream message를 route response에 노출하지 않습니다
- server time header가 없거나 올바르지 않으면 무시합니다.
- `handleApiRoute`는 알려진 API error만 변환하고 알 수 없는 error는 다시 throw합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/session`은 token 저장과 refresh 정책을 담당합니다.
- `@maxxuxx/ts-utils/http-response`는 간단한 Web Response helper입니다.
- `@maxxuxx/ts-utils/parser` 또는 `z` schema를 request/response 검증에 사용할 수 있습니다.
