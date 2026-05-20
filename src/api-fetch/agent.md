# API fetch module notes

## Purpose

This module provides small fetch utilities for API clients that need Zod request and response validation

It also provides optional token refresh orchestration without coupling the package to any framework session store

## Public shape

Expose API fetch utilities through `src/api-fetch/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/api-fetch`

Do not re-export this module from the root package entry because `zod` must stay module-scoped and optional for consumers

```ts
import { createApiClient, defineEndpoint, HttpMethod, z } from "@maxxuxx/ts-utils/api-fetch";
```

## Internal layout

`types.ts` contains public types, HTTP method constants, endpoint contracts, and token auth contracts

`client.ts` contains `createApiClient`, request execution, and token refresh retry logic

`endpoint.ts` contains `defineEndpoint` and endpoint execution helpers

`body.ts` contains request body validation, response body parsing, and response schema validation

`headers.ts`, `query.ts`, and `url.ts` contain small request building helpers

`errors.ts` contains typed errors for HTTP, validation, parse, and auth failures

`schemas.ts` contains common API response schema helpers

## Design decisions

The client does not know about cookies, local storage, iron-session, or refresh endpoint shapes

Token storage and refresh behavior are injected through `token.getToken`, `token.setToken`, `token.clearToken`, and `token.refreshToken`

Auth defaults to enabled when `token` options exist and disabled otherwise

Requests can override auth with `auth: false`

Refresh retry happens once after `401` or `419` by default

Custom retry policy can be supplied with `token.shouldRefreshOnError`

Concurrent refresh calls are deduped per client instance through a shared refresh promise

The base request layer stays useful without auth, token storage, or endpoint definitions

Keep module docs updated whenever endpoint shape, request options, token behavior, exports, or error behavior changes

`zod` is a package dependency because this module imports and re-exports it
