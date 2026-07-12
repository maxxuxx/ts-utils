# Migrate to 0.8

Version 0.8 is a breaking safety release

The package root remains intentionally empty, so keep using explicit subpath imports such as `@maxxuxx/ts-utils/json` and `@maxxuxx/ts-utils/api-fetch`

Upgrade the package before applying the changes below

```bash
npm install @maxxuxx/ts-utils@^0.8.0
```

## Electron helpers moved to `electron-helper`

The Electron logging and updater exports are no longer part of `@maxxuxx/ts-utils`

Install the focused Electron package and the optional peers used by your app

```bash
npm install electron-helper electron-log electron-updater
```

### Before

```ts
import {
  configureMainLogger,
  registerMainBridge
} from "@maxxuxx/ts-utils/electron-log/main";
import {
  createUpdaterService,
  registerUpdaterIpcHandlers
} from "@maxxuxx/ts-utils/electron-updater/main";

const logger = configureMainLogger({
  isProduction: app.isPackaged
});

registerMainBridge({ ipcMain, logger });

const updater = createUpdaterService({
  app,
  autoUpdater,
  getWindow: () => mainWindow
});

updater.setup();
registerUpdaterIpcHandlers({ ipcMain, service: updater });
```

### After

```ts
import {
  bindRenderer,
  initialize
} from "electron-helper/main/log";
import { registerUpdaterBridge } from "electron-helper/main/updater";

const logger = initialize({
  console: {
    level: app.isPackaged ? "info" : "debug"
  },
  file: {
    level: "info"
  }
});

bindRenderer(mainWindow.webContents, {
  persist: true,
  scope  : "main-window"
});

registerUpdaterBridge({
  autoDownload: false,
  getWindows  : () => BrowserWindow.getAllWindows()
});

logger.info("App started");
```

Use these replacements for the removed updater subpaths

| Removed import | Replacement |
|---|---|
| `@maxxuxx/ts-utils/electron-log` | No one-to-one replacement for the former shared renderer bridge client |
| `@maxxuxx/ts-utils/electron-log/main` | `electron-helper/main/log` |
| `@maxxuxx/ts-utils/electron-log/preload` | Application-owned preload logging API when required |
| `@maxxuxx/ts-utils/electron-log/renderer` | `electron-helper/main/log` with `bindRenderer`, or application-owned renderer logging |
| `@maxxuxx/ts-utils/electron-updater` | `electron-helper/node/updater` for shared updater types and state |
| `@maxxuxx/ts-utils/electron-updater/main` | `electron-helper/main/updater` |
| `@maxxuxx/ts-utils/electron-updater/preload` | `electron-helper/preload/updater` |
| `@maxxuxx/ts-utils/electron-updater/builder` | Direct `electron-builder` publish configuration |

Renderer updater helpers now come from `electron-helper/renderer/updater`

```ts
import type { UpdaterState } from "electron-helper/node/updater";
import { exposeUpdaterBridge } from "electron-helper/preload/updater";
import { createUpdaterClient } from "electron-helper/renderer/updater";
```

The former logging preload and renderer bridge is not a one-to-one export move

Use `bindRenderer` when renderer console forwarding is enough, or keep an application-owned preload bridge when the renderer needs a custom logging API

## React sessions are memory-first

Omitting `storage` no longer selects `localStorage`

Memory mode avoids silently persisting bearer tokens across browser restarts

### Before

```ts
const session = createReactTokenSession({
  storageKey: "auth-session",
  tokenSchema,
  userSchema
});

// 0.7 persisted to localStorage when storage was omitted
```

### After

```ts
const memorySession = createReactTokenSession({
  storageKey: "auth-session",
  tokenSchema,
  userSchema
});

const persistentSession = createReactTokenSession({
  storage   : "local",
  storageKey: "auth-session",
  tokenSchema,
  userSchema
});
```

Use `storage: "session"` for tab-scoped persistence or provide a custom storage adapter

Set `storage: "local"` explicitly when the session must preserve the 0.7 local persistence behavior

Persisted JSON and schema-invalid values are now removed before exposure

Snapshots are detached and recursively frozen, and snapshot containers must be plain objects or arrays

