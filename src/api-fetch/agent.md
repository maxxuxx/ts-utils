# API fetch module notes

## Purpose

This module provides fetch based API helpers for projects that want small request utilities with Zod validation

It provides method shortcuts, reusable endpoint definitions, bearer token refresh, timeout, retry, logging, and hooks without depending on a framework

## Public shape

Expose API fetch utilities through `src/api-fetch/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/api-fetch`

Do not re-export this module from the root package entry because `zod` must stay module-scoped and optional for consumers

```ts
import { createApiFetcher, endpoint, z } from "@maxxuxx/ts-utils/api-fetch";
```

Primary request vocabulary should stay small and direct

`get`, `post`, `put`, `patch`, `delete`, `query`, `json`, `jsonSchema`, `schema`, and `select`

## Internal layout

`types.ts` contains public types, method constants, fetcher contracts, endpoint contracts, auth contracts, retry contracts, and hook contracts

`client.ts` contains `createApiFetcher`, method shortcuts, request execution, auth refresh retry, timeout, retry, logging hook composition, and hook orchestration

`endpoint.ts` contains `endpoint.get/post/put/patch/delete`, path param replacement, endpoint param parsing, and endpoint execution helpers

`body.ts` contains JSON request validation, response body parsing, and response schema validation

`headers.ts`, `query.ts`, and `url.ts` contain small request building helpers

`logging.ts` contains built-in API call logging formatters and hook adapters

`errors.ts` contains typed errors for HTTP, validation, parse, auth, and timeout failures

`schemas.ts` contains common API response schema helpers

## Design decisions

The public client name is `createApiFetcher`

The old `createApiClient`, `defineEndpoint`, `HttpMethod`, `requestSchema`, `responseSchema`, `transform`, `mapBody`, and `mapQuery` API was intentionally replaced

Method shortcuts are the preferred public API because they avoid exposing method constants at most call sites

`baseURL` uses the casing common in axios and ofetch style APIs

`json` is the request JSON payload and `jsonSchema` validates it before the fetch call

`schema` validates the parsed response body and `select` reshapes the validated response

Endpoint definitions use `endpoint.get("/users/:id", { params, schema })` so route declarations read like HTTP routes

Endpoint path params are replaced from parsed `params` and encoded with `encodeURIComponent`

Auth is intentionally bearer-token oriented and only requires `getAccessToken`, optional `refresh`, and optional `clear`

Refresh retry happens once after `401` or `419` by default

Concurrent refresh calls are deduped per fetcher instance through a shared refresh promise

General retry is separate from auth refresh and defaults to `GET` only

Timeout uses `AbortController` and throws `ApiTimeoutError`

Hooks are available globally and per request for observability

Use `createApiLoggerHooks` to enable built-in API call logs through the existing hook surface

The default log format is `[api] METHOD path status durationMs`

Default log messages never include request bodies, headers, or bearer tokens

Keep module docs updated whenever endpoint shape, request options, auth behavior, retry behavior, logging behavior, hooks, exports, or error behavior changes

`zod` is a package dependency because this module imports and re-exports it
