# Normalize module

[한국어](./readme.kr.md)

Fallback-first coercion helpers for small unknown-input normalization tasks.

## Use this when

- UI or adapter code needs stable primitive values from unknown input.
- Invalid values should fall back instead of throwing.
- You need lightweight date, text, number, boolean flag, and record checks without schema validation.

## Import

```ts
import {
  to,
  is,
  toNumber,
  toText,
  toDate,
  toDateString,
  toFlagBoolean
} from "@maxxuxx/ts-utils/normalize";
```

## Core exports

| Export | Role |
|---|---|
| `toNumber` | Converts number-like values to finite numbers with fallback. |
| `toText` | Converts defined values to text with fallback for nullish or failing conversion. |
| `toDate`, `toDateString` | Converts date-like values and formats simple date tokens. |
| `toFlagBoolean` | Converts custom true values and common flag strings to booleans. |
| `isNotEmptyString`, `isRecord` | Small guards used by normalization call sites. |
| `to`, `is` | Namespaces containing the same helpers. |

## Basic example

```ts
const page = to.number(query.page, 1);
const title = to.text(input.title);
const active = to.flagBoolean(query.active);
const day = to.dateString(input.createdAt, "yyyy-mm-dd");
```

## Behavior notes

- `toNumber` accepts finite numbers, numeric strings, booleans, safe bigint values, and valid dates.
- `toText` returns valid dates as ISO strings.
- `toDate` clones `Date` instances before returning them.
- `toFlagBoolean` accepts common strings such as `true`, `false`, `yes`, `no`, `on`, `off`, `1`, and `0`.

## Edge cases

- The default number fallback is `0`; the default text fallback is an empty string.
- Invalid dates return the provided fallback or `undefined`.
- `isRecord` accepts object literals and null-prototype objects, and rejects arrays, dates, functions, and `null`.
- Use `parser` or `env` when invalid input should be reported instead of quietly normalized.

## Related modules

- `@maxxuxx/ts-utils/format` for display formatting after normalization.
- `@maxxuxx/ts-utils/parser` for schema-backed validation.
