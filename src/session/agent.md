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

The core session entry should stay dependency free apart from local JWT helpers

`iron-session` is an optional peer dependency because only SvelteKit/server cookie consumers need it

`react` is an optional peer dependency because only React consumers need hooks

## Internal layout

`types.ts` contains public store, token, refresh, and controller contracts

`core.ts` contains `createTokenSession`, schema parsing, optional JWT claim parsing, refresh decisions, and `TokenSessionError`

`sveltekit.ts` contains the `iron-session` cookie adapter for SvelteKit-style cookies

`react.ts` contains browser storage persistence, subscription, and hook helpers

## Design decisions

The default session data shape is `{ user, tokens }`

Tokens must include an `accessToken` when a session is considered authenticated

Use `mode: "access-token"` for APIs that only issue access tokens and have no refresh token

Use `mode: "refresh-token"` when refresh tokens are mandatory

When `mode` is omitted and `refreshTokens` exists, refresh tokens are treated as required

JWT parsing and expiration checks only run when `jwtSchema` is provided, so opaque access tokens are valid in access-token-only apps

`refreshThresholdSeconds` refreshes only when a JWT is present, a refresh token exists, and `refreshTokens` is configured

The core controller is storage agnostic. Apps provide `readSession`, `writeSession`, and `clearSession`

Keep API request header formatting in `api-fetch` through `formatTokenHeader`; session should store token data and expose access tokens, not own request headers

Keep module docs updated whenever session shape, refresh behavior, framework adapters, exports, or optional peer dependencies change
