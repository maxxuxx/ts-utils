# ts-utils

[![npm version](https://img.shields.io/npm/v/@maxxuxx/ts-utils.svg)](https://www.npmjs.com/package/@maxxuxx/ts-utils)

Shared TypeScript utilities for projects that need small, reusable runtime helpers

## Install

```bash
npm install @maxxuxx/ts-utils
```

GitHub install is also supported

```bash
npm install github:maxxuxx/ts-utils
```

## Parser utils

Install `zod` only in projects that use the parser module

```bash
npm install zod
```

Parser utils are small wrappers around Zod schemas
They keep the familiar Zod methods and add a simple `is` type guard

```ts
import { parser } from "@maxxuxx/ts-utils/parser";

const number = parser.number.parse(10);
const result = parser.number.safeParse("10");
const valid  = parser.number.is(10);

const coerced = parser.coerce.number.parse("10");
```

Strict parsers validate the original value

```ts
parser.number.parse(10);       // 10
parser.number.safeParse("10"); // success: false
```

Coerce parsers convert common input values before validation

```ts
parser.coerce.number.parse("10");   // 10
parser.coerce.integer.parse("10");  // 10
parser.coerce.boolean.parse("false"); // false
parser.coerce.date.parse("2026-01-01");
```

Common project parsers include repeated validation policy

```ts
const userId = parser.id.parse(params.userId);
const page   = parser.page.parse(query.page);
const limit  = parser.limit.parse(query.limit);
const email  = parser.email.parse(body.email);
const name   = parser.nonEmptyString.parse(body.name);
```

Custom schemas can be wrapped with `createParser`

```ts
import { createParser, z } from "@maxxuxx/ts-utils/parser";

const User = createParser(z.object({
  id:   z.number(),
  name: z.string()
}));

const user = User.parse({
  id:   1,
  name: "haru"
});
```

## Electron log

Electron logging helpers are exported as process specific subpaths

Install `electron-log` only in Electron projects that use this module

```bash
npm install electron-log
```

```ts
import { configureMainLogger } from "@maxxuxx/ts-utils/electron-log/main";
import { exposeBridge } from "@maxxuxx/ts-utils/electron-log/preload";
import { createBridgeLogger } from "@maxxuxx/ts-utils/electron-log";
```

Main process logging supports console, file path, file rotation size, format, and production level filtering

```ts
const logger = configureMainLogger({
  isProduction: app.isPackaged,
  productionLevel: "info",
  file: {
    path: "/absolute/path/to/app.log",
    maxSize: 1024 * 1024
  }
});
```

Renderer logging can write to DevTools console, main process terminal/file logging, or both

```ts
const logger = createBridgeLogger({
  bridge: window.electronLog,
  isProduction: import.meta.env.PROD,
  productionLevel: "info",
  targets: ["console", "terminal"]
});
```

See [src/electron-log/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/electron-log/readme.md) for module details

## Is

Dependency free type guards are available through the `is` subpath

```ts
import { is, isString, isDefined, isPlainObject } from "@maxxuxx/ts-utils/is";

is.string("hello");
is.number(10);
is.nonEmptyArray([1]);
is.validDate(new Date());

isString("hello");
isDefined(value);
isPlainObject(payload);
```

See [src/is/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/is/readme.md) for module details

## Try catch

Dependency free result helpers are available through the `try-catch` subpath

```ts
import { tryCatch, tryCatchAsync, getErrorMessage } from "@maxxuxx/ts-utils/try-catch";

const parsed = tryCatch(() => JSON.parse(input));

if (parsed.ok) {
  parsed.data;
} else {
  getErrorMessage(parsed.error);
}

const user = await tryCatchAsync(() => fetchUser(id));
```

See [src/try-catch/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/try-catch/readme.md) for module details

## Development

```bash
npm install
npm test
npm run build
```