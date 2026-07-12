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

`client.ts` contains `createApiFetcher`, method shortcuts, request execution, auth refresh retry, timeout, logging hook composition, and hook orchestration

`endpoint.ts` contains `endpoint.get/post/put/patch/delete`, path param replacement, endpoint param parsing, and endpoint execution helpers

`body.ts` contains JSON request body validation, replayable raw body creation, bounded response reading, response body parsing, and response schema validation

`origin.ts` contains trusted origin normalization and matching

`retry.ts` contains retry defaults, `Retry-After` parsing, exponential delay, and bounded jitter calculations

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

Schema-free calls expose an `unknown` response payload. Public method and endpoint overloads must require runtime `bodySchema`, `responseSchema`, `params`, or `select` fields whenever their corresponding generic contract is selected

Do not let manually constructed `ApiEndpoint` values claim a non-default `TResult` without a runtime `select` function

`errorFallback.code` fills a missing server code while `errorFallback.message` is the configured safe error message because upstream messages are always ignored

Endpoint definitions use `endpoint.get("/users/:id", { params, responseSchema })` so route declarations read like HTTP routes

Endpoint path params are replaced from parsed `params` and encoded with `encodeURIComponent`

Auth only requires `getAccessToken`, optional `refresh`, optional `clear`, and optional `formatTokenHeader`

The default token header is `Authorization: Bearer <accessToken>`

Auth headers are attached only to relative requests, the client-level `baseURL` origin, and explicit `allowedOrigins`

A request-level `baseURL` resolves the URL but never expands the implicit auth trust boundary. Strip merged `Authorization` and `Proxy-Authorization` headers from every untrusted request, including client, endpoint, and request header sources

Public error contexts remove URL userinfo, query strings, and fragments from both `context.path` and `context.url`

HTTP, parse, and validation errors must not retain raw response bodies, response objects, headers, parse text, or validation input bodies

HTTP error messages use configured safe fallbacks or a generic request failure and never upstream response messages

Use `formatTokenHeader` when a project sends the access token through a different header shape, such as `X-Access-Token`

Refresh retry happens once after `401` or `419` by default

Missing refresh callbacks, non-replayable auth requests, refresh throw, empty refresh results, and a second auth response clear the session on a best-effort basis and throw `ApiAuthError`

Concurrent refresh calls are deduped per fetcher and failed access-token value. Re-read and normalize the current access token after refresh so a newer login generation wins over stale results

Each caller races its refresh wait against its own signal without cancelling shared work. Only abort errors created from that observed caller signal may escape as `ApiAbortError`

Refresh and access-token callbacks must produce non-empty control-character-free strings. Auth callback failures use the sanitized `AUTH_CALLBACK_FAILURE` cause descriptor; internal HTTP auth failures use a cloned `HTTP_FAILURE` descriptor without retaining messages, bodies, headers, or callback-owned objects

The SvelteKit adapter separates shared refresh result creation from cookie-context persistence through `refresh` and `applyRefresh`

Adapter dedupe requires `applyRefresh`; every fetcher participant applies the shared result to its own cookies before retrying

Use one stable handle from `createSvelteKitRefreshNamespace<TRefresh>()` plus a stable `getRefreshKey` when different SvelteKit fetcher instances should share refresh work

Typed SvelteKit refresh sharing is in-flight only and uses one flight per handle regardless of caller configuration; do not add adapter success-result caching or cache-based flight partitions

The namespace handle uses an explicit `in out TRefresh` variance annotation plus its opaque brand, so incompatible refresh result contracts cannot share it even when a consumer disables `strictFunctionTypes`. Keep the handle stable outside fetcher construction and keep shared runners in the handle-keyed `WeakMap`

Without a namespace handle, SvelteKit single-flight state belongs to the created adapter and must not collide with unrelated fetchers that happen to use the same token string

Failed or empty refresh results are evicted immediately, while an `applyRefresh` failure clears only the affected cookie context through the normal terminal auth path

`dedupeRefresh: false` keeps direct refresh compatibility and allows `refresh` to return the next access token without `applyRefresh`

General retry is separate from auth refresh and defaults to `GET` only

General retry uses one request-wide budget, respects `Retry-After` by default, and supports fixed or exponential delay with bounded jitter

JSON validation, transformation, and serialization happen once per logical request

Use `rawBodyFactory` for a fresh one-based body per network attempt; structurally stream-like one-shot values passed through `rawBody` are not retried

`maxResponseBytes` rejects declared or streamed oversized responses with `ApiResponseSizeError`

Timeout uses `AbortController` and throws `ApiTimeoutError`

Observed caller cancellation throws `ApiAbortError`, including cancellation during retry delay; custom fetch implementations must reject or otherwise observe the signal during active work

Hooks are available globally and per request for observability

HTTP errors, response JSON parse failures, and response schema validation failures should call `onResponseError` because a response was received

Network failures, aborts, and other pre-response failures should call `onRequestError`

Use `createApiLoggerHooks` to enable built-in API call logs through the existing hook surface

Use `handleApiRoute` in Web `Response` route handlers when repeated try/catch blocks only convert `ApiAuthError`, `ApiHttpError`, `ApiParseError`, and response-target `ApiValidationError` into HTTP responses

`handleApiRoute` should preserve `ApiHttpError.code` in JSON responses when present and resolve messages from `codeMessages`, then `statusMessages`, then the configured or generic fallback without exposing raw upstream messages

`handleApiRoute` options should stay optional, and the default route error message should remain `API request failed`

The default log format is `emoji METHOD code duration endpoint`

The duration number is right aligned to a 4 character field before `ms`

Default log messages never include request bodies, headers, or bearer tokens

Keep module docs updated whenever endpoint shape, request options, auth behavior, retry behavior, logging behavior, hooks, exports, or error behavior changes

`zod` is a package dependency because this module imports and re-exports it
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
