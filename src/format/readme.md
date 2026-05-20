# Format module

Dependency free formatting helpers for numbers, currency labels, Korean phone numbers, dates, and value-unit labels

## Public API

```ts
import {
  format,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPhoneNumber,
  formatValueUnit
} from "@maxxuxx/ts-utils/format";
```

Use named exports for direct imports

```ts
formatNumber(1234);
formatCurrency(12000);
formatPhoneNumber("01012345678");
formatDate(new Date(), "yyyy.mm.dd");
formatValueUnit(12, "kg");
```

Use the `format` namespace when call sites read better grouped by action

```ts
format.number(1234);
format.currency(12000);
format.phoneNumber("01012345678");
format.date(new Date(), "yyyy.mm.dd");
format.valueUnit(12, "kg");
```

## Behavior notes

`formatNumber` uses the platform `Intl.NumberFormat` API

The default locale is `ko-KR`

`formatCurrency` formats the number and appends `원` by default

`formatPhoneNumber` formats common Korean phone numbers such as mobile, Seoul area, local area, and representative numbers

`formatDate` uses simple tokens: `yyyy`, `mm`, `dd`, `HH`, `MM`, and `ss`

`formatValueUnit` formats the number first, then appends the unit with a configurable separator

Invalid inputs return a fallback string, which defaults to an empty string
