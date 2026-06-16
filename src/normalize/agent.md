# Normalize module notes

## Purpose

This module provides dependency free normalization helpers for user input, configuration values, and small payload edges

## Public shape

Expose utilities through `src/normalize/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/normalize`

Provide both named exports and short grouped namespaces

```ts
toNumber(value);
to.number(value);
isNotEmptyString(value);
is.notEmptyString(value);
```

## Internal layout

Keep the module flat in `index.ts` while the implementation remains small

Split into files only if the module grows into distinct runtime areas that become hard to scan

## Design decisions

All helpers must be dependency free

Normalizers return predictable fallback values instead of throwing

`toDate` returns a cloned date so callers cannot mutate the original input by accident

`toDateString` uses lightweight token replacement and no date library

`toFlagBoolean` keeps backend DTO mapping ergonomic by accepting a custom true value

`isRecord` is intentionally stricter than JavaScript object semantics and only accepts plain records

Keep module docs updated whenever exports or normalization behavior changes
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
