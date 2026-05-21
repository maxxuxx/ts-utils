# API fetch module

Fetch based API utilities with Zod validation, method shortcuts, endpoint definitions, token refresh, timeout, retry, and hooks

## Public API

```ts
import {
  createApiFetcher,
  endpoint,
  getApiErrorCode,
  getApiMessage,
  responseEnvelopeSchema,
  type ApiResponse,
  z
} from "@maxxuxx/ts-utils/api-fetch";
```

## Basic request

Create a fetcher with shared defaults

```ts
const api = createApiFetcher({
  baseURL      : "https://api.example.com",
  errorFallback: {
    message: "요청을 처리하지 못했습니다"
  }
});
```

Use method shortcuts for common calls

```ts
const User = z.object({
  id  : z.number(),
  name: z.string()
});

const response = await api.get("/users/1", {
  responseSchema: User
});

response.code; // HTTP status code
response.data; // validated response body
```

Send JSON with request and response validation

```ts
const CreateUser = z.object({
  name: z.string().min(1)
});

const response = await api.post("/users", {
  body          : { name: "haru" },
  bodySchema    : CreateUser,
  responseSchema: User
});

response.data;
```

`bodySchema` is optional. If provided, the fetcher validates `body` before the request is sent. Without `bodySchema`, `body` is still serialized as JSON.

Use `rawBody` for non-JSON request bodies such as `FormData`, `Blob`, or a prebuilt string.

Set request level `errorFallback` when a specific caller should receive fallback values for HTTP errors whose body has no `code` or `message`

```ts
const response = await api.get("/users/me", {
  responseSchema: User,
  errorFallback: {
    message: "내 정보를 불러오지 못했습니다"
  }
});
```

For non-2xx responses, `ApiHttpError.status` is the HTTP status code. `ApiHttpError.code` is `body.code` when it is a string or number, then `errorFallback.code`. `ApiHttpError.message` is `body.message` when it is a string, then `errorFallback.message`, then the default technical request message.

Successful calls return `ApiResponse<TData>` by default

```ts
type ApiResponse<TData> = {
  code    : number;
  message?: string;
  data    : TData;
};
```

`code` is the HTTP response status code and `message` is copied from `body.message` when it is a string.

`data` is the parsed and validated response body by default. If the validated body looks like an API envelope with a `data` property plus `code` or `message`, `data` is unwrapped to the inner `body.data` value.

```ts
const { code, message, data } = await api.post("/auth/login", {
  responseSchema: z.object({
    code   : z.number(),
    message: z.string(),
    data   : User
  })
});

data.id;
```

Add query params with `query`

```ts
const response = await api.get("/users", {
  query: {
    page : 1,
    limit: 20
  },
  responseSchema: z.array(User)
});

response.data;
```

Use `select` to return a custom value instead of the default `ApiResponse`. When `select` is provided, the automatic envelope unwrap does not run.

```ts
const user = await api.get("/users/1", {
  responseSchema: responseEnvelopeSchema(User),
  select: (response) => response.data
});
```

## Endpoints

Use `endpoint.get`, `endpoint.post`, `endpoint.put`, `endpoint.patch`, and `endpoint.delete` when a route should be reused

```ts
const getUser = endpoint.get("/users/:id", {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  responseSchema: User
});

const response = await api.call(getUser, {
  params: { id: "1" }
});

response.data;
```

Endpoint paths support `:param` replacement and encode param values

```ts
const createUser = endpoint.post("/users", {
  bodySchema    : CreateUser,
  responseSchema: User
});

const response = await api.call(createUser, {
  body: { name: "haru" }
});

response.data;
```

Endpoints can define shared query, headers, auth, retry, timeout, and select behavior

```ts
const searchUsers = endpoint.get("/users", {
  params: z.object({
    page: z.coerce.number().default(1)
  }),
  query: (params) => ({
    page: params.page
  }),
  responseSchema: responseEnvelopeSchema(z.array(User)),
  select: (response) => response.data ?? []
});
```

