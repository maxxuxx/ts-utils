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
| `session/react` | Creates a memory-first browser session with opt-in persistence, subscription, and React hooks |
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
- `userSchema` and `tokenSchema` validate restored session values and every controller write
- Schema-invalid `set` and `updateUser` calls reject before changing the current session
- Schema transforms run once per read, input, or refresh-result boundary and parsed output is not reparsed before storage
- React core operations reuse the snapshot already validated at hydration, storage-event, or write boundaries instead of applying non-idempotent transforms again
- JWT parsing and expiration checks run only when `jwtSchema` is provided.
- `jwtSchema` validates strictly decoded payload claims before the original token is attached
- Invalid base64url or UTF-8 fails before `jwtSchema` parsing
- Without `jwtSchema`, opaque access tokens are allowed.
- `parseTokens` validates login or refresh response tokens before storing them.

## React persistence

React sessions keep state in controller memory when `storage` is omitted or set to `"memory"`

Use an explicit persistent mode only when the session should survive the matching browser boundary

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

Malformed JSON and values rejected by `userSchema` or `tokenSchema` are removed from persistent storage before the controller exposes its snapshot

The server or initial session is used only for initial hydration. A later matching storage deletion or clear event produces an empty snapshot

The first subscriber attaches the storage handler before an authoritative catch-up read, so deletion or corruption between construction and subscription becomes an empty snapshot

Snapshots are detached and recursively frozen, while repeated reads return the same object identity until a committed update

Snapshot containers must be plain objects or arrays. Mutable built-ins with internal state, including `Date`, `Map`, `Set`, and typed arrays, are rejected before the current snapshot changes

Persistent writes prepare and serialize the next snapshot before storage mutation, then commit and notify only after storage succeeds

## Edge cases

- When refresh tokens are required, missing refresh tokens cause `invalid_token`.
- Expired JWTs trigger refresh when `refreshTokens` is configured; otherwise they cause `expired`.
- Concurrent refresh calls with the same raw access-token and refresh-token pair are deduped within one controller by default, and successful results may remain retained for the configured cache window
- A newer login with a different access token starts a new refresh generation even when it reuses the same refresh token, so it joins neither pending nor retained work from the older login
- Separate controllers keep independent refresh state even when their refresh-token strings match
- Every context waiting on one core refresh writes the validated result to its own store
- A pending refresh rechecks the current raw token identity before writing
- Each controller serializes the final refresh check and awaited write with `clear`, `set`, and `updateUser` for the same context while keeping the network refresh outside that queue
- A newer login remains untouched and supplies its current access token, while a cleared session rejects without being restored
- User-only changes made during refresh are preserved with the refreshed tokens
- SvelteKit adapter requires cookies from the call or `getCookies`; missing cookies produce a session error.

## Related modules

- `@maxxuxx/ts-utils/jwt` for lower-level JWT decoding and expiration checks.
- `@maxxuxx/ts-utils/promise` provides the controller-scoped single-flight primitive used by refresh
- `@maxxuxx/ts-utils/api-fetch` for auth header injection and refresh retry.
- `@maxxuxx/ts-utils/env` for session secret configuration.
