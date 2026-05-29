# JWT module

Dependency free helpers for reading JWT header and payload segments

## Public API

```ts
import {
  decodeJwt,
  decodeJwtHeader,
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
const result = jwt.safeDecode(token);
```

## Important

These helpers only decode JWT segments. They do not verify signatures, issuers, audiences, or expiration policy.

Use this module for reading token contents in client code or lightweight server utilities. Use a JWT verification library or server auth layer when trust decisions are required.
