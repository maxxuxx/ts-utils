# API fetch module

[한국어](./readme.kr.md)

Fetch-based API client utilities with Zod validation, trusted-origin auth, replayable bodies, bounded responses, retry, timeout, hooks, logging, and route-handler error conversion

## Use this when

- You want one fetch wrapper to own base URLs, headers, JSON bodies, timeouts, retries, auth headers, and response validation.
- You define reusable typed endpoints and call them from app code with validated params, query, body, and response data.
- Server-side API calls should sample upstream `Date` headers into a shared server clock.
- Server routes need to convert known API client errors into Web `Response` objects.

## Import

```ts
import {
  createApiFetcher,
  endpoint,
  handleApiRoute,
  responseEnvelopeSchema,
  type ApiResponse,
  z
} from "@maxxuxx/ts-utils/api-fetch";
```

## Core exports

| Export | Role |
|---|---|
| `createApiFetcher` | Creates a configured fetch client with method shortcuts and `request`. |
| `endpoint` | Factory namespace for typed endpoint definitions by HTTP method. |
| `handleApiRoute`, `toApiRouteErrorResponse` | Convert known API errors into route responses. |
| `ApiHttpError`, `ApiValidationError`, `ApiParseError`, `ApiTimeoutError` | Typed HTTP, validation, parse, and deadline failures |
| `ApiAuthError`, `ApiAbortError`, `ApiResponseSizeError` | Terminal auth, caller cancellation, and response byte-limit failures |
| `createApiLoggerHooks`, `formatApiLogEvent` | Generate hook-based API logging. |
| `api-fetch/sveltekit` | Cookie-bound SvelteKit adapter for auth callbacks and refresh dedupe. |

## Basic example

```ts
const api = createApiFetcher({
  baseURL: "https://api.example.com",
  errorFallback: {
    code: "REQUEST_FAILED",
    message: "Request failed"
  },
  retry: {
    delay: 300,
    limit: 2,
    strategy: "exponential",
    jitter: 0.2
  },
  timeout: 5000
});

const User = z.object({
  id: z.number(),
  name: z.string()
});

const getUser = endpoint.get("/users/:id", {
  params: z.object({
    id: z.number()
  }),
  responseSchema: User
});

const result = await api.call(getUser, {
  params: {
    id: 1
  }
});

result.code;
result.response.name;
```

## Server time sampling

```ts
import { createServerClock } from "@maxxuxx/ts-utils/time";

const api = createApiFetcher({
  baseURL: "https://api.example.com",
  serverTime: true
});

await api.get("/me");

api.serverTime?.getServerTimeMs();
```

For request-scoped fetchers, pass a shared clock:

```ts
const apiServerClock = createServerClock();

const api = createApiFetcher({
  baseURL: "https://api.example.com",
  serverTime: {
    clock: apiServerClock
  }
});

await api.get("/me");

apiServerClock.getServerTimeMs();
```

## SvelteKit refresh sharing

The SvelteKit adapter shares refresh result creation separately from cookie persistence

```ts
import {
  createApiFetcher,
  createSvelteKitRefreshNamespace
} from "@maxxuxx/ts-utils/api-fetch/sveltekit";

type CookieContext = {
  accessToken: string;
  refreshKey : string;
};

type RefreshResult = {
  accessToken: string;
};

const refreshNamespace = createSvelteKitRefreshNamespace<RefreshResult>();

const api = createApiFetcher<CookieContext, RefreshResult>({
  cookies,
  auth: {
    namespace     : refreshNamespace,
    getAccessToken: (context) => context.accessToken,
    getRefreshKey : (context) => context.refreshKey,
    refresh       : async (_context, error) => refreshTokens(error),
    applyRefresh  : async (context, result) => {
      context.accessToken = result.accessToken;

      return context.accessToken;
    },
    clear: async (context) => {
      context.accessToken = "";
    }
  }
});
```

Create the typed namespace handle once outside fetcher construction, then reuse that handle and a stable refresh key for fetcher instances that should share work

`refresh` runs once per handle and key, while every participating cookie context runs `applyRefresh` before its request retry

Different handles remain isolated even when their result types and refresh keys match, and one handle cannot be supplied with an incompatible refresh result contract

