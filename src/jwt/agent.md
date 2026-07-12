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
const typedClaims = jwt.decodeWithSchema(token, claimsSchema);
const header = jwt.decodeHeader(token);
const shouldRefresh = jwt.isExpired(token, 30);
```

## Design decisions

All helpers must be dependency free

This module only decodes JWT segments. Do not add signature verification, issuer validation, audience validation, cookie storage, or refresh API behavior here

`decodeJwt` returns payload claims with the original `token` attached so app auth code can keep the raw bearer token beside parsed claims

`decodeJwt` and `decodeJwtHeader` expose only the built-in JWT payload and header types and return `null` on failure. Do not add caller-selected generics to schema-free decoders

Custom claim and header typing requires `JwtSchema<TValue>` through the `WithSchema` functions. Schema parsing runs after strict segment decoding and failures are wrapped in `JwtDecodeError` by safe functions

`JwtSchema<TValue>` accepts object output types, including ordinary interfaces, without requiring a string index signature or `JwtObject` inheritance

Schema output must be a plain record at runtime. Reject arrays, `Date`, class instances, `null`, and any other non-plain prototype; accept normal objects and null-prototype records

The attached `token` field is reserved and always contains the original JWT string. Keep `JwtPayloadWithToken<T>` defined with `Omit<T, "token"> & { token: string }` so schema collisions remain type-safe

Delegate every JWT segment decode to `encoding/base64url` so Node and browser-compatible paths reject invalid alphabet, padding, lengths, and UTF-8 identically

JWT `exp` and `iat` are not required by schema-free decoding. App auth modules should use schema-backed functions when required claims need runtime validation and custom typing

`isJwtExpired(token, seconds)` treats a token as expired when it is already expired or will expire within the provided number of seconds. Use this for pre-refresh decisions

`isJwtExpired` may compare the decoded `exp` NumericDate against the current clock, but it must not perform signature, issuer, audience, cookie, refresh, redirect, or logout behavior

Keep this module focused on JWT string decoding. Use app-local code for iron-session, cookies, redirects, refresh endpoints, and logout policy

`JwtResult` aliases the shared `Result` type and safe decode helpers use the shared `ok` and `err` factories

Keep module docs updated whenever JWT behavior, exports, error classes, or runtime assumptions change
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
