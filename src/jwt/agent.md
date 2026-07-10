# JWT module notes

## Purpose

This module provides dependency free helpers for decoding JWT header and payload segments

It is intended for app auth boundaries that need to read claims from an already received token before applying app-specific validation or refresh policy

## Public shape

Expose JWT utilities through `src/jwt/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/jwt`

Provide named exports plus the grouped `jwt` namespace

```ts
const claims = jwt.decode(token);
const header = jwt.decodeHeader(token);
const shouldRefresh = jwt.isExpired(token, 30);
```

## Design decisions

All helpers must be dependency free

This module only decodes JWT segments. Do not add signature verification, issuer validation, audience validation, cookie storage, or refresh API behavior here

`decodeJwt` returns payload claims with the original `token` attached so app auth code can keep the raw bearer token beside parsed claims

`decodeJwt` and `decodeJwtHeader` return `null` on failure. Use `safeDecodeJwt` and `safeDecodeJwtHeader` when callers need an error object

JWT `exp`, `iat`, and app-specific claims are not required by the decoder. App auth modules should validate required claims after decoding

`isJwtExpired(token, seconds)` treats a token as expired when it is already expired or will expire within the provided number of seconds. Use this for pre-refresh decisions

`isJwtExpired` may compare the decoded `exp` NumericDate against the current clock, but it must not perform signature, issuer, audience, cookie, refresh, redirect, or logout behavior

Keep this module focused on JWT string decoding. Use app-local code for iron-session, cookies, redirects, refresh endpoints, and logout policy

`JwtResult` aliases the shared `Result` type and safe decode helpers use the shared `ok` and `err` factories

Keep module docs updated whenever JWT behavior, exports, error classes, or runtime assumptions change
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
