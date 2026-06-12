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

The core controller is storage agnostic. Provide `readSession`, `writeSession`, and `clearSession` for the runtime where the session lives

```ts
type User = {
  id: string;
};

type Tokens = TokenSessionTokens & {
  accessToken: string;
  refreshToken?: string;
};

const session = createTokenSession<void, User, Tokens>({
  mode: "access-token",
  readSession: () => store.get() ?? {},
  writeSession: (_context, nextSession) => store.set(nextSession),
  clearSession: () => store.clear()
});
```

Use `mode: "access-token"` when an API only issues access tokens and there is no refresh token

```ts
await session.setSession(undefined, {
  user: {
    id: "user-1"
  },
  tokens: {
    accessToken: "opaque-token"
  }
});

const user = await session.ensureSession(undefined);
const accessToken = await session.getAccessToken(undefined);
```

JWT parsing and expiration checks only run when `jwtSchema` is provided. Opaque access tokens are accepted when no JWT schema is configured

## Refresh token mode

Add `refreshTokens` when the session can rotate tokens

```ts
const session = createTokenSession<void, User, Tokens>({
  readSession: () => store.get() ?? {},
  writeSession: (_context, nextSession) => store.set(nextSession),
  clearSession: () => store.clear(),
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

When `mode` is omitted and `refreshTokens` exists, a refresh token is required. Set `mode: "access-token"` for access-token-only sessions

## SvelteKit

SvelteKit helpers use `iron-session`

```bash
npm install iron-session
```

```ts
import { createSvelteKitTokenSession } from "@maxxuxx/ts-utils/session/sveltekit";

export const authSession = createSvelteKitTokenSession<User, Tokens>({
  mode: "access-token",
  sessionOptions: {
    cookieName: "app_session",
    password: process.env.SESSION_PASSWORD
  }
});
```

Use it with SvelteKit `cookies` in server routes and hooks

```ts
const user = await authSession.ensureSession(event.cookies);
const accessToken = await authSession.getAccessToken(event.cookies);

await authSession.setSession(event.cookies, {
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
  mode: "access-token",
  storageKey: "app_session"
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