Endpoints can also define a shared fallback error message

```ts
const getMe = endpoint.get("/users/me", {
  responseSchema: User,
  errorFallback: {
    message: "내 정보를 불러오지 못했습니다"
  }
});
```

## Auth refresh

Auth is optional and focused on bearer token flows

```ts
const api = createApiFetcher({
  baseURL: "https://api.example.com",
  auth: {
    getAccessToken: () => tokenStore.get()?.accessToken,
    refresh: async () => {
      const token = await refreshAccessToken();

      tokenStore.set(token);

      return token.accessToken;
    },
    clear: () => tokenStore.clear()
  }
});
```

When auth is configured, requests add `Authorization: Bearer <token>`

If a response is `401` or `419`, the fetcher refreshes once and retries the original request

Concurrent refresh attempts are deduped per fetcher instance

Disable auth per request when needed

```ts
await api.post("/auth/login", {
  auth: false,
  body: credentials,
  responseSchema: LoginResponse
});
```

## Retry and timeout

`retry` can be a number or an options object

```ts
const data = await api.get("/unstable", {
  retry: {
    limit: 2,
    delay: 300,
    statusCodes: [408, 429, 500, 502, 503, 504]
  },
  responseSchema: Data
});
```

By default, retries only apply to `GET` requests

Use `timeout` in milliseconds to abort slow requests

```ts
await api.get("/slow", {
  timeout: 10_000
});
```

## Logging

Enable built-in request logging with `logging`

```ts
const api = createApiFetcher({
  baseURL: "https://api.example.com",
  logging: true
});
```

Logs use this order

```text
emoji method code time endpoint
```

Example output

```text
🌐 GET    200 8   ms /users/1
⚠️ POST   500 42  ms /users
❌ GET    ERR 3   ms /offline
```

The method column is left aligned to the longest HTTP method width

The elapsed time number is left aligned to a 4 character field before `ms`

The logged path excludes `baseURL` and omits query params by default

Pass a custom logger or include query params when needed

```ts
const api = createApiFetcher({
  logging: {
    includeQuery: true,
    logger: (message) => {
      console.info(message);
    }
  }
});
```

In an Electron renderer, pass the logger created by `@maxxuxx/ts-utils/electron-log`

```ts
import { createApiFetcher } from "@maxxuxx/ts-utils/api-fetch";
import { createBridgeLogger } from "@maxxuxx/ts-utils/electron-log";

const logger = createBridgeLogger({
  bridge: window.electronLog,
  isProduction: import.meta.env.PROD,
  targets: ["console", "terminal"]
});

const api = createApiFetcher({
  logging: {
    enabled: import.meta.env.DEV,
    logger
  }
});
```

Request bodies, headers, and bearer tokens are never included in the default log message

## Hooks

Hooks are optional observability callbacks

They do not change the value returned by `get`, `post`, `request`, or `call`

Use `logging` when all you need is API call logging

```ts
const api = createApiFetcher({
  hooks: {
    onResponseError: ({ method, path, error, durationMs }) => {
      report({
        durationMs,
        error,
        method,
        path
      });
    }
  }
});
```

`durationMs` is only available inside response and error hook contexts

## Errors

`ApiHttpError` is thrown for non-2xx responses and includes `status`, optional `code`, `statusText`, parsed `body`, `response`, and request context

`getApiMessage(body)` reads a string `message` property from unknown API bodies

`getApiErrorCode(body)` reads a string or number `code` property from unknown API bodies

`ApiValidationError` is thrown when request body or response schema validation fails

`ApiParseError` is thrown when a JSON response cannot be parsed

`ApiTimeoutError` is thrown when a request exceeds `timeout`

## Utilities

`responseEnvelopeSchema(dataSchema)` validates a body shaped like `{ code, message, isOk, data }`

`buildApiUrl(path, baseURL, query)` builds absolute or relative URLs with query params
