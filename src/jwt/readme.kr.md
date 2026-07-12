# JWT 모듈

[English](./readme.md)

JWT header/payload segment를 decode하고 expiration metadata를 확인하는 dependency-free helper입니다.

## 언제 사용하나

- signature 검증 없이 client/server code에서 JWT claims를 읽어야 할 때 사용합니다.
- auth code에서 safe decode result와 malformed-token path를 일관되게 다루고 싶을 때 사용합니다.
- `exp`, `now`, future refresh window를 반영한 만료 체크가 필요할 때 사용합니다.

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

## 주요 export

| Export | 역할 |
|---|---|
| `decodeJwt`, `safeDecodeJwt` | payload claims를 decode하고 원본 token을 붙입니다. |
| `decodeJwtWithSchema`, `safeDecodeJwtWithSchema` | custom claim type을 반환하기 전에 decoded payload를 검증합니다 |
| `decodeJwtHeader`, `safeDecodeJwtHeader` | JWT header segment를 decode합니다. |
| `decodeJwtHeaderWithSchema`, `safeDecodeJwtHeaderWithSchema` | custom header type을 반환하기 전에 decoded header를 검증합니다 |
| `isJwtExpired` | 선택적 `now`, `withinSeconds`와 함께 `exp` claim을 확인합니다. |
| `JwtDecodeError` | safe decode helper가 사용하는 error wrapper입니다. |
| `jwt` | decode, header decode, safe decode, expiration helper namespace입니다. |

## 기본 예제

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

## 동작 메모

- 이 모듈은 claim decode만 수행합니다. signature, algorithm, issuer, audience, key는 검증하지 않습니다.
- `decodeJwt`는 malformed token 또는 object가 아닌 payload에서 `null`을 반환합니다.
- `safeDecodeJwt`는 `{ ok, data }` 또는 `{ ok, error: JwtDecodeError }`를 반환합니다.
- schema-free decoder는 built-in JWT type만 노출하며 custom claim/header는 schema가 필요합니다
- schema-backed decoder는 `parse(value: unknown)` structural schema를 받고 parse된 값이 runtime에서 plain record여야 하며 array, `Date`, class instance, `null`은 거부합니다
- 붙이는 `token` key는 reserved field이므로 schema가 반환한 `token` claim 대신 원본 JWT string을 사용하고 `JwtPayloadWithToken<T>`에서도 `string`으로 typing합니다
- `JwtSchema<T>`는 Zod object output, object type alias, 일반 interface를 지원하며 `T`가 `JwtObject`를 extends하거나 string index signature를 선언할 필요가 없습니다
- header와 payload segment는 모든 runtime에서 strict base64url과 fatal UTF-8 decode를 사용합니다
- `isJwtExpired`는 malformed token과 missing/non-numeric `exp`를 expired로 봅니다.
- `JwtResult`는 `@maxxuxx/ts-utils/result`의 공통 `Result` contract alias입니다

## 주의할 점

- `exp`는 JWT NumericDate seconds로 해석하고 millisecond 기준으로 비교합니다.
- `withinSeconds`는 곧 만료될 token을 refresh 대상으로 보기 위해 expired처럼 처리합니다.
- `now`는 number 또는 `Date`를 받을 수 있고 invalid 값은 `Date.now()`로 fallback됩니다.
- invalid base64url alphabet, misplaced/non-canonical padding, impossible length, invalid UTF-8은 기존 null/error failure 형태로 반환됩니다
- JWT 만료가 token refresh와 storage를 움직여야 한다면 `session`을 사용합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/session`은 token lifecycle과 refresh에 사용합니다.
- `@maxxuxx/ts-utils/encoding`은 lower-level byte/base64 helper입니다.
- `@maxxuxx/ts-utils/result`는 공통 result factory와 transform에 사용합니다
