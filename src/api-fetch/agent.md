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

`get`, `post`, `put`, `patch`, `delete`, `query`, `body`, `bodySchema`, `responseSchema`, `errorFallback`, and `select`

## Internal layout

`types.ts` contains public types, method constants, fetcher contracts, endpoint contracts, auth contracts, retry contracts, and hook contracts

`client.ts` contains `createApiFetcher`, method shortcuts, request execution, auth refresh retry, timeout, retry, logging hook composition, and hook orchestration

`endpoint.ts` contains `endpoint.get/post/put/patch/delete`, path param replacement, endpoint param parsing, and endpoint execution helpers

`body.ts` contains JSON request body validation, response body parsing, and response schema validation

`headers.ts`, `query.ts`, and `url.ts` contain small request building helpers

`logging.ts` contains built-in API call logging formatters and hook adapters

`route.ts` contains route-handler adapters that convert known API fetch errors into Web `Response` objects

`errors.ts` contains typed errors for HTTP, validation, parse, auth, and timeout failures

`schemas.ts` contains common API response schema helpers

## Design decisions

The public client name is `createApiFetcher`

The old `createApiClient`, `defineEndpoint`, `HttpMethod`, `requestSchema`, `responseSchema`, `transform`, `mapBody`, and `mapQuery` API was intentionally replaced

Method shortcuts are the preferred public API because they avoid exposing method constants at most call sites

`baseURL` uses the casing common in axios and ofetch style APIs

`body` is the request JSON payload and `bodySchema` validates it before the fetch call when provided

`responseSchema` validates the parsed response body

`serverTime: true` creates an internal clock exposed as `api.serverTime`; `serverTime.clock` samples the API response `Date` header into a shared time clock without changing the returned result shape

By default successful requests return `{ code, message?, response }`, where `code` is the HTTP status code, `message` comes from `body.message` when it is a string, and `response` is the validated response body

If the validated response body has a `data` property plus `code` or `message`, the default `response` value unwraps to `body.data`

`select` returns a custom value instead of the default `{ code, message?, response }` result and disables the automatic envelope unwrap for that call

`errorFallback` sets optional `ApiHttpError.code` and `ApiHttpError.message` fallback values when an HTTP error body has no string or number `code` and no string `message`

Endpoint definitions use `endpoint.get("/users/:id", { params, responseSchema })` so route declarations read like HTTP routes

Endpoint path params are replaced from parsed `params` and encoded with `encodeURIComponent`

Auth only requires `getAccessToken`, optional `refresh`, optional `clear`, and optional `formatTokenHeader`

The default token header is `Authorization: Bearer <accessToken>`

Use `formatTokenHeader` when a project sends the access token through a different header shape, such as `X-Access-Token`

Refresh retry happens once after `401` or `419` by default

Concurrent refresh calls are deduped per fetcher instance through a shared refresh promise

General retry is separate from auth refresh and defaults to `GET` only

Timeout uses `AbortController` and throws `ApiTimeoutError`

Hooks are available globally and per request for observability

HTTP errors, response JSON parse failures, and response schema validation failures should call `onResponseError` because a response was received

Network failures, aborts, and other pre-response failures should call `onRequestError`

Use `createApiLoggerHooks` to enable built-in API call logs through the existing hook surface

Use `handleApiRoute` in Web `Response` route handlers when repeated try/catch blocks only convert `ApiAuthError`, `ApiHttpError`, `ApiParseError`, and response-target `ApiValidationError` into HTTP responses

`handleApiRoute` should preserve `ApiHttpError.code` in JSON responses when present and resolve messages from `codeMessages`, then `statusMessages`, then the API error message

The default log format is `emoji METHOD code duration endpoint`

The duration number is right aligned to a 4 character field before `ms`

Default log messages never include request bodies, headers, or bearer tokens

Keep module docs updated whenever endpoint shape, request options, auth behavior, retry behavior, logging behavior, hooks, exports, or error behavior changes

`zod` is a package dependency because this module imports and re-exports it
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
