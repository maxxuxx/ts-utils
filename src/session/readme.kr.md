# Session 모듈

[English](./readme.md)

framework-independent storage, SvelteKit cookie session, React browser storage를 위한 token session controller입니다.

## 언제 사용하나

- auth state를 storage layer와 분리하고 싶을 때 사용합니다.
- access token이 opaque 또는 JWT일 수 있고 refresh-token 사용 여부를 설정해야 할 때 사용합니다.
- SvelteKit과 React app에서 같은 token lifecycle rule을 공유하고 싶을 때 사용합니다.

## Import

```ts
import {
  createTokenSession,
  TokenSessionError,
  type TokenSessionTokens
} from "@maxxuxx/ts-utils/session";
import { createSession } from "@maxxuxx/ts-utils/session/sveltekit";
import { createReactTokenSession } from "@maxxuxx/ts-utils/session/react";
```

## 주요 export

| Export | 역할 |
|---|---|
| `createTokenSession` | storage와 분리된 token session controller를 생성합니다. |
| `TokenSessionError`, `TokenSessionReason` | unauthorized, invalid, invalid-token, expired session failure를 표현합니다. |
| `session/sveltekit` | iron-session 기반 SvelteKit cookie session adapter를 생성합니다. |
| `session/react` | subscription과 React hook을 가진 browser storage session을 생성합니다. |
| `TokenSessionTokens`, `TokenSessionData`, controller types | 공유 session contract입니다. |

## 기본 예제

```ts
type User = {
  id: string;
};

type Tokens = TokenSessionTokens & {
  accessToken: string;
  refreshToken?: string;
};

const session = createTokenSession<void, User, Tokens>({
  read: () => store.get() ?? {},
  write: (_context, next) => store.set(next),
  clear: () => store.clear(),
  useRefreshToken: false
});

await session.set(undefined, {
  user: {
    id: "user-1"
  },
  tokens: {
    accessToken: "opaque-access-token"
  }
});

const user = await session.ensure(undefined);
```

## 동작 메모

- `useRefreshToken`의 기본값은 `true`입니다. access-token-only API는 `false`로 설정합니다.
- `jwtSchema`가 있을 때만 JWT parsing과 expiration check가 실행됩니다.
- `jwtSchema`가 없으면 opaque access token을 허용합니다.
- `parseTokens`는 login 또는 refresh response token을 저장 전에 검증합니다.

## 주의할 점

- refresh token이 필요한 설정에서 refresh token이 없으면 `invalid_token`입니다.
- 만료된 JWT는 `refreshTokens`가 있으면 refresh하고, 없으면 `expired`입니다.
- 동일 refresh token으로 들어온 concurrent refresh는 기본적으로 dedupe됩니다.
- SvelteKit adapter는 call 인자 또는 `getCookies`에서 cookies가 필요하며 없으면 session error가 발생합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/jwt`는 lower-level JWT decode와 expiration check에 사용합니다.
- `@maxxuxx/ts-utils/api-fetch`는 auth header injection과 refresh retry에 사용합니다.
- `@maxxuxx/ts-utils/env`는 session secret 설정에 사용합니다.
