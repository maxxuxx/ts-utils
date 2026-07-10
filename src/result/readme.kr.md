# Result 모듈

[English](./readme.md)

명시적인 성공과 실패 값을 공통 discriminated shape으로 다루는 dependency-free primitive입니다

## 언제 사용하나

- operation이 throw 대신 data 또는 error를 반환해야 할 때 사용합니다
- 여러 모듈에서 같은 `{ ok, data }`, `{ ok, error }` contract가 필요할 때 사용합니다
- 성공 data 또는 실패 error를 작고 type-safe하게 변환해야 할 때 사용합니다

## Import

```ts
import {
  err,
  map,
  mapError,
  ok,
  type Result
} from "@maxxuxx/ts-utils/result";
```

## 주요 export

| Export | 역할 |
|---|---|
| `Result` | 성공 또는 실패를 나타내는 discriminated type |
| `ok` | data를 담은 성공 result 생성 |
| `err` | error를 담은 실패 result 생성 |
| `map` | 성공 data 변환 |
| `mapError` | 실패 error 변환 |

## 기본 예제

```ts
const parsed: Result<number, string> = ok(2);
const doubled = map(parsed, (value) => value * 2);

const failed = err("invalid value");
const normalized = mapError(failed, (message) => new Error(message));
```

## 동작 메모

- `ok`와 `err`는 입력 값을 clone하거나 normalize하지 않고 보존합니다
- `map`은 data 변환이 적용되지 않는 실패 object를 원본 reference로 반환합니다
- `mapError`는 error 변환이 적용되지 않는 성공 object를 원본 reference로 반환합니다
- transform callback은 동기 실행되며 thrown value를 capture하지 않습니다

## 주의할 점

- `TError` 기본값은 `unknown`이므로 untyped error는 사용 전에 narrow해야 합니다
- thrown 또는 rejected value를 result로 바꿔야 하면 `try-catch`를 사용합니다
- 여러 async task를 result로 settle해야 하면 `promise`를 사용합니다

## 관련 모듈

- `@maxxuxx/ts-utils/try-catch`는 동기/비동기 error boundary에 사용합니다
- `@maxxuxx/ts-utils/promise`는 result-style task settle에 사용합니다
- `@maxxuxx/ts-utils/json`, `encoding`, `jwt`는 module-specific result alias를 제공합니다