Values containing mutable built-ins such as `Date`, `Map`, `Set`, or typed arrays are rejected before the current snapshot changes

Core session reads, inputs, refresh results, and writes now use the configured `userSchema` and `tokenSchema`

When `jwtSchema` is configured, it receives strictly decoded claims before the original `token` field is attached

## JSON custom types require a schema

Schema-free JSON parsers now return `unknown` and no longer accept caller-selected parsed-value generics

### Before

```ts
type Settings = {
  theme: "dark" | "light";
};

const settings = parseJson<Settings>(text);
const result = safeParseJson<Settings>(text);
```

### After

```ts
const SettingsSchema = z.object({
  theme: z.enum(["dark", "light"])
});

const settings = parseJsonWithSchema(text, SettingsSchema);
const result = safeParseJsonWithSchema(text, SettingsSchema);
```

If runtime validation is not required, narrow the `unknown` result in application code before use

Shared object and array references are valid JSON-compatible values when they are not cyclic

Object builders now preserve `__proto__` as an own data property instead of allowing prototype mutation

## JWT custom claims require a schema

Schema-free JWT payload and header decoders expose only the built-in JWT types

Caller-selected generics were removed because they asserted custom claim shapes without runtime validation

### Before

```ts
type Claims = {
  role: "admin" | "user";
};

const claims = decodeJwt<Claims>(token);
const result = safeDecodeJwt<Claims>(token);
```

### After

```ts
const ClaimsSchema = z.object({
  role: z.enum(["admin", "user"])
});

const claims = decodeJwtWithSchema(token, ClaimsSchema);
const result = safeDecodeJwtWithSchema(token, ClaimsSchema);
```

The same rule applies to `decodeJwtHeaderWithSchema` and `safeDecodeJwtHeaderWithSchema`

JWT segments now use strict base64url and fatal UTF-8 decoding

Schema-backed JWT decoders now require schemas to return plain records at runtime; arrays, `Date`, class instances, and `null` fail through the normal decode failure shape

The attached `token` field is reserved and always contains the original JWT string, even when a payload schema returns its own `token` claim

Use Zod object outputs, object type aliases, or ordinary interfaces for `JwtSchema<T>`; interfaces do not need to extend `JwtObject` or declare a string index signature

Core, React, and SvelteKit `TokenSession` claim generics also accept ordinary interfaces without a string index signature; expiration logic reads `exp` only when its runtime value is a finite number, and schema-backed JWT inputs still require plain records

Invalid alphabet, misplaced or non-canonical padding, impossible lengths, and invalid UTF-8 return the normal null or `JwtDecodeError` failure shape

## API response types require a schema or selector

Schema-free API methods and endpoints now expose the default response payload as `unknown`

Caller-selected output generics can no longer assert a parsed result without a runtime `responseSchema` or `select`

### Before

```ts
type User = {
  id: number;
};

const result = await api.get<ApiResponse<User>>("/users/1");
```

### After

```ts
const UserSchema = z.object({
  id: z.number()
});

const validated = await api.get("/users/1", {
  responseSchema: UserSchema
});

const selected = await api.get("/health", {
  select: (data) => isHealthPayload(data)
});
```

Explicit schema generics also require their matching runtime `bodySchema`, `responseSchema`, or endpoint `params` field, and a custom endpoint result requires `select`

Endpoint call arguments and results are inferred structurally from `options.params`, `bodySchema`, `responseSchema`, and `select`, so object literals declared with `satisfies ApiEndpoint` no longer depend on an internal phantom property

Schema-free selectors and explicit `undefined` schemas now compile with `strictNullChecks: false`

With `strictNullChecks: false`, endpoint factories that combine `responseSchema` and `select` still preserve the selector return type in `api.call`

## SvelteKit refresh sharing applies results per cookie context

Successful refresh caching through `SvelteKitRefreshDedupeOptions` and `cacheSuccessMs` was removed

Sharing is now in-flight only and typed namespace handles replace string namespaces

Every participant must apply the shared result to its own cookie context before retrying

### Before

