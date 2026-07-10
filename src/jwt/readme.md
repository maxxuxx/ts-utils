# JWT module

[한국어](./readme.kr.md)

Dependency-free helpers for decoding JWT header and payload segments and checking expiration metadata.

## Use this when

- Client or server code needs to read JWT claims without verifying the signature.
- Auth code needs a safe decode result and a consistent malformed-token path.
- Expiration checks should account for `exp`, `now`, and a future refresh window.

## Import

```ts
import {
  jwt,
  decodeJwt,
  safeDecodeJwt,
  decodeJwtHeader,
  isJwtExpired
} from "@maxxuxx/ts-utils/jwt";
```

## Core exports

| Export | Role |
|---|---|
| `decodeJwt`, `safeDecodeJwt` | Decode payload claims and attach the original token. |
| `decodeJwtHeader`, `safeDecodeJwtHeader` | Decode the JWT header segment. |
| `isJwtExpired` | Checks the `exp` claim with optional `now` and `withinSeconds`. |
| `JwtDecodeError` | Error wrapper used by safe decode helpers. |
| `jwt` | Namespace aliases for decode, header decode, safe decode, and expiration helpers. |

## Basic example

```ts
const claims = jwt.decode(token);

if (claims && !jwt.isExpired(token, {
  withinSeconds: 60
})) {
  claims.sub;
}
```

## Behavior notes

- This module decodes claims only. It does not verify signatures, algorithms, issuers, audiences, or keys.
- `decodeJwt` returns `null` for malformed tokens or non-object payloads.
- `safeDecodeJwt` returns `{ ok, data }` or `{ ok, error: JwtDecodeError }`.
- `isJwtExpired` treats malformed tokens and missing/non-numeric `exp` claims as expired.
- `JwtResult` aliases the shared `Result` contract from `@maxxuxx/ts-utils/result`

## Edge cases

- `exp` is interpreted as JWT NumericDate seconds and compared in milliseconds.
- `withinSeconds` marks tokens expiring soon as expired for refresh planning.
- `now` can be a number or `Date`; invalid `now` falls back to `Date.now()`.
- Use `session` when JWT expiration should drive token refresh and storage.

## Related modules

- `@maxxuxx/ts-utils/session` for token lifecycle and refresh.
- `@maxxuxx/ts-utils/encoding` for lower-level byte and base64 helpers.
- `@maxxuxx/ts-utils/result` for shared result factories and transformations
