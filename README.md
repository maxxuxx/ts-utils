# ts-utils

[![CI](https://github.com/maxxuxx/ts-utils/actions/workflows/ci.yml/badge.svg)](https://github.com/maxxuxx/ts-utils/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@maxxuxx/ts-utils.svg)](https://www.npmjs.com/package/@maxxuxx/ts-utils)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[한국어](./docs/readme.kr.md) · [0.8 migration guide](./docs/migration-0.8.md)

**TypeScript utility modules for common application development.**

Reusable helpers for API clients, runtime validation, sessions, async control flow, data conversion, formatting, and other everyday TypeScript tasks.

## Install

```bash
npm install @maxxuxx/ts-utils
```

Or install directly from GitHub:

```bash
npm install github:maxxuxx/ts-utils
```

## Quick start

Create a validated API client and reusable endpoint:

```ts
import {
  createApiFetcher,
  endpoint,
  z
} from "@maxxuxx/ts-utils/api-fetch";

const api = createApiFetcher({
  baseURL: "https://api.example.com",
  retry: {
    delay: 250,
    limit: 2,
    strategy: "exponential"
  },
  timeout: 5000
});

const User = z.object({
  id: z.number(),
  name: z.string()
});

const getUser = endpoint.get("/users/:id", {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  responseSchema: User
});

const result = await api.call(getUser, {
  params: {
    id: 42
  }
});

console.log(result.response.name);
```

## Featured modules

| Module | Use it for |
|---|---|
| [`api-fetch`](./src/api-fetch/readme.md) | Validated API clients, typed endpoints, auth refresh, retry, timeout, and hooks |
| [`session`](./src/session/readme.md) | Token sessions for plain TypeScript, React, and SvelteKit applications |
| [`parser`](./src/parser/readme.md) | Reusable strict and coercing Zod parsers |
| [`promise`](./src/promise/readme.md) | Timeout, retry, parallel tasks, settling, and single-flight work |
| [`json`](./src/json/readme.md) | Safe JSON parsing, stringifying, and schema validation |
| [`jwt`](./src/jwt/readme.md) | JWT decoding, schema validation, and expiration checks |

## Module map

| Entry point | Core role | Details |
|---|---|---|
| [`@maxxuxx/ts-utils/parser`](./src/parser/readme.md) | Zod parser presets and wrappers for repeated runtime validation | [parser](./src/parser/readme.md) |
| [`@maxxuxx/ts-utils/is`](./src/is/readme.md) | Runtime type guards for primitives, objects, collections, and built-ins | [is](./src/is/readme.md) |
| [`@maxxuxx/ts-utils/result`](./src/result/readme.md) | Discriminated success and failure values with mapping helpers | [result](./src/result/readme.md) |
| [`@maxxuxx/ts-utils/try-catch`](./src/try-catch/readme.md) | Result helpers for sync and async error boundaries | [try-catch](./src/try-catch/readme.md) |
| [`@maxxuxx/ts-utils/format`](./src/format/readme.md) | Formatting helpers for numbers, currency, dates, phone numbers, and units | [format](./src/format/readme.md) |
| [`@maxxuxx/ts-utils/normalize`](./src/normalize/readme.md) | Small coercion helpers for stable number, text, date, and boolean values | [normalize](./src/normalize/readme.md) |
| [`@maxxuxx/ts-utils/object`](./src/object/readme.md) | Plain object shaping helpers for request and response payloads | [object](./src/object/readme.md) |
| [`@maxxuxx/ts-utils/url`](./src/url/readme.md) | Web path, API URL, and query string helpers | [url](./src/url/readme.md) |
| [`@maxxuxx/ts-utils/promise`](./src/promise/readme.md) | Timeout, retry, parallel, and settle helpers for promise tasks | [promise](./src/promise/readme.md) |
| [`@maxxuxx/ts-utils/json`](./src/json/readme.md) | JSON parse, stringify, fallback, safe result, and schema boundary helpers | [json](./src/json/readme.md) |
| [`@maxxuxx/ts-utils/encoding`](./src/encoding/readme.md) | UTF-8, base64, hex, and byte conversion helpers | [encoding](./src/encoding/readme.md) |
| [`@maxxuxx/ts-utils/encoding/base64url`](./src/encoding/readme.md) | Strict browser and Node base64url text and byte helpers | [encoding/base64url](./src/encoding/readme.md) |
| [`@maxxuxx/ts-utils/jwt`](./src/jwt/readme.md) | JWT header and payload readers with expiration checks | [jwt](./src/jwt/readme.md) |
| [`@maxxuxx/ts-utils/env`](./src/env/readme.md) | Runtime environment readers and Zod schema helpers | [env](./src/env/readme.md) |
| [`@maxxuxx/ts-utils/time`](./src/time/readme.md) | Client/server timestamp helpers for estimating server time | [time](./src/time/readme.md) |
| [`@maxxuxx/ts-utils/device`](./src/device/readme.md) | Runtime-selecting device UUID helper | [device](./src/device/readme.md) |
| [`@maxxuxx/ts-utils/device/browser`](./src/device/readme.md) | Browser and renderer cookie-backed device UUID helpers | [device/browser](./src/device/readme.md) |
| [`@maxxuxx/ts-utils/device/node`](./src/device/readme.md) | Node machine ID based device UUID helpers | [device/node](./src/device/readme.md) |
| [`@maxxuxx/ts-utils/session`](./src/session/readme.md) | Framework-neutral token session controller | [session](./src/session/readme.md) |
| [`@maxxuxx/ts-utils/session/sveltekit`](./src/session/readme.md) | SvelteKit cookie session factory | [session/sveltekit](./src/session/readme.md) |
| [`@maxxuxx/ts-utils/session/react`](./src/session/readme.md) | React browser-storage token session helper | [session/react](./src/session/readme.md) |
| [`@maxxuxx/ts-utils/api-fetch`](./src/api-fetch/readme.md) | Fetch API client with validation, refresh, retry, timeout, hooks, and endpoints | [api-fetch](./src/api-fetch/readme.md) |
| [`@maxxuxx/ts-utils/api-fetch/sveltekit`](./src/api-fetch/readme.md) | SvelteKit adapter for api-fetch auth refresh | [api-fetch/sveltekit](./src/api-fetch/readme.md) |
| [`@maxxuxx/ts-utils/http-response`](./src/http-response/readme.md) | Small Web Response helpers for route handlers | [http-response](./src/http-response/readme.md) |

## Runtime notes

- The package is ESM-only and requires Node.js 22.12 or later for Node-targeted usage.
- Zod is the only direct runtime dependency and is re-exported from schema-oriented subpaths.
- React and iron-session are optional peer dependencies used only by their corresponding session adapters.
- General utility modules are designed for browser and server code; device helpers provide explicit browser and Node entry points.
- Detailed behavior, edge cases, and related APIs live in each module README linked above.

## Development

```bash
npm run typecheck
npm run build
```
