# URL module

Dependency free helpers for web paths, API URLs, and query strings

## Public API

```ts
import {
  appendQuery,
  buildUrl,
  joinPath,
  toSearchParams,
  url
} from "@maxxuxx/ts-utils/url";
```

Use named exports for direct imports

```ts
joinPath("/api/v1", "/users/", 1);
appendQuery("/users", {
  keyword: "",
  page: 1,
  categoryId: null
});
buildUrl("https://api.example.com/api", "/users", {
  page: 1
});
```

Use the `url` namespace when grouped call sites read better

```ts
const path = url.join("/api", "/users", userId);
const href = url.build("https://api.example.com/api", path);
```

## Behavior notes

`joinPath` joins URL path segments with `/`, removes duplicate separators, preserves a leading slash from the first segment, and drops `null` or `undefined` parts

`normalizePath` collapses repeated path separators while preserving leading and trailing slash intent

`appendQuery` appends query params to a path or URL and keeps hash fragments at the end

`toSearchParams` skips `null` and `undefined`, while preserving values like `""`, `0`, and `false`

`buildUrl(baseUrl, path, query)` joins relative paths onto the base path instead of replacing the base path

`isAbsoluteUrl` checks URL strings with a scheme such as `https://`

`isExternalUrl` also treats protocol-relative values such as `//example.com` as external

This module is for web/API paths and URLs. Use Node's built-in `node:path` module for filesystem paths
