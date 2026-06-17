# Parser module

[한국어](./readme.kr.md)

Zod-based parser presets and a small wrapper for repeated runtime validation patterns.

## Use this when

- Route params, query values, form values, or env-like strings need repeated validation.
- Call sites should use `parse`, `safeParse`, `is`, `optional`, `nullable`, and `array` consistently.
- You want common strict and coercing parsers without redefining schemas.

## Import

```ts
import {
  createParser,
  parser,
  z
} from "@maxxuxx/ts-utils/parser";
```

## Core exports

| Export | Role |
|---|---|
| `parser` | Preset parser namespace for strict and coercing values. |
| `createParser` | Wraps a Zod schema with parse, safeParse, is, optional, nullable, and array helpers. |
| `z` | Zod re-export for nearby schema definitions. |
| Strict presets | `string`, `number`, `integer`, `boolean`, `date`, `email`, `nonEmptyString`, `uuid`. |
| Coercing presets | `id`, `page`, `limit`, and `coerce.*` parsers for string-heavy boundaries. |

## Basic example

```ts
const page = parser.page.parse(query.page);
const limit = parser.limit.parse(query.limit);
const email = parser.email.parse(body.email);

const User = createParser(z.object({
  id: z.number(),
  name: z.string()
}));

if (User.is(payload)) {
  payload.name;
}
```

## Behavior notes

- Strict presets validate without conversion.
- `parser.page` defaults to `1`; `parser.limit` defaults to `20` and caps at `100`.
- `parser.id` coerces to a positive integer.
- `parser.coerce.boolean` only accepts explicit boolean-like values from the helper conversion.

## Edge cases

- Empty strings become `undefined` for the coercing number, integer, page, and limit flows that use that preprocess.
- `createParser(...).optional()` and similar methods return new parser wrappers.
- Use `env` when the input source is environment variables and JSON env parsing is needed.
- Use direct Zod schemas for complex cross-field validation.

## Related modules

- `@maxxuxx/ts-utils/env` for environment config parsing.
- `@maxxuxx/ts-utils/api-fetch` for request and response schema validation.
- `@maxxuxx/ts-utils/json` for JSON string boundaries.
