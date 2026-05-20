# API fetch module

Zod based fetch utilities for request validation, response validation, endpoint definitions, and token refresh flows

## Public API

```ts
import {
  createApiClient,
  defineEndpoint,
  HttpMethod,
  z
} from "@maxxuxx/ts-utils/api-fetch";
```

## Basic request

```ts
const client = createApiClient({
  baseUrl: "https://api.example.com"
});

const user = await client.request("/users/1", {
  responseSchema: z.object({
    id  : z.number(),
    name: z.string()
  })
});
```

Requests and responses can both be validated

```ts
const user = await client.request("/users", {
  method: HttpMethod.POST,
  body  : {
    name: "haru"
  },
  requestSchema: z.object({
    name: z.string().min(1)
  }),
  responseSchema: z.object({
    id  : z.number(),
    name: z.string()
  })
});
```

## Endpoints

Use `defineEndpoint` when a route should be reused

```ts
const getUser = defineEndpoint({
  method      : HttpMethod.GET,
  path        : (params: { id: number }) => `/users/${params.id}`,
  paramsSchema: z.object({
    id: z.number()
  }),
  responseSchema: z.object({
    id  : z.number(),
    name: z.string()
  })
});

const user = await client.endpoint(getUser)({ id: 1 });
```

Endpoints support params, query, headers, body mapping, response schema, and result mapping

```ts
const searchUsers = defineEndpoint({
  method      : HttpMethod.GET,
  path        : "/users",
  paramsSchema: z.object({
    page: z.number()
  }),
  mapQuery: (params) => ({
    page: params.page
  }),
  responseSchema: responseEnvelopeSchema(z.array(z.object({
    id  : z.number(),
    name: z.string()
  }))),
  mapResult: (response) => response.data ?? []
});
```

## Token refresh

Token behavior is injected so the module can work with Next, Electron, browser storage, or custom server sessions

```ts
type Token = {
  accessToken: string;
  expiresAt  : number;
};

const client = createApiClient<Token>({
  baseUrl: "https://api.example.com",
  token: {
    getToken      : () => tokenStore.get(),
    setToken      : (token) => tokenStore.set(token),
    clearToken    : () => tokenStore.clear(),
    getAccessToken: (token) => token.accessToken,
    shouldRefreshToken: (token) => token.expiresAt <= Date.now() + 60_000,
    refreshToken: async (token) => {
      const response = await fetch("https://api.example.com/auth/refresh", {
        method : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accessToken: token?.accessToken
        })
      });

      return response.json() as Promise<Token>;
    }
  }
});
```

When auth is enabled, the client adds `Authorization: Bearer <token>`

If `shouldRefreshToken` returns true, the client refreshes before the request

If the response is `401` or `419`, the client refreshes once and retries the original request

Concurrent refresh attempts are deduped per client instance

Disable auth per request when needed

```ts
await client.request("/auth/login", {
  method: HttpMethod.POST,
  auth  : false,
  body  : credentials
});
```

## Errors

`ApiHttpError` is thrown for non-2xx responses and includes `status`, `statusText`, parsed `body`, and request context

`ApiValidationError` is thrown when request or response schema validation fails

`ApiParseError` is thrown when a JSON response cannot be parsed

## Utilities

`responseEnvelopeSchema(dataSchema)` builds a common `{ code, message, isOk, data }` response schema

`buildApiUrl(path, baseUrl, query)` builds absolute or relative URLs with query params
