# Format module

[한국어](./readme.kr.md)

Dependency-free display helpers for numbers, currency labels, Korean phone numbers, date tokens, and value-unit labels.

## Use this when

- UI code needs small formatting helpers with fallback strings instead of thrown errors.
- Korean service screens need default `ko-KR` number and won currency formatting.
- Phone number and date display should stay consistent across repeated call sites.

## Import

```ts
import {
  format,
  formatNumber,
  formatCurrency,
  formatDate,
  formatPhoneNumber,
  formatValueUnit
} from "@maxxuxx/ts-utils/format";
```

## Core exports

| Export | Role |
|---|---|
| `formatNumber` | Formats finite number-like values with `Intl.NumberFormat`. |
| `formatCurrency` | Formats a number and appends a currency/unit label, `원` by default. |
| `formatDate` | Formats date-like values with simple tokens. |
| `formatPhoneNumber` | Formats common Korean phone number shapes. |
| `formatValueUnit` | Formats a number and appends an arbitrary unit with a separator. |
| `format` | Namespace containing the same helpers. |

## Basic example

```ts
format.number(1234.5);
format.currency(12000);
format.phoneNumber("01012345678");
format.date(new Date(2026, 4, 20), "yyyy.mm.dd");
format.valueUnit(12.5, "kg");
```

## Behavior notes

- The default locale is `ko-KR`.
- `formatDate` supports `yyyy`, `mm`, `dd`, `HH`, `MM`, and `ss` tokens.
- `formatPhoneNumber` handles mobile, Seoul, regional, and `030`, `050`, `060`, `070`, `080` service prefixes
- Eight-digit representative numbers accept only `14YY`, `15YY`, `16YY`, and `18YY` families
- Phone families follow the National Law Information Center [Telecommunications Numbering Rules](https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000206775&chrClsCd=010201)
- `formatValueUnit` defaults to a single-space separator.

## Edge cases

- Invalid inputs return the provided `fallback`, which defaults to an empty string.
- Unknown 10-digit and 11-digit prefixes are returned as normalized digits without added separators
- Unsupported eight-digit `17YY` and `19YY` values use the configured fallback
- Unsafe `bigint` values and invalid dates are treated as invalid number inputs.
- `formatValueUnit` returns fallback when the unit is blank.
- Use `normalize` when you need data coercion without display formatting.

## Related modules

- `@maxxuxx/ts-utils/normalize` for fallback-first value coercion.
- `@maxxuxx/ts-utils/parser` when input must be validated before formatting.
