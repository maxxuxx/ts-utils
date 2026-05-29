# JWT module

Dependency free helpers for reading JWT header and payload segments

## Public API

```ts
import {
  decodeJwt,
  decodeJwtHeader,
  isJwtExpired,
  jwt,
  safeDecodeJwt
} from "@maxxuxx/ts-utils/jwt";
```

## Decode payload

Use `decodeJwt` when you only need to read claims from a token.

```ts
const payload = decodeJwt(token);

if (payload) {
  payload.token;
  payload.exp;
  payload.sub;
}
```

`decodeJwt` returns the payload object with the original `token` attached. It returns `null` when the token is missing, malformed, or the payload is not a JSON object.

## Typed claims

Use a generic type when the token shape is known. Common JWT registered claims are `iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, and `jti`.

```ts
type AccessTokenClaims = {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  iat: number;
  jti?: string;
};

const claims = decodeJwt<AccessTokenClaims>(token);

if (claims) {
  claims.sub;
  claims.iss;
  claims.aud;
  claims.exp;
}
```

## Safe decode

Use `safeDecodeJwt` when the failure reason should be handled or logged.

```ts
const result = safeDecodeJwt(token);

if (result.ok) {
  result.data.sub;
  result.data.exp;
} else {
  result.error.message;
}
```

`safeDecodeJwt` returns a result object and preserves the decode failure as `JwtDecodeError`.

## Check expiration

Use `isJwtExpired` when app auth code needs to decide whether a token is already expired.

```ts
const expired = isJwtExpired(token);

if (expired) {
  // refresh the token or clear the local session
}
```

JWT `exp` is a NumericDate in seconds. `isJwtExpired` compares it against the current clock in milliseconds internally.

Malformed tokens, missing `exp` claims, and non-numeric `exp` values are treated as expired.

Pass a number when the token should be treated as expired before it actually expires. The number means "expires within this many seconds".

```ts
const shouldRefresh = isJwtExpired(token, 30);
```

In this example, `shouldRefresh` is `true` when the token is already expired or will expire within 30 seconds.

Use `withinSeconds` when an options object is clearer.

```ts
const shouldRefresh = isJwtExpired(token, {
  withinSeconds: 30
});
```

Tests and server code can pass a fixed clock.

```ts
const expired = isJwtExpired(token, {
  now          : new Date("2026-01-01T00:00:00.000Z"),
  withinSeconds: 30
});
```

## Decode header

Use `decodeJwtHeader` when key metadata is needed before selecting verification keys.

```ts
const header = decodeJwtHeader(token);

const alg = header?.alg;
const typ = header?.typ;
const kid = header?.kid;
```

The header commonly includes `alg`, `typ`, and `kid`.

## Namespace helper

Use the `jwt` namespace when grouped call sites read better than individual imports.

```ts
const claims = jwt.decode(token);
const header = jwt.decodeHeader(token);
const expired = jwt.isExpired(token, 30);
const result = jwt.safeDecode(token);
```

## Important

These helpers only decode JWT segments and compare decoded `exp` values. They do not verify signatures, issuers, or audiences.

Use this module for reading token contents in client code or lightweight server utilities. Use a JWT verification library or server auth layer when trust decisions are required.
