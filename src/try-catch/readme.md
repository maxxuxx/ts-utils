# Try catch module

Dependency free result helpers for synchronous and promise based code

## Public API

```ts
import {
  getErrorMessage,
  normalizeError,
  tryCatch,
  tryCatchAsync,
  type Result
} from "@maxxuxx/ts-utils/try-catch";
```

## Sync usage

```ts
const result = tryCatch(() => JSON.parse(input));

if (result.ok) {
  result.data;
} else {
  result.error;
}
```

## Async usage

```ts
const result = await tryCatchAsync(() => fetchUser(id));

if (!result.ok) {
  console.error(getErrorMessage(result.error));
}
```

## Result shape

```ts
type Result<TData, TError = unknown> =
  | { ok: true; data: TData }
  | { ok: false; error: TError };
```

Failures keep the original caught value by default

Use `getErrorMessage(error)` to safely read a message from unknown values

Use `normalizeError(error)` to convert unknown values into an `Error`
