# Promise 모듈

[English](./readme.md)

sleep, timeout, retry, key별 single-flight, parallel task execution, result-style settle을 위한 dependency-free helper입니다

## 언제 사용하나

- async 작업에 timeout과 retry가 필요하지만 별도 control-flow library를 추가하고 싶지 않을 때 사용합니다.
- 여러 task를 tuple 또는 named object result로 병렬 실행하고 싶을 때 사용합니다.
- 부분 실패를 전체 reject 대신 `{ ok, data }` 또는 `{ ok, error }`로 받고 싶을 때 사용합니다.

## Import

```ts
import {
  createSingleFlight,
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
| `createSingleFlight` | key별 in-flight task 하나를 공유하고 성공 result를 선택적으로 유지합니다 |
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

## Retry 취소 예제

```ts
const user = await retry(async ({ attempt, signal }) => {
  console.log(`attempt ${attempt}`);

  const response = await fetch("/api/user", { signal });

  return await response.json();
}, {
  retries  : 2,
  timeoutMs: 5000
});
```

timeout은 retry delay가 시작되기 전에 attempt signal을 abort하지만, task가 signal을 관찰해야 실제 작업이 중단됩니다

`retry(fetchUser)`와 같은 무인자 callback은 계속 지원되며 전달된 context를 무시합니다

## Single-flight 예제

```ts
const refresh = createSingleFlight<string, Tokens>({
  successTtlMs: 1000
});

const tokens = await refresh.run(userId, refreshTokens);

refresh.clear(userId);
refresh.clear();
console.log(refresh.size);
```

같은 key의 호출은 하나의 in-flight promise를 공유하고 다른 key는 독립적으로 실행됩니다

실패한 작업은 즉시 제거되고 성공한 작업은 `successTtlMs`가 양수일 때만 resolve 시점부터 유지되며 기본 TTL은 `0`입니다

## 동작 메모

- retry가 필요하면 이미 시작된 promise가 아니라 task function을 넘겨야 합니다.
- 모든 task attempt는 1부터 시작하는 `{ attempt, signal }` context를 받습니다
- 기본 option은 `retries: 0`, `delayMs: 300`, timeout 없음입니다.
- 공통 option을 먼저 적용하고, per-task option은 정의된 field만 override합니다.
- `withTimeout`은 existing promise도 받을 수 있지만 retry helper는 task function이 필요합니다.
- `PromiseResult`는 `@maxxuxx/ts-utils/result`의 공통 `Result` contract alias입니다

## 주의할 점

- timeout은 각 retry attempt마다 적용됩니다.
- `PromiseTimeoutError`에는 설정된 timeout millisecond가 포함됩니다.
- sleep, timeout, retry delay, success TTL이 `0`부터 `2_147_483_647` 범위를 벗어나면 `RangeError`를 throw합니다
- 정수가 아닌 retry 횟수는 `RangeError`를 throw합니다
- `sleep(ms, { signal })`은 signal의 abort reason으로 reject하고 timer를 정리합니다
- timeout은 retry가 시작되기 전에 현재 attempt signal을 abort합니다
- signal abort는 취소를 요청하지만 signal을 관찰하지 않는 작업을 강제로 중단하지 못합니다
- `withTimeout`에 이미 시작된 promise를 넘기면 생성된 attempt signal을 전달할 수 없습니다
- `clear`는 single-flight entry를 제거하지만 이미 실행 중인 작업을 abort하지 않습니다

## 관련 모듈

- `@maxxuxx/ts-utils/api-fetch`는 HTTP retry/timeout behavior에 사용합니다.
- `@maxxuxx/ts-utils/try-catch`는 단일 operation result wrapper에 사용합니다.
- `@maxxuxx/ts-utils/result`는 공통 result factory와 transform에 사용합니다
