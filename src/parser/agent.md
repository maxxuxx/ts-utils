# Parser module notes

## Purpose

This module centralizes Zod based runtime validation helpers that are useful across TypeScript projects

## Public shape

Expose parser utilities through `src/parser/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/parser`

Do not re-export this module from the root package entry because consumers should opt into Zod-backed helpers explicitly

Consumers should use the namespaced `parser` object instead of predicate-looking names like `IsNumber`

```ts
parser.number.parse(10);
parser.coerce.number.parse("10");
parser.id.parse(params.id);
```

## Internal layout

`types.ts` contains exported parser type aliases

`create-parser.ts` contains the schema wrapper factory

`helpers.ts` contains internal preprocessing helpers

`presets.ts` contains the exported `parser` collection

## Design decisions

Strict parser presets do not coerce input values

Coerce parser presets are intended for route params, query strings, environment values, and form values

`parser.coerce.boolean` intentionally does not use raw `z.coerce.boolean()` because JavaScript truthiness would convert `"false"` to `true`

`parser.page` and `parser.limit` treat empty strings as missing values so query strings can fall back to defaults

`parser.id` accepts positive integer values and coerces string input

Keep module docs updated whenever parser behavior, exports, or internal file layout changes

`zod` is a package dependency because this module imports and re-exports it