```ts
const api = createApiFetcher({
  cookies,
  dedupeRefresh: {
    cacheSuccessMs: 2000
  },
  auth: {
    getAccessToken: (context) => context.accessToken,
    refresh: async (context) => {
      const tokens = await refreshTokens();

      context.accessToken = tokens.accessToken;

      return context.accessToken;
    }
  }
});
```

### After

```ts
import {
  createApiFetcher,
  createSvelteKitRefreshNamespace
} from "@maxxuxx/ts-utils/api-fetch/sveltekit";

type RefreshResult = {
  accessToken: string;
};

const refreshNamespace = createSvelteKitRefreshNamespace<RefreshResult>();

const api = createApiFetcher({
  cookies,
  auth: {
    namespace     : refreshNamespace,
    getAccessToken: (context) => context.accessToken,
    getRefreshKey : (context) => context.refreshToken,
    refresh       : async () => refreshTokens(),
    applyRefresh  : async (context, result) => {
      context.accessToken = result.accessToken;

      return context.accessToken;
    }
  }
});
```

Create the namespace handle outside fetcher construction and reuse it only where the refresh result contract matches

The namespace type uses explicit `in out` variance, so consumers need a TypeScript compiler that supports explicit variance annotations

`dedupeRefresh: false` now disables single-flight sharing only. It no longer enables side-effectful direct refresh

Every refresh configuration must return a refresh result and provide `applyRefresh`, and JavaScript callers that omit it receive an immediate `TypeError`

Before applying a shared result, the adapter re-reads the token captured for that participant. If a newer login is present, it returns the current token without calling stale `applyRefresh`

The same generation check applies when dedupe is disabled, so a slow non-deduped result cannot overwrite a newer login

`applyRefresh` and `clear` receive the expected access token as an additional final argument for compare-and-set implementations; existing callbacks may ignore it

## Auth headers are origin-constrained

Auth is sent only to relative requests, the configured `baseURL` origin, and explicit `allowedOrigins`

Absolute cross-origin requests do not receive bearer credentials unless they are allowlisted

### Before

```ts
const api = createApiFetcher({
  auth,
  baseURL: "https://api.example.com"
});

await api.get("https://uploads.example.com/files/1");
```

### After

```ts
const api = createApiFetcher({
  allowedOrigins: ["https://uploads.example.com"],
  auth,
  baseURL       : "https://api.example.com"
});

await api.get("https://uploads.example.com/files/1");

await api.get("https://public.example.com/status", {
  auth: false
});
```

Keep `allowedOrigins` narrow and use normalized URL origins without path, query, or fragment data

Origin classification also normalizes network-path and backslash URL forms before deciding whether auth is trusted

Only the client-level `baseURL` is an implicit trusted origin. A request-level `baseURL` that resolves to another origin must also appear in `allowedOrigins`

Untrusted requests remove merged `Authorization` and `Proxy-Authorization` headers even when those headers came from client, endpoint, or request configuration

The fully resolved URL, including query, is snapshotted once before auth work and reused for classification and every fetch retry, so mutable `baseURL` accessors cannot change the destination after the trust decision

Access tokens are resolved after body preparation and request hooks, immediately before every network attempt, and the initial lookup observes caller abort

Explicit `Authorization` or `Proxy-Authorization` headers retain precedence and opt that request out of configured token lookup. Their 401/419 does not refresh or clear the bearer session

When configured auth generates any header, including custom `X-API-Key` shapes, the request forces `redirect: "manual"`. Both cross-origin and same-origin 3xx responses enter the normal `ApiHttpError` path instead of allowing native fetch to forward generated credentials

Custom fetch implementations must honor that forced manual redirect mode

Explicit request auth remains caller-owned and keeps normal `RequestInit.redirect` behavior. Set `redirect: "manual"` explicitly when those credentials must not follow a redirect

Refresh sharing is keyed by the failed access-token value. After refresh, the client re-reads the current token so a newer login generation wins, and each caller can abort its own wait without cancelling shared work

Refresh and access-token results must be non-empty, control-character-free, HTTP-header-safe strings; invalid runtime values throw a sanitized `ApiAuthError` without fetching or retrying. Hierarchical URL userinfo redaction also covers HTTP, FTP, WebSocket, backslash, and omitted-separator forms accepted by the URL parser

