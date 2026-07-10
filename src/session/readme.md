# Session module

[한국어](./readme.kr.md)

Token session controllers for framework-independent storage, SvelteKit cookie sessions, and React browser storage.

## Use this when

- Auth state should be independent from the storage layer.
- Access tokens may be opaque or JWT-backed, and refresh-token usage should be configurable.
- SvelteKit and React apps need adapters around the same token lifecycle rules.

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

## Core exports

| Export | Role |
|---|---|
| `createTokenSession` | Creates the storage-agnostic token session controller. |
| `TokenSessionError`, `TokenSessionReason` | Represent unauthorized, invalid, invalid-token, and expired session failures. |
| `session/sveltekit` | Creates an iron-session-backed SvelteKit cookie session adapter. |
| `session/react` | Creates a browser storage session with subscription and React hooks. |
| `TokenSessionTokens`, `TokenSessionData`, controller types | Shared session contracts. |

## Basic example

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

## Behavior notes

- `useRefreshToken` defaults to `true`. Set it to `false` for access-token-only APIs.
- JWT parsing and expiration checks run only when `jwtSchema` is provided.
- `jwtSchema` validates strictly decoded payload claims before the original token is attached
- Invalid base64url or UTF-8 fails before `jwtSchema` parsing
- Without `jwtSchema`, opaque access tokens are allowed.
- `parseTokens` validates login or refresh response tokens before storing them.

## Edge cases

- When refresh tokens are required, missing refresh tokens cause `invalid_token`.
- Expired JWTs trigger refresh when `refreshTokens` is configured; otherwise they cause `expired`.
- Concurrent refresh calls with the same refresh token are deduped by default.
- SvelteKit adapter requires cookies from the call or `getCookies`; missing cookies produce a session error.

## Related modules

- `@maxxuxx/ts-utils/jwt` for lower-level JWT decoding and expiration checks.
- `@maxxuxx/ts-utils/api-fetch` for auth header injection and refresh retry.
- `@maxxuxx/ts-utils/env` for session secret configuration.
