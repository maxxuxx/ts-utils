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

## API fetch

API fetch utilities are available through the `api-fetch` subpath

```ts
import {
  createApiFetcher,
  endpoint,
  handleApiRoute,
  z
} from "@maxxuxx/ts-utils/api-fetch";
```

Create a fetcher with request and response validation

```ts
const api = createApiFetcher({
  baseURL: "https://api.example.com"
});

const User = z.object({
  id  : z.number(),
  name: z.string()
});

const response = await api.post("/users", {
  body          : { name: "haru" },
  bodySchema    : z.object({
    name: z.string().min(1)
  }),
  responseSchema: User,
  errorFallback : {
    message: "사용자 정보를 저장하지 못했습니다"
  }
});

response.code; // HTTP status code
response.data; // validated response body
```

Successful calls return `{ code, message?, data }` by default. `code` is the HTTP status code, `message` is copied from `body.message` when present, and `data` is the parsed body. If the validated body has a `data` property plus `code` or `message`, `data` is automatically unwrapped to the inner `body.data` value unless `select` is provided.

For non-2xx responses, `ApiHttpError.status` is the HTTP status code, `ApiHttpError.code` uses `body.code` then `errorFallback.code`, and `ApiHttpError.message` uses `body.message`, then `errorFallback.message`, then the default technical request message.

Reusable endpoints can define method, path params, query strings, request body schema, response schema, and result selection

```ts
const getUser = endpoint.get("/users/:id", {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  responseSchema: User
});

const response = await api.call(getUser, {
  params: { id: "1" }
});

response.data;
```

Token refresh is injected so apps can use cookies, browser storage, iron-session, or custom stores

```ts
const api = createApiFetcher({
  auth: {
    getAccessToken: () => tokenStore.get()?.accessToken,
    refresh: async () => {
      const token = await refreshAccessToken();

      tokenStore.set(token);

      return token.accessToken;
    },
    clear: () => tokenStore.clear()
  }
});
```

API calls can log method, status code, elapsed time, and endpoint path

```ts
const api = createApiFetcher({
  logging: true
});
```

Example output

```text
✅ GET    200    8 ms /users/1
⚠️ POST   500   42 ms /users
❌ GET    ERR    3 ms /offline
```

Route handlers can share error-to-response handling

```ts
export async function GET() {
  return handleApiRoute(getUserResponse, {
    authMessage    : "로그인이 필요합니다",
    responseMessage: "사용자 응답이 올바르지 않습니다"
  });
}
```

See [src/api-fetch/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/api-fetch/readme.md) for module details

## HTTP response

HTTP response helpers are available through the `http-response` subpath

```ts
import {
  badRequest,
  jsonResponse,
  unauthorized
} from "@maxxuxx/ts-utils/http-response";
```

Use them in route handlers that return Web `Response` objects

```ts
return jsonResponse({
  ok: true
});
```

Status helpers accept caller-provided messages and use English defaults when omitted

```ts
return unauthorized("로그인이 필요합니다");
return badRequest();
```

See [src/http-response/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/http-response/readme.md) for module details

## Env

Runtime environment helpers are available through the `env` subpath

```ts
import { env, envSchema, z } from "@maxxuxx/ts-utils/env";

const Config = z.object({
  API_URL: envSchema.string(),
  DEBUG  : envSchema.boolean().default(false),
  PORT   : envSchema.number().default(3000)
});

const config = env.parse(Config, import.meta.env);
const apiUrl = env.require("API_URL");
```

See [src/env/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/env/readme.md) for module details

## Object

Object helpers are available through the `object` subpath

```ts
import { compact, mergeDefaults, object, omit, pick } from "@maxxuxx/ts-utils/object";

const publicUser = omit(user, ["passwordHash"]);
const summary = object.pick(user, ["id", "name"]);
const query = compact({
  page: 1,
  keyword: "",
  categoryId: null,
  locale: undefined
});
const options = mergeDefaults({
  timeout: 5000
}, {
  timeout: 10000,
  retry: 1
});
```

See [src/object/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/object/readme.md) for module details

## URL

URL helpers are available through the `url` subpath

```ts
import { appendQuery, buildUrl, joinPath, url } from "@maxxuxx/ts-utils/url";

const path = joinPath("/api/v1", "/users/", 1);
const usersPath = appendQuery("/users", {
  page: 1,
  keyword: "",
  categoryId: null
});
const href = buildUrl("https://api.example.com/api", "/users", {
  page: 1
});
const nested = url.join("/groups", groupId, "/members");
```

See [src/url/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/url/readme.md) for module details

## Promise

Promise helpers are available through the `promise` subpath

```ts
import { promise, retry, run } from "@maxxuxx/ts-utils/promise";

const user = await run(fetchUser, {
  timeoutMs: 5000,
  retries: 2,
  delayMs: 300
});

const { orders, notifications } = await promise.allObject({
  orders: {
    task: fetchOrders,
    retries: 3
  },
  notifications: fetchNotifications
}, {
  timeoutMs: 5000,
  retries: 2,
  delayMs: 300
});

const retryOnly = await retry(fetchOrders, {
  retries: 2
});
```

See [src/promise/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/promise/readme.md) for module details

## JSON

JSON helpers are available through the `json` subpath

```ts
import { json, parseJson, safeStringifyJson } from "@maxxuxx/ts-utils/json";

const config = parseJson(localStorage.getItem("config"), {
  fallback: {
    theme: "light"
  }
});

const result = json.safeParseWithSchema(input, UserSchema);

if (result.ok) {
  result.data;
}

const text = json.stringify(config);
const textResult = safeStringifyJson(config);
```

See [src/json/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/json/readme.md) for module details

## Encoding

Encoding helpers are available through the `encoding` subpath

```ts
import { base64, encoding, hex, utf8 } from "@maxxuxx/ts-utils/encoding";

const bytes = utf8.encode("안녕");
const text = utf8.decode(bytes);
const token = base64.encode(text);
const restored = base64.decode(token);
const encodedHex = hex.encode(restored);

encoding.base64.toBytes(token);
```

See [src/encoding/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/encoding/readme.md) for module details

## JWT

JWT helpers are available through the `jwt` subpath

```ts
import { decodeJwt, decodeJwtHeader, jwt } from "@maxxuxx/ts-utils/jwt";

const claims = decodeJwt(token);
const header = decodeJwtHeader(token);

if (claims) {
  claims.token;
  claims.exp;
}

jwt.decode(token);
```

These helpers only decode JWT segments. They do not verify signatures, issuers, audiences, or expiration policy

See [src/jwt/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/jwt/readme.md) for module details

## Electron log

Electron logging helpers are exported as process specific subpaths

`electron-log` is included as a package dependency

Electron itself is expected to be provided by Electron apps

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

## Electron updater

Electron update helpers are exported as process specific subpaths

`electron` and `electron-updater` are optional peer dependencies and should be installed by the Electron app

```bash
npm install electron-updater
npm install -D electron electron-builder
```

```ts
import { createUpdaterService } from "@maxxuxx/ts-utils/electron-updater/main";
import { createUpdaterBridge } from "@maxxuxx/ts-utils/electron-updater/preload";
import { createPublishConfig } from "@maxxuxx/ts-utils/electron-updater/builder";
```

Main process update state, renderer IPC bridge helpers, and S3/GitHub/generic publish config helpers are included

See [src/electron-updater/readme.md](https://github.com/maxxuxx/ts-utils/blob/main/src/electron-updater/readme.md) for module details

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
