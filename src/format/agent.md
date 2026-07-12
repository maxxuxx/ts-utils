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

Invalid `Date` values and unsafe `bigint` values must use the fallback instead of formatting through `0`

Korean phone formatting recognizes mobile and area prefixes plus service families `030`, `050`, `060`, `070`, and `080`

Eight-digit representative numbers accept only the official `14YY`, `15YY`, `16YY`, and `18YY` families, not `17YY` or `19YY`

Keep the family list aligned with the National Law Information Center [Telecommunications Numbering Rules](https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000206775&chrClsCd=010201)

Unknown 10-digit and 11-digit prefixes return as normalized digits without misleading Korean separators; other invalid shapes keep using the configured fallback

Keep module docs updated whenever exports or formatting behavior changes
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
