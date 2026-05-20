# API fetch module

Fetch based API utilities with Zod validation, method shortcuts, endpoint definitions, token refresh, timeout, retry, and hooks

## Public API

```ts
import {
  createApiFetcher,
  endpoint,
  responseEnvelopeSchema,
  z
} from "@maxxuxx/ts-utils/api-fetch";
```

## Basic request

Create a fetcher with shared defaults

```ts
const api = createApiFetcher({
  baseURL: "https://api.example.com"
});
```

Use method shortcuts for common calls

```ts
const User = z.object({
  id  : z.number(),
  name: z.string()
});

const user = await api.get("/users/1", {
  schema: User
});
```

Send JSON with request and response validation

```ts
const CreateUser = z.object({
  name: z.string().min(1)
});

const user = await api.post("/users", {
  json      : { name: "haru" },
  jsonSchema: CreateUser,
  schema    : User
});
```

Add query params with `query`

```ts
const users = await api.get("/users", {
  query: {
    page : 1,
    limit: 20
  },
  schema: z.array(User)
});
```

Use `select` to unwrap or reshape a validated response

```ts
const user = await api.get("/users/1", {
  schema: responseEnvelopeSchema(User),
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
  schema: User
});

const user = await api.call(getUser, {
  params: { id: "1" }
});
```

Endpoint paths support `:param` replacement and encode param values

```ts
const createUser = endpoint.post("/users", {
  json  : CreateUser,
  schema: User
});

const user = await api.call(createUser, {
  json: { name: "haru" }
});
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
  schema: responseEnvelopeSchema(z.array(User)),
  select: (response) => response.data ?? []
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
  json: credentials,
  schema: LoginResponse
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
  schema: Data
});
```

By default, retries only apply to `GET` requests

Use `timeout` in milliseconds to abort slow requests

```ts
await api.get("/slow", {
  timeout: 10_000
});
```

## Hooks

Hooks can be configured globally or per request

```ts
const api = createApiFetcher({
  hooks: {
    onRequest: ({ method, url }) => {
      console.debug(method, url);
    },
    onResponseError: ({ error }) => {
      report(error);
    }
  }
});
```

## Errors

`ApiHttpError` is thrown for non-2xx responses and includes `status`, `statusText`, parsed `body`, `response`, and request context

`ApiValidationError` is thrown when request JSON or response schema validation fails

`ApiParseError` is thrown when a JSON response cannot be parsed

`ApiTimeoutError` is thrown when a request exceeds `timeout`

## Utilities

`responseEnvelopeSchema(dataSchema)` builds a common `{ code, message, isOk, data }` response schema

`buildApiUrl(path, baseURL, query)` builds absolute or relative URLs with query params
