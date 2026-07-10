# ts-utils

[![npm version](https://img.shields.io/npm/v/@maxxuxx/ts-utils.svg)](https://www.npmjs.com/package/@maxxuxx/ts-utils)

[한국어](./docs/readme.kr.md)

Shared TypeScript utilities for projects that need small reusable runtime helpers

## Install

```bash
npm install @maxxuxx/ts-utils
```

GitHub install is also supported

```bash
npm install github:maxxuxx/ts-utils
```

## Import style

Use subpath imports instead of the package root. The package root is intentionally empty so applications can import only the runtime surface they need

```ts
import { parser } from "@maxxuxx/ts-utils/parser";
import { createApiFetcher } from "@maxxuxx/ts-utils/api-fetch";
import { createTokenSession } from "@maxxuxx/ts-utils/session";
```

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

- General utility modules are dependency-light and designed for browser and server code
- Zod-backed modules re-export `z` from their own subpath when colocated schemas are useful
- Device helpers are split into browser and Node subpaths; prefer the runtime-specific path when the target runtime is known

## Development

```bash
npm run typecheck
npm test
npm run build
```
