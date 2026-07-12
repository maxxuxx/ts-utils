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
| `session/react` | opt-in persistence, subscription, React hook을 가진 memory-first browser session을 생성합니다 |
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
- `userSchema`와 `tokenSchema`는 복원한 session 값과 모든 controller write를 검증합니다
- schema-invalid `set`과 `updateUser`는 현재 session을 변경하기 전에 reject됩니다
- schema transform은 read, input, refresh-result boundary마다 한 번 실행하며 parsed output을 storage 전에 다시 parse하지 않습니다
- React core operation은 hydration, storage event, write boundary에서 이미 검증한 snapshot을 재사용해 non-idempotent transform을 다시 적용하지 않습니다
- `jwtSchema`가 있을 때만 JWT parsing과 expiration check가 실행됩니다.
- `jwtSchema`는 원본 token이 붙기 전의 strict decoded payload claim을 검증합니다
- invalid base64url 또는 UTF-8은 `jwtSchema` parsing 전에 실패합니다
- `jwtSchema`가 없으면 opaque access token을 허용합니다.
- `parseTokens`는 login 또는 refresh response token을 저장 전에 검증합니다.

## React persistence

React session은 `storage`를 생략하거나 `"memory"`로 설정하면 controller memory에만 state를 보관합니다

해당 browser boundary를 넘어 session을 유지해야 할 때만 persistent mode를 명시합니다

```ts
const memorySession = createReactTokenSession({
  storageKey: "auth-session",
  tokenSchema,
  userSchema
});

const localSession = createReactTokenSession({
  storage   : "local",
  storageKey: "auth-session",
  tokenSchema,
  userSchema
});

const tabSession = createReactTokenSession({
  storage   : "session",
  storageKey: "auth-session",
  tokenSchema,
  userSchema
});
```

malformed JSON 또는 `userSchema`나 `tokenSchema`가 거부한 값은 controller snapshot을 노출하기 전에 persistent storage에서 제거합니다

server 또는 initial session은 initial hydration에만 사용합니다. 이후 matching storage deletion 또는 clear event는 empty snapshot을 만듭니다

첫 subscriber는 storage handler를 먼저 attach한 뒤 authoritative catch-up read를 실행하므로 construction과 subscription 사이의 deletion 또는 corruption은 empty snapshot이 됩니다

snapshot은 caller reference와 분리해 recursive freeze하고 committed update 사이의 반복 read는 같은 object identity를 반환합니다

snapshot container는 plain object 또는 array여야 합니다. `Date`, `Map`, `Set`, typed array처럼 internal state가 변하는 built-in은 current snapshot 변경 전에 reject합니다

persistent write는 다음 snapshot 준비와 serialization을 먼저 수행하고 storage 성공 후에만 commit하고 notify합니다

## 주의할 점

- refresh token이 필요한 설정에서 refresh token이 없으면 `invalid_token`입니다.
- 만료된 JWT는 `refreshTokens`가 있으면 refresh하고, 없으면 `expired`입니다.
- raw access-token과 refresh-token pair가 모두 같은 concurrent refresh는 기본적으로 한 controller 안에서 dedupe되며 성공 결과는 설정된 cache window 동안 유지될 수 있습니다
- 새 login은 같은 refresh token을 재사용해도 access token이 다르면 새 refresh generation을 시작하므로 이전 login의 pending 또는 retained work에 합류하지 않습니다
- 서로 다른 controller는 refresh-token string이 같아도 refresh state를 공유하지 않습니다
- 하나의 core refresh를 기다린 모든 context는 검증된 결과를 각자의 store에 기록합니다
- pending refresh는 write 전에 current raw token identity를 다시 확인합니다
- 각 controller는 같은 context의 final refresh check와 awaited write를 `clear`, `set`, `updateUser`와 직렬화하고 network refresh 중에는 해당 queue를 점유하지 않습니다
- 새 login은 덮어쓰지 않고 current access token을 사용하며 clear된 session은 복원하지 않고 reject합니다
- refresh 중 user만 변경되면 current user와 refreshed token을 함께 보존합니다
- SvelteKit adapter는 call 인자 또는 `getCookies`에서 cookies가 필요하며 없으면 session error가 발생합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/jwt`는 lower-level JWT decode와 expiration check에 사용합니다.
- `@maxxuxx/ts-utils/promise`는 refresh에 사용하는 controller-scoped single-flight primitive를 제공합니다
- `@maxxuxx/ts-utils/api-fetch`는 auth header injection과 refresh retry에 사용합니다.
- `@maxxuxx/ts-utils/env`는 session secret 설정에 사용합니다.
