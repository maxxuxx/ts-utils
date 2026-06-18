# API fetch module

[한국어](./readme.kr.md)

Fetch-based API client utilities with Zod validation, endpoint definitions, auth refresh, retry, timeout, hooks, logging, and route-handler error conversion.

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
| `ApiHttpError`, `ApiValidationError`, `ApiParseError`, `ApiTimeoutError` | Typed error classes raised by the client itself. |
| `ApiAuthError` | Marker error you throw from your own auth code; `toApiRouteErrorResponse` maps it to a 401. The client never throws it. |
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
    retries: 2,
    delayMs: 300
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

## Behavior notes

- `bodySchema` validates JSON request bodies before the request is sent. Without it, `body` is still serialized as JSON.
- Use `rawBody` for `FormData`, `Blob`, `URLSearchParams`, streams, or a pre-serialized body.
- `responseSchema` validates the parsed response body and throws `ApiValidationError` for invalid responses.
- The default result shape is `{ code, message?, response }`. Response envelopes with `data` are unwrapped when possible.
- `serverTime: true` creates an internal clock exposed as `api.serverTime`; `serverTime.clock` records into a caller-owned clock.
- Client-level hooks run before request-level hooks. Logging is implemented as hooks, so custom hooks can be composed with logging.

## Edge cases

- Auth refresh is attempted for 401 and 419 by default and is deduped while a refresh is in flight.
- Retries default to safe read-style behavior. Configure retry options explicitly for writes.
- HTTP errors prefer server-provided `code` and `message`; fallback values only fill missing fields.
- `handleApiRoute` preserves `ApiHttpError.code` in JSON responses when present. `codeMessages` override response messages before `statusMessages`, then the API message is used.
- `handleApiRoute` accepts no options. If no mapped, route-level, or API message exists, it returns `API request failed`.
- Missing or invalid server time headers are ignored.
- `handleApiRoute` only converts known API errors. Unknown errors are rethrown.

## Related modules

- `@maxxuxx/ts-utils/session` for token storage and refresh policy.
- `@maxxuxx/ts-utils/http-response` for simple response helpers.
- `@maxxuxx/ts-utils/parser` or direct `z` schemas for request and response validation.
