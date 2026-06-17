# Try catch module

[한국어](./readme.kr.md)

Dependency-free result helpers for synchronous and asynchronous error boundaries.

## Use this when

- A small operation should return `{ ok, data }` or `{ ok, error }` instead of throwing.
- Unknown thrown values need safe message extraction.
- Code expects an `Error` instance but JavaScript may throw anything.

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

## Core exports

| Export | Role |
|---|---|
| `tryCatch` | Runs synchronous code and captures thrown values. |
| `tryCatchAsync` | Runs promise-returning code and captures rejected or synchronously thrown values. |
| `getErrorMessage` | Extracts a readable message from unknown error values. |
| `normalizeError` | Converts unknown thrown values into `Error` instances. |
| `Result`, `ResultSuccess`, `ResultFailure` | Shared result contracts. |

## Basic example

```ts
const result = await tryCatchAsync(() => fetchUser(id));

if (!result.ok) {
  console.error(getErrorMessage(result.error));
  return;
}

result.data;
```

## Behavior notes

- Caught values are preserved as-is in the `error` field.
- `tryCatchAsync` also catches synchronous throws before a promise is returned.
- `getErrorMessage` checks `Error`, strings, objects with string `message`, JSON serialization, then `String(value)`.
- `normalizeError` returns existing `Error` instances unchanged.

## Edge cases

- Use an explicit error generic when the thrown shape is known.
- This module does not retry, timeout, or run tasks concurrently.
- Use `promise` for async orchestration and `json` for JSON-specific parse/stringify failures.

## Related modules

- `@maxxuxx/ts-utils/promise` for retry, timeout, and concurrent tasks.
- `@maxxuxx/ts-utils/json` for JSON-safe result helpers.
