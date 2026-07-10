# Try catch 모듈

[English](./readme.md)

동기/비동기 error boundary를 result 형태로 다루는 dependency-free helper입니다.

## 언제 사용하나

- 작은 operation이 throw 대신 `{ ok, data }` 또는 `{ ok, error }`를 반환해야 할 때 사용합니다.
- unknown thrown value에서 안전하게 message를 뽑아야 할 때 사용합니다.
- 하위 코드가 `Error` instance를 기대하지만 JavaScript에서는 무엇이든 throw될 수 있을 때 사용합니다.

## Import

```ts
import {
  tryCatch,
  tryCatchAsync,
  getErrorMessage,
  normalizeError,
  type Result
} from "@maxxuxx/ts-utils/try-catch";
```

## 주요 export

| Export | 역할 |
|---|---|
| `tryCatch` | 동기 코드를 실행하고 thrown value를 capture합니다. |
| `tryCatchAsync` | promise-returning code의 rejection과 promise 반환 전 sync throw를 capture합니다. |
| `getErrorMessage` | unknown error value에서 읽을 수 있는 message를 추출합니다. |
| `normalizeError` | unknown thrown value를 `Error` instance로 변환합니다. |
| `Result`, `ResultSuccess`, `ResultFailure` | 공유 result contract입니다. |

## 기본 예제

```ts
const result = await tryCatchAsync(() => fetchUser(id));

if (!result.ok) {
  console.error(getErrorMessage(result.error));
  return;
}

result.data;
```

## 동작 메모

- catch된 값은 `error` field에 원본 그대로 보존됩니다.
- `tryCatchAsync`는 promise가 반환되기 전 sync throw도 capture합니다.
- `getErrorMessage`는 `Error`, string, string `message`가 있는 object, JSON serialize, `String(value)` 순서로 처리합니다.
- `normalizeError`는 기존 `Error` instance를 그대로 반환합니다.
- `Result`, `ResultSuccess`, `ResultFailure`는 `@maxxuxx/ts-utils/result`의 공통 contract를 재사용합니다

## 주의할 점

- thrown shape을 알고 있으면 explicit error generic을 사용하는 것이 좋습니다.
- 이 모듈은 retry, timeout, concurrent task 실행을 담당하지 않습니다.
- async orchestration은 `promise`, JSON-specific failure는 `json`을 사용합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/promise`는 retry, timeout, concurrent task에 사용합니다.
- `@maxxuxx/ts-utils/json`은 JSON-safe result helper에 사용합니다.
- `@maxxuxx/ts-utils/result`는 direct result factory와 transform에 사용합니다
