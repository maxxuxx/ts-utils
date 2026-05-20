# Parser module

Zod based parser utilities for repeated runtime validation patterns

## Public API

```ts
import { createParser, parser, z } from "@maxxuxx/ts-utils/parser";
```

`parser` contains reusable presets

```ts
parser.number.parse(10);
parser.coerce.number.parse("10");
parser.coerce.boolean.parse("false");
parser.id.parse(params.id);
parser.page.parse(query.page);
parser.limit.parse(query.limit);
parser.email.parse(body.email);
parser.nonEmptyString.parse(body.name);
```

`createParser` wraps custom Zod schemas with the same parser interface

```ts
const User = createParser(z.object({
  id:   z.number(),
  name: z.string()
}));

const user = User.parse({
  id:   1,
  name: "haru"
});
```

## Behavior

Strict presets validate input without conversion

```ts
parser.number.parse(10);
parser.number.safeParse("10");
```

Coerce presets convert common route, query, env, and form values before validation

```ts
parser.coerce.number.parse("10");
parser.coerce.integer.parse("10");
parser.coerce.date.parse("2026-01-01");
```

Boolean coercion is explicit

```ts
parser.coerce.boolean.parse("true");
parser.coerce.boolean.parse("false");
parser.coerce.boolean.parse("1");
parser.coerce.boolean.parse("0");
```

`page` defaults to `1`, `limit` defaults to `20`, and `limit` is capped at `100`
