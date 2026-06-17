# Promise 모듈

[English](./readme.md)

sleep, timeout, retry, parallel task execution, result-style settle을 위한 dependency-free helper입니다.

## 언제 사용하나

- async 작업에 timeout과 retry가 필요하지만 별도 control-flow library를 추가하고 싶지 않을 때 사용합니다.
- 여러 task를 tuple 또는 named object result로 병렬 실행하고 싶을 때 사용합니다.
- 부분 실패를 전체 reject 대신 `{ ok, data }` 또는 `{ ok, error }`로 받고 싶을 때 사용합니다.

## Import

```ts
import {
  promise,
  run,
  retry,
  withTimeout,
  allObject,
  settleObject
} from "@maxxuxx/ts-utils/promise";
```

## 주요 export

| Export | 역할 |
|---|---|
| `sleep` | 0 이상의 millisecond만큼 대기합니다. |
| `withTimeout` | task function 또는 existing promise에 timeout을 적용합니다. |
| `retry`, `run` | retry와 timeout option으로 task function을 실행합니다. |
| `all`, `allObject` | configured task를 병렬 실행하고 첫 실패에서 reject합니다. |
| `settle`, `settleObject` | configured task를 병렬 실행하고 result object를 반환합니다. |
| `promise` | 동일 helper를 묶은 namespace입니다. |

## 기본 예제

```ts
const result = await promise.allObject({
  user: fetchUser,
  orders: {
    task: fetchOrders,
    retries: 2,
    delayMs: 100
  }
}, {
  timeoutMs: 5000
});
```

## 동작 메모

- retry가 필요하면 이미 시작된 promise가 아니라 task function을 넘겨야 합니다.
- 기본 option은 `retries: 0`, `delayMs: 300`, timeout 없음입니다.
- 공통 option을 먼저 적용하고, per-task option은 정의된 field만 override합니다.
- `withTimeout`은 existing promise도 받을 수 있지만 retry helper는 task function이 필요합니다.

## 주의할 점

- timeout은 각 retry attempt마다 적용됩니다.
- `PromiseTimeoutError`에는 설정된 timeout millisecond가 포함됩니다.
- 음수/비유한 timing 값과 정수가 아닌 retries는 `RangeError`를 throw합니다.
- timeout된 작업은 task가 별도 abort signal을 보지 않는 한 자동 취소되지 않습니다.

## 관련 모듈

- `@maxxuxx/ts-utils/api-fetch`는 HTTP retry/timeout behavior에 사용합니다.
- `@maxxuxx/ts-utils/try-catch`는 단일 operation result wrapper에 사용합니다.
