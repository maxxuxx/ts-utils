# Promise module

[한국어](./readme.kr.md)

Dependency-free helpers for sleep, timeout, retry, parallel task execution, and result-style settling.

## Use this when

- Async work needs timeout and retry without adding a control-flow library.
- Multiple tasks should run in parallel as either tuples or named object results.
- Partial failure should be returned as `{ ok, data }` or `{ ok, error }` instead of rejecting the whole group.

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

## Core exports

| Export | Role |
|---|---|
| `sleep` | Waits for a non-negative number of milliseconds. |
| `withTimeout` | Applies a timeout to a task function or existing promise. |
| `retry`, `run` | Runs a task function with retry and timeout options. |
| `all`, `allObject` | Runs configured tasks in parallel and rejects on the first failure. |
| `settle`, `settleObject` | Runs configured tasks in parallel and returns result objects. |
| `promise` | Namespace containing the same helpers. |

## Basic example

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

## Behavior notes

- Tasks are functions, not already-started promises, when retrying is needed.
- Default options are `retries: 0`, `delayMs: 300`, and no timeout.
- Common options are applied first; per-task options override only fields they define.
- `withTimeout` can accept an existing promise, but retry helpers require task functions.
- `PromiseResult` aliases the shared `Result` contract from `@maxxuxx/ts-utils/result`

## Edge cases

- Timeout applies to each retry attempt.
- `PromiseTimeoutError` includes the configured timeout in milliseconds.
- Negative or non-finite timing values and non-integer retries throw `RangeError`.
- Timed out work is not cancelled unless the task itself observes an abort signal you manage separately.

## Related modules

- `@maxxuxx/ts-utils/api-fetch` for HTTP retry and timeout behavior.
- `@maxxuxx/ts-utils/try-catch` for small result wrappers around one operation.
- `@maxxuxx/ts-utils/result` for shared result factories and transformations