Terminal clear is generation-aware and fire-and-forget: the primary error settles immediately, the client re-reads the current token, and `clear(expectedAccessToken)` runs only when it still matches the failed credential

Core `refresh(error, expectedAccessToken)` receives the failed credential generation as its second argument; existing one-argument callbacks remain compatible

## API errors are normalized and redacted

Public API errors no longer retain raw response bodies, response objects, headers, parse text, validation inputs, upstream messages, hierarchical URL userinfo (including FTP and WebSocket URLs), query strings, or fragments

Invalid absolute or network URLs now use `[invalid-url]` in public context. URL construction and fetch transport failures throw `ApiRequestError` with `URL_RESOLUTION_FAILURE` or `TRANSPORT_FAILURE` without retaining native error messages, causes, codes, or input URLs

The removed fields include `ApiHttpError.body`, `ApiHttpError.response`, `ApiHttpError.statusText`, `ApiValidationError.body`, `ApiValidationError.validationError`, and `ApiParseError.text`

Terminal auth failures throw `ApiAuthError` immediately and schedule generation-aware best-effort clear without awaiting a potentially stalled getter or clear callback

Observed caller cancellation throws `ApiAbortError`, while deadlines still throw `ApiTimeoutError`

Transport `onRequestError`, retry, and auth-classification callbacks receive the sanitized `ApiRequestError`, and `handleApiRoute` converts it to the same safe 502 fallback used for upstream parse failures

### Before

```ts
try {
  await api.get("/private?token=secret");
} catch (error) {
  if (error instanceof ApiHttpError) {
    console.error(error.body, error.response, error.statusText);
  }
}
```

### After

```ts
const api = createApiFetcher({
  errorFallback: {
    code   : "REQUEST_FAILED",
    message: "Request failed"
  }
});

try {
  await api.get("/private?token=secret");
} catch (error) {
  if (error instanceof ApiAuthError) {
    redirectToLogin();
  } else if (error instanceof ApiHttpError) {
    console.error(error.code, error.status, error.context.url);
  }
}
```

`context.url` and `context.path` are URL-userinfo-free, query-free, and fragment-free

`ApiAuthError.cause` is now a sanitized `HTTP_FAILURE` or `AUTH_CALLBACK_FAILURE` descriptor instead of the original error object

Do not read auth callback messages, bodies, or headers from the terminal error. Record intentionally safe transport diagnostics inside a custom fetch implementation before it throws because downstream hooks receive only `ApiRequestError`

Route conversion resolves explicit code and status mappings before the configured safe fallback and never uses an upstream message implicitly

Use hooks when application-owned diagnostics need request-local response or parsed data that is intentionally absent from public errors

## Retryable raw bodies use a factory

A static `ReadableStream` is one-shot and can no longer enter general or auth retry

Use `rawBodyFactory` to create a fresh body for every one-based network attempt

### Before

```ts
await api.post("/upload", {
  rawBody: createUploadStream(file),
  retry  : 2
});
```

### After

```ts
await api.post("/upload", {
  rawBodyFactory: (attempt) => {
    console.log(`upload attempt ${attempt}`);

    return createUploadStream(file);
  },
  retry: 2
});
```

`body`, `rawBody`, and `rawBodyFactory` are mutually exclusive

JSON validation, transformation, and serialization run once per logical request and reuse the prepared body across retries

Retry limits must be non-negative safe integers, the retry budget is request-wide, and `Retry-After` is respected by default

Set `respectRetryAfter: false` only when the application must retain delay-only retry timing

## Response bodies can be bounded

Use `maxResponseBytes` at the client, endpoint, or request level to reject oversized declared or streamed responses before parsing

### Before

```ts
const report = await api.get("/report");
```

### After

```ts
const api = createApiFetcher({
  maxResponseBytes: 1024 * 1024
});

try {
  const report = await api.get("/report");
} catch (error) {
  if (error instanceof ApiResponseSizeError) {
    console.error(error.limit, error.size);
  }
}
```

