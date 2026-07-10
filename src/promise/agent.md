# Promise module notes

## Purpose

This module provides dependency free helpers for promise timing, retries, keyed single-flight work, and concurrent task execution

It is intended for API request orchestration and other async workflows that should avoid repeated `Promise.race`, retry loops, keyed in-flight maps, and `allSettled` result shaping at call sites

## Public shape

Expose promise utilities through `src/promise/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/promise`

Provide named exports plus the grouped `promise` namespace

```ts
run(fetchUser, { timeoutMs: 5000, retries: 2 });
promise.allObject({ user: fetchUser });
createSingleFlight<string, User>().run("user", fetchUser);
```

## Design decisions

All helpers must be dependency free

`run`, `retry`, `all`, `allObject`, `settle`, and `settleObject` receive task functions so retries can execute the task again

Do not accept `fetchUser()` style already-created promises for retryable helpers because a rejected promise cannot be retried

`withTimeout` accepts either a task function or an existing promise because timeout wrapping is useful for both cases

Promise tasks receive a one-based `RetryContext` with the attempt number and an attempt-specific `AbortSignal`

Keep no-argument task callbacks source compatible because JavaScript and TypeScript permit them to ignore the provided context

Timer values for sleep, timeout, retry delay, and single-flight success TTL must stay between `0` and `2_147_483_647`

`sleep` accepts an optional signal and rejects with its abort reason when the signal aborts

Timeout aborts an attempt before retry delay begins, but underlying work stops only when the task observes `RetryContext.signal`

Default retries must stay `0` because automatic retries are risky for non-idempotent actions such as POST, payment, or mutation requests

Default timeout must stay unset because callers differ by network, runtime, and request type

Default delay is `300` ms and only matters when retries are enabled

Common options are applied before per-task options in `all`, `allObject`, `settle`, and `settleObject`

Per-task options override only fields that are explicitly defined, so omitted fields continue to inherit common options or module defaults

`settle` and `settleObject` return `{ ok, data }` or `{ ok, error }` result objects instead of native `Promise.allSettled` records so call sites can branch on the same `ok` convention used elsewhere in this package

`PromiseResult` aliases the shared `Result` type and settle helpers use the shared `ok` and `err` factories

`createSingleFlight` uses one map per factory, shares in-flight work by key, removes rejections immediately, and retains successes only for a positive `successTtlMs`

Single-flight TTL starts when the task succeeds, expired entries are removed lazily, and `clear` never aborts work that is already running

Keep module docs updated whenever promise behavior, exports, defaults, or task option semantics change
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
