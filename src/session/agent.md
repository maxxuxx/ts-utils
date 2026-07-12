# Session module notes

## Purpose

This module provides reusable token session controllers for apps that store an authenticated user plus access token data

It covers framework independent session logic, SvelteKit cookies through `iron-session`, and React browser storage through `useSyncExternalStore`

## Public shape

Core helpers are exposed through `@maxxuxx/ts-utils/session`

SvelteKit helpers are exposed through `@maxxuxx/ts-utils/session/sveltekit`

React helpers are exposed through `@maxxuxx/ts-utils/session/react`

Do not export framework-specific helpers from the root package entry

## Dependency policy

The core session entry should stay dependency free apart from local JWT and promise helpers

`iron-session` is an optional peer dependency because only SvelteKit/server cookie consumers need it

`react` is an optional peer dependency because only React consumers need hooks

## Internal layout

`types.ts` contains public store, token, refresh, and controller contracts

`core.ts` contains `createTokenSession`, the React-only validated-store controller path, the shared session parser, per-context mutation queues, optional JWT claim parsing, controller-scoped refresh single-flight, refresh decisions, and `TokenSessionError`

`sveltekit.ts` contains the `iron-session` cookie adapter for SvelteKit-style cookies

`react.ts` contains browser storage persistence, subscription, and hook helpers

## Design decisions

The default session data shape is `{ user, tokens }`

Tokens must include an `accessToken` when a session is considered authenticated

`useRefreshToken` defaults to `true`, so refresh tokens are required unless the caller sets `useRefreshToken: false`

Use `useRefreshToken: false` for APIs that only issue access tokens and have no refresh token

SvelteKit helpers can receive `getCookies` so callers can use `getSession()`, `ensure()`, and other methods without passing cookies at every call site

JWT parsing and expiration checks only run when `jwtSchema` is provided, so opaque access tokens are valid in access-token-only apps

JWT schemas validate the strictly decoded payload before the original token is attached. Use the final refresh context claims when code needs the validated claims plus raw token

Session JWT paths use `safeDecodeJwtWithSchema` so invalid base64url and UTF-8 fail before schema parsing in Node and browser-compatible runtimes

Refresh results are parsed through `tokenSchema` and, when configured, `jwtSchema` before being written back to storage

Use `userSchema` and `tokenSchema` together as the single session boundary parser for restored values, controller reads, `set`, `updateUser`, and refresh writes

Apply schema transforms once at each boundary and never pass parsed user or token output back through the same schema before storage

React alone uses the internal validated-store core path because hydration, storage events, and controller writes already prepare its cached snapshots. Keep the public `createTokenSession` path validating raw store reads

Invalid persisted JSON or schema-invalid React session data must be removed from storage and replaced with an empty or configured valid fallback

React sessions are memory-only when `storage` is omitted or set to `"memory"`; persistent `localStorage`, `sessionStorage`, or a custom storage adapter requires an explicit option

React snapshots must be detached, recursively frozen, and identity-stable between committed updates so callers cannot mutate auth state outside controller methods

React snapshot containers must be plain objects or arrays; reject mutable internal-slot containers such as `Date`, `Map`, `Set`, and typed arrays during preparation

React persistence follows prepare, persist, then commit; serialization, `setItem`, or `removeItem` failure must leave the cached snapshot and notifications unchanged

Use the server or initial session only for construction hydration. A matching later storage deletion or clear event produces an empty snapshot

Attach one storage event handler on the first React subscriber, detach it after the last unsubscribe, and filter events by both storage area and key while accepting matching-area clear events

Attach the handler before the first authoritative storage catch-up read so deletion, corruption, or replacement between construction and subscription cannot leave stale state

`refreshThresholdSeconds` refreshes only when a JWT is present, a refresh token exists, and `refreshTokens` is configured

Core refresh single-flight state belongs to each controller and keys work by the exact raw access-token and refresh-token pair so a newer login that reuses a refresh token starts a new generation

Every core refresh participant writes the shared validated token result into its own storage context

Before a pending refresh writes, re-read the context and compare its raw access and refresh token identity with the identity that started the work

Serialize the final refresh re-read, identity check, and awaited write with `clear`, `set`, and the complete `updateUser` read-modify-write transaction in one controller-local queue per context. Never hold this queue during the network refresh

When identity changed to a newer login, return its current access token without writing. When the session was cleared, fail with `TokenSessionError` without writing. When only the user changed, preserve the current user with the refreshed tokens

The core controller is storage agnostic. Apps provide `read`, `write`, and `clear`

Keep API request header formatting in `api-fetch` through `formatTokenHeader`; session should store token data and expose access tokens, not own request headers

Keep module docs updated whenever session shape, refresh behavior, framework adapters, exports, or optional peer dependencies change
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
