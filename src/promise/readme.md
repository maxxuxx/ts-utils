# Promise module

[한국어](./readme.kr.md)

Dependency-free helpers for sleep, timeout, retry, keyed single-flight work, parallel task execution, and result-style settling

## Use this when

- Async work needs timeout and retry without adding a control-flow library.
- Multiple tasks should run in parallel as either tuples or named object results.
- Partial failure should be returned as `{ ok, data }` or `{ ok, error }` instead of rejecting the whole group.

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

## Core exports

| Export | Role |
|---|---|
| `sleep` | Waits for a non-negative number of milliseconds. |
| `withTimeout` | Applies a timeout to a task function or existing promise. |
| `retry`, `run` | Runs a task function with retry and timeout options. |
| `createSingleFlight` | Shares one in-flight task per key and optionally retains successful results |
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

## Retry cancellation example

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

Timeout aborts the attempt signal before retry delay starts, but work stops only when the task observes the signal

No-argument callbacks such as `retry(fetchUser)` remain supported and simply ignore the context

## Single-flight example

```ts
const refresh = createSingleFlight<string, Tokens>({
  successTtlMs: 1000
});

const tokens = await refresh.run(userId, refreshTokens);

refresh.clear(userId);
refresh.clear();
console.log(refresh.size);
```

Calls with the same key share one in-flight promise while different keys run independently

Rejected work is removed immediately, successful work is retained from its resolution time only when `successTtlMs` is positive, and the default TTL is `0`

## Behavior notes

- Tasks are functions, not already-started promises, when retrying is needed.
- Every task attempt receives `{ attempt, signal }` with a one-based attempt number
- Default options are `retries: 0`, `delayMs: 300`, and no timeout.
- Common options are applied first; per-task options override only fields they define.
- `withTimeout` can accept an existing promise, but retry helpers require task functions.
- `PromiseResult` aliases the shared `Result` contract from `@maxxuxx/ts-utils/result`

## Edge cases

- Timeout applies to each retry attempt.
- `PromiseTimeoutError` includes the configured timeout in milliseconds.
- Sleep, timeout, retry delay, and success TTL values outside `0` through `2_147_483_647` throw `RangeError`
- Non-integer retry counts throw `RangeError`
- `sleep(ms, { signal })` rejects with the signal abort reason and clears its timer
- Timeout aborts the current attempt signal before a retry starts
- Aborting a signal requests cancellation but cannot stop work that does not observe the signal
- Existing promises passed to `withTimeout` cannot receive the generated attempt signal
- `clear` removes single-flight entries but does not abort work that is already running

## Related modules

- `@maxxuxx/ts-utils/api-fetch` for HTTP retry and timeout behavior.
- `@maxxuxx/ts-utils/try-catch` for small result wrappers around one operation.
- `@maxxuxx/ts-utils/result` for shared result factories and transformations
