# Result module notes

## Purpose

This module provides dependency free primitives for explicit success and failure values

It is intended for shared boundaries that need one `{ ok, data }` or `{ ok, error }` convention without throwing

## Public shape

Expose Result utilities through `src/result/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/result`

```ts
const result = ok(value);
const next = map(result, transform);
```

## Internal layout

Keep the type, factories, and transformations together in `index.ts` while the module stays this small

Do not add runtime dependencies to this module

## Design decisions

`Result<TData, TError>` is discriminated only by the boolean `ok` field

`ok` stores data and `err` stores errors without cloning or normalization

`map` transforms only successful data and returns the original failure by reference

`mapError` transforms only failed errors and returns the original success by reference

Transformation callbacks may throw and this module does not convert thrown values into results

Keep the runtime object shape compatible with existing package modules that already return `{ ok, data }` and `{ ok, error }`

## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