Adapter sharing retains only in-flight work and does not cache successful refresh results or partition flights by cache duration

When the namespace handle is omitted, refresh single-flight state stays local to that adapter instance

Set `dedupeRefresh: false` only when `refresh` directly updates its cookie context and returns the next access token without `applyRefresh`

## Behavior notes

- `bodySchema` validates JSON request bodies before the request is sent. Without it, `body` is still serialized as JSON.
- JSON validation, transformation, and serialization run once per logical request and reuse the serialized body for retries
- Use `rawBody` for `FormData`, `Blob`, `URLSearchParams`, streams, or a pre-serialized body.
- Use `rawBodyFactory(attempt)` when auth or general retries need a fresh raw body for every one-based network attempt
- `rawBody` and `rawBodyFactory` are mutually exclusive, and one-shot `ReadableStream` bodies are not retried
- `maxResponseBytes` rejects oversized declared or streamed response bodies before parsing
- `responseSchema` validates the parsed response body and throws `ApiValidationError` for invalid responses.
- Without `responseSchema`, the default `response` payload is `unknown`; use a runtime `select` callback when a custom result type is needed without a schema
- Explicit body, response, params, and endpoint result generics cannot replace their runtime `bodySchema`, `responseSchema`, `params`, or `select` contracts
- The default result shape is `{ code, message?, response }`. Response envelopes with `data` are unwrapped when possible.
- `serverTime: true` creates an internal clock exposed as `api.serverTime`; `serverTime.clock` records into a caller-owned clock.
- Client-level hooks run before request-level hooks. Logging is implemented as hooks, so custom hooks can be composed with logging.

## Edge cases

- Auth refresh is attempted for 401 and 419 by default and shares one in-flight refresh per failed access-token value
- A login generation using a different current access token does not join or retry with an older refresh result
- Every caller observes its own abort signal while waiting for shared refresh work; aborting one caller does not cancel the shared refresh
- Refresh results must be non-empty, control-character-free strings; unusable values enter terminal auth handling without a retry
- SvelteKit adapter dedupe requires `applyRefresh`; failed or empty shared results are not retained
- A shared typed SvelteKit namespace handle uses one in-flight runner, so the same stable key shares work without cache configuration
- A SvelteKit `applyRefresh` failure clears only that request's cookie context through terminal auth handling
- Auth is sent only to relative requests, the client `baseURL` origin, and explicit `allowedOrigins`; a request-level `baseURL` is never an implicit trust anchor
- Untrusted requests remove merged `Authorization` and `Proxy-Authorization` headers from client, endpoint, and request configuration
- Auth responses without refresh, non-replayable auth requests, and exhausted refresh clear the session best effort and throw `ApiAuthError`
- Retries default to GET, one shared request budget, `Retry-After` support, fixed delay, and no jitter; configure write methods explicitly
- Observed caller abort throws `ApiAbortError`; deadline expiry throws `ApiTimeoutError`; retry delay always observes the caller signal
- Custom fetch implementations must reject or otherwise observe the caller signal during active work
- HTTP errors may retain a server code but never retain raw bodies, responses, headers, parse text, validation inputs, URL userinfo, query strings, fragments, or upstream messages
- `ApiAuthError.cause` is a sanitized `HTTP_FAILURE` or `AUTH_CALLBACK_FAILURE` descriptor and never retains an auth callback error object or message
- `errorFallback.message` is the configured safe HTTP error message, not an upstream-message fallback; upstream messages are always ignored
- Without a configured safe message, HTTP errors use the generic request failure
- `handleApiRoute` preserves `ApiHttpError.code` and resolves `codeMessages`, `statusMessages`, `responseMessage`, then `API request failed`
- Raw upstream messages are not exposed by route conversion unless an explicit mapping callback chooses them
- Missing or invalid server time headers are ignored.
- `handleApiRoute` only converts known API errors. Unknown errors are rethrown.

## Related modules

- `@maxxuxx/ts-utils/session` for token storage and refresh policy.
- `@maxxuxx/ts-utils/http-response` for simple response helpers.
- `@maxxuxx/ts-utils/parser` or direct `z` schemas for request and response validation.
