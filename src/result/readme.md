# Result module

[한국어](./readme.kr.md)

Dependency-free primitives for explicit success and failure values with a shared discriminated shape

## Use this when

- An operation should return data or an error without throwing
- Several modules need the same `{ ok, data }` and `{ ok, error }` contract
- Successful data or failed errors need a small type-safe transformation

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

## Core exports

| Export | Role |
|---|---|
| `Result` | Discriminated success or failure type |
| `ok` | Creates a successful result containing data |
| `err` | Creates a failed result containing an error |
| `map` | Transforms successful data |
| `mapError` | Transforms failed errors |

## Basic example

```ts
const parsed: Result<number, string> = ok(2);
const doubled = map(parsed, (value) => value * 2);

const failed = err("invalid value");
const normalized = mapError(failed, (message) => new Error(message));
```

## Behavior notes

- `ok` and `err` preserve the provided value without cloning or normalization
- `map` returns the original failure object when no data transformation applies
- `mapError` returns the original success object when no error transformation applies
- Transformation callbacks run synchronously and thrown values are not captured

## Edge cases

- `TError` defaults to `unknown` so callers must narrow untyped errors before use
- Use `try-catch` when thrown or rejected values should be converted into a result
- Use `promise` when several asynchronous tasks should settle into results

## Related modules

- `@maxxuxx/ts-utils/try-catch` for synchronous and asynchronous error boundaries
- `@maxxuxx/ts-utils/promise` for result-style task settling
- `@maxxuxx/ts-utils/json`, `encoding`, and `jwt` for module-specific result aliases
