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
  decodeJwtWithSchema,
  safeDecodeJwt,
  decodeJwtHeader,
  isJwtExpired
} from "@maxxuxx/ts-utils/jwt";
```

## Core exports

| Export | Role |
|---|---|
| `decodeJwt`, `safeDecodeJwt` | Decode payload claims and attach the original token. |
| `decodeJwtWithSchema`, `safeDecodeJwtWithSchema` | Validate decoded payload claims before returning custom claim types |
| `decodeJwtHeader`, `safeDecodeJwtHeader` | Decode the JWT header segment. |
| `decodeJwtHeaderWithSchema`, `safeDecodeJwtHeaderWithSchema` | Validate decoded headers before returning custom header types |
| `isJwtExpired` | Checks the `exp` claim with optional `now` and `withinSeconds`. |
| `JwtDecodeError` | Error wrapper used by safe decode helpers. |
| `jwt` | Namespace aliases for decode, header decode, safe decode, and expiration helpers. |

## Basic example

```ts
const claims = jwt.decode(token);

const roleSchema = {
  parse(value: unknown) {
    const record = value as Record<string, unknown>;

    if (typeof record.role !== "string") {
      throw new TypeError("role required");
    }

    return {
      role: record.role
    };
  }
};

const typedClaims = jwt.decodeWithSchema(token, roleSchema);

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
- Schema-free decoders expose built-in JWT types only; custom claims and headers require a schema
- Schema-backed decoders accept structural schemas with `parse(value: unknown)` and require the parsed value to be a plain record at runtime; arrays, `Date`, class instances, and `null` are rejected
- The attached `token` key is reserved: a schema-returned `token` claim is replaced by the original JWT string and `JwtPayloadWithToken<T>` types that field as `string`
- `JwtSchema<T>` accepts Zod object outputs, object type aliases, and ordinary interfaces without requiring `T` to extend `JwtObject` or declare a string index signature
- Header and payload segments use strict base64url and fatal UTF-8 decoding in every runtime
- `isJwtExpired` treats malformed tokens and missing/non-numeric `exp` claims as expired.
- `JwtResult` aliases the shared `Result` contract from `@maxxuxx/ts-utils/result`

## Edge cases

- `exp` is interpreted as JWT NumericDate seconds and compared in milliseconds.
- `withinSeconds` marks tokens expiring soon as expired for refresh planning.
- `now` can be a number or `Date`; invalid `now` falls back to `Date.now()`.
- Invalid base64url alphabet, misplaced or non-canonical padding, impossible lengths, and invalid UTF-8 return the normal null/error failure shape
- Use `session` when JWT expiration should drive token refresh and storage.

## Related modules

- `@maxxuxx/ts-utils/session` for token lifecycle and refresh.
- `@maxxuxx/ts-utils/encoding` for lower-level byte and base64 helpers.
- `@maxxuxx/ts-utils/result` for shared result factories and transformations
