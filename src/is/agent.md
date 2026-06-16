# Is module notes

## Purpose

This module provides dependency free type guards for broad runtime checks

It is intended for projects that need simple boolean checks and TypeScript narrowing without pulling parser or validation dependencies

## Public shape

Expose utilities through `src/is/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/is`

Do not re-export this module from the root package entry

Provide both named predicate exports and the grouped `is` namespace

```ts
isString(value);
is.string(value);
```

## Internal layout

Keep the module flat in `index.ts` while the implementation remains small and dependency free

Split into files only if the module grows into distinct runtime areas that become hard to scan

## Design decisions

All guards must be dependency free

`isNumber` should reject `NaN`

Use `isFiniteNumber` when `Infinity` must also be rejected

`isObject` follows JavaScript object semantics and accepts arrays, dates, maps, sets, and class instances

`isPlainObject` is the stricter payload-style object check

`isEmpty` is intentionally broad and checks only common container/value emptiness

Keep module docs updated whenever exports or guard behavior changes
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
