# Try catch module notes

## Purpose

This module provides small dependency free helpers for converting thrown or rejected errors into typed result objects

It is intended for app code that prefers explicit success and failure branches instead of `try` and `catch` blocks at every call site

## Public shape

Expose try catch utilities through `src/try-catch/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/try-catch`

Do not add runtime dependencies to this module

Do not re-export this module from the root package entry

```ts
const result = tryCatch(() => risky());
const asyncResult = await tryCatchAsync(() => riskyAsync());
```

## Internal layout

`index.ts` contains the public result types, sync and async wrappers, and minimal unknown error helpers

Keep the module flat unless new behavior creates real file level separation

## Design decisions

`tryCatch` is for synchronous callbacks

`tryCatchAsync` is for promise returning callbacks and catches both promise rejection and synchronous throws before the promise is created

Failures preserve the original caught value as `unknown` by default

Use `getErrorMessage` when display or logging code needs a safe string message

Use `normalizeError` when downstream code requires an `Error` instance

The result union is discriminated by `ok`

Public result types alias branches from the shared `Result` contract and wrappers use the shared `ok` and `err` factories
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
