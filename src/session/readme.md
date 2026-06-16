# Session module

Token session helpers for framework independent auth state, SvelteKit cookie sessions, and React browser storage

## Core session

```ts
import {
  TokenSessionError,
  createTokenSession,
  type TokenSessionTokens
} from "@maxxuxx/ts-utils/session";
```

The core controller is storage agnostic. Provide `read`, `write`, and `clear` for the runtime where the session lives

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
  write: (_context, nextSession) => store.set(nextSession),
  clear: () => store.clear(),
  useRefreshToken: false
});
```

`useRefreshToken` defaults to `true`. Use `useRefreshToken: false` when an API only issues access tokens and there is no refresh token

```ts
await session.set(undefined, {
  user: {
    id: "user-1"
  },
  tokens: {
    accessToken: "opaque-token"
  }
});

const user = await session.ensure(undefined);
const accessToken = await session.getAccessToken(undefined);
```

JWT parsing and expiration checks only run when `jwtSchema` is provided. Opaque access tokens are accepted when no JWT schema is configured

Use `parseTokens` to validate login or refresh response tokens before storing them in a session. It returns `{ tokens }` only when the token schema, access token, configured JWT schema, and required refresh token rule pass

## Refresh token sessions

Add `refreshTokens` when the session can rotate tokens

```ts
const session = createTokenSession<void, User, Tokens>({
  read: () => store.get() ?? {},
  write: (_context, nextSession) => store.set(nextSession),
  clear: () => store.clear(),
  refreshThresholdSeconds: 60,
  refreshTokens: async (refreshToken) => {
    const response = await fetch("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({
        refreshToken
      })
    });

    return response.json();
  }
});
```

Concurrent refreshes with the same refresh token are deduped by default and the successful token pair is shared briefly with other in-flight requests. Use `dedupeRefresh: false` to disable this, or `dedupeRefresh: { cacheSuccessMs: 1000 }` to tune the short success cache

Refresh tokens are required by default. Set `useRefreshToken: false` for access-token-only sessions

## SvelteKit

SvelteKit helpers use `iron-session`

```bash
npm install iron-session
```

```ts
import { createSession } from "@maxxuxx/ts-utils/session/sveltekit";
import { getRequestEvent } from "$app/server";

export const authSession = createSession<User, Tokens>({
  getCookies: () => getRequestEvent().cookies,
  sessionOptions: {
    cookieName: "app_session",
    password: process.env.SESSION_PASSWORD
  },
  useRefreshToken: false
});
```

Use the configured session in server routes and hooks

```ts
const user = await authSession.ensure();
const accessToken = await authSession.getAccessToken();

await authSession.set({
  user,
  tokens: {
    accessToken
  }
});
```

## React

React helpers store the session in browser storage and expose subscription hooks

```bash
npm install react
```

```ts
import { createReactTokenSession } from "@maxxuxx/ts-utils/session/react";

export const authSession = createReactTokenSession<User, Tokens>({
  storageKey: "app_session",
  useRefreshToken: false
});
```

```tsx
function AccountMenu() {
  const user = authSession.useSessionUser();

  return user ? <span>{user.id}</span> : null;
}
```

## API fetch integration

Use `getAccessToken` with `api-fetch`. The default request header is `Authorization: Bearer <accessToken>`

```ts
import { createApiFetcher } from "@maxxuxx/ts-utils/api-fetch";

const api = createApiFetcher({
  auth: {
    getAccessToken: () => authSession.getAccessToken()
  }
});
```

Use `formatTokenHeader` when the API expects a different header

```ts
const api = createApiFetcher({
  auth: {
    getAccessToken: () => authSession.getAccessToken(),
    formatTokenHeader: (accessToken) => ({
      "X-Access-Token": accessToken
    })
  }
});
```

Request-level headers take precedence over generated token headers
