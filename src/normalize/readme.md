# Normalize module

Dependency free coercion helpers for small input normalization tasks

## Public API

```ts
import {
  is,
  isNotEmptyString,
  isRecord,
  to,
  toDate,
  toDateString,
  toFlagBoolean,
  toNumber,
  toText
} from "@maxxuxx/ts-utils/normalize";
```

Use named exports for direct imports

```ts
toNumber("42");
toText(value);
toDateString("2026-05-20");
toFlagBoolean("yes");
isNotEmptyString(" value ");
isRecord(payload);
```

Use the short namespaces when call sites read better in `to` or `is` style

```ts
to.number("42");
to.text(value);
to.date(input);
to.dateString(input);
to.flagBoolean(input);
is.notEmptyString(value);
is.record(payload);
```

## Behavior notes

`toNumber` accepts finite numbers, numeric strings, booleans, safe bigint values, and valid dates

Invalid number values return the fallback, which defaults to `0`

`toText` preserves strings, converts other defined values with `String`, converts valid dates to ISO strings, and returns the fallback for `null`, `undefined`, invalid dates, or conversion failures

The default text fallback is an empty string

`toDate` accepts valid dates, finite numeric timestamps, and parseable date strings

Dates are cloned before returning

`toDateString` formats a valid date with simple tokens: `yyyy`, `mm`, `dd`, `HH`, `MM`, and `ss`

`toFlagBoolean` accepts a custom true value and common flag strings such as `true`, `false`, `yes`, `no`, `on`, `off`, `1`, and `0`

Unknown flag values return the fallback, which defaults to `false`

`isRecord` accepts plain object records and null-prototype objects, but rejects arrays, dates, functions, and `null`