The limit must be a non-negative safe integer

## `isFalsy` no longer narrows types

`isFalsy` now follows JavaScript falsiness for values such as `NaN` and `0n` and returns `boolean`

It is no longer a type predicate because the complete JavaScript-falsy set cannot be represented soundly as a TypeScript narrowing

### Before

```ts
const value: number | string = getValue();

if (!isFalsy(value)) {
  useValue(value);
}
```

### After

```ts
const value: number | string = getValue();

if (typeof value === "string" && value.length > 0) {
  useText(value);
}

if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
  useNumber(value);
}
```

Use an explicit domain-specific check when later code depends on narrowing

## Promise timers and retries are stricter

Timer values for sleep, timeout, retry delay, and single-flight success TTL must be between `0` and `2_147_483_647`

Each retry attempt receives a one-based `RetryContext` with its own `AbortSignal`

### Before

```ts
await retry(fetchUser, {
  delayMs : Number.MAX_SAFE_INTEGER,
  retries: 2
});
```

### After

```ts
await retry(async ({ attempt, signal }) => {
  console.log(`attempt ${attempt}`);

  return await fetch("/api/user", { signal });
}, {
  delayMs : 300,
  retries: 2
});
```

Timeout cancellation is cooperative and work stops only when it observes the signal

No-argument callbacks remain supported

## Other stricter runtime boundaries

Review these changes if the application relied on permissive coercion or invalid input recovery

- Numeric parser presets such as `parser.id`, `parser.page`, `parser.limit`, `parser.coerce.number`, and `parser.coerce.integer` accept string and number input rather than arbitrary JavaScript-coercible values such as booleans
- `toDate`, `toDateString`, and `formatDate` reject finite but out-of-range timestamps instead of returning `Invalid Date`
- `calculateTimeOffset`, `createTimeSyncSample`, `createClockSnapshot`, and local or server conversion helpers reject reversed ordering, negative round trips, and invalid input or derived timestamps
- `getEnvNumber`, `getEnvBoolean`, and their schemas inspect raw values before text conversion, so unsafe bigint values are rejected before string conversion while finite number and string inputs keep their documented parsing behavior
- `formatPhoneNumber` recognizes `030`, `050`, `060`, `070`, and `080`, accepts representative families `14YY`, `15YY`, `16YY`, and `18YY`, makes `17YY` and `19YY` use the configured fallback, and leaves unknown 10-digit or 11-digit prefixes as normalized unseparated digits
- `createCookieDeviceUuidStore` rejects `SameSite=None` when `secure` is false
- URL query helpers preserve the complete fragment after the first `#`
- `isPrimitive` includes JavaScript primitive values such as `NaN` and `0n`
- Core session refresh sharing is controller-local and keys both pending and retained successful work by the exact raw access-token and refresh-token pair, so a newer login with a different access token never joins an older generation that reused the same refresh token
- Object contexts must reuse identity when their session mutations need to share one serialization queue

## New public helpers

Version 0.8 also adds these non-breaking public surfaces

- `@maxxuxx/ts-utils/result` with `Result`, `ok`, `err`, `map`, and `mapError`
- `@maxxuxx/ts-utils/encoding/base64url` with strict text and byte conversion helpers
- `createSingleFlight` with key-scoped `run`, `clear`, `size`, and optional `successTtlMs`
- `DeviceUuidParseError` from `device` and `device/node`
- `forbidden`, `notFound`, `conflict`, `unprocessableEntity`, and `noContent` response helpers

Supported optional peer ranges are now `react >=18 <20` and `iron-session >=8 <9`

## Verification checklist

- Search for removed Electron, schema-free JSON, and schema-free JWT imports
- Choose explicit React persistence where required
- Update every SvelteKit refresh callback with `applyRefresh`, including `dedupeRefresh: false`
- Audit cross-origin API calls and configure only required `allowedOrigins`
- Replace static retryable streams with `rawBodyFactory`
- Select a `maxResponseBytes` limit for untrusted or potentially large responses
- Update error handling to use the remaining redacted fields and normalized error classes
- Re-run typecheck, tests, build, export verification, pack verification, and both npm audits
