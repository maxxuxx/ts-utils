# Format module notes

## Purpose

This module provides dependency free display formatting helpers for common UI and logging values

## Public shape

Expose utilities through `src/format/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/format`

Provide named exports plus the grouped `format` namespace

```ts
formatNumber(value);
format.number(value);
formatCurrency(value);
format.currency(value);
```

## Internal layout

Keep the module flat in `index.ts` while the implementation remains small

Split into files only if the module grows into distinct runtime areas that become hard to scan

## Design decisions

All helpers must be dependency free

Use built-in `Intl.NumberFormat` for locale-aware number output

Use explicit `.js` imports for local TypeScript files because the package uses ESM NodeNext

Default number and currency formatting should fit Korean product UI conventions

Date formatting uses lightweight token replacement rather than a date library

Invalid inputs should return a fallback string instead of throwing

Keep module docs updated whenever exports or formatting behavior changes
