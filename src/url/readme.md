# URL module

[한국어](./readme.kr.md)

Dependency-free helpers for web paths, API URLs, query strings, and URL shape checks.

## Use this when

- API paths need to be joined without duplicate slashes.
- Query objects should skip `null` and `undefined` while preserving meaningful falsy values.
- Base URLs and relative paths should be combined consistently.

## Import

```ts
import {
  url,
  joinPath,
  appendQuery,
  buildUrl,
  toSearchParams
} from "@maxxuxx/ts-utils/url";
```

## Core exports

| Export | Role |
|---|---|
| Path helpers | `splitPath`, `stripLeadingSlash`, `stripTrailingSlash`, `ensureLeadingSlash`, `withTrailingSlash`, `normalizePath`, `joinPath`. |
| Query helpers | `toQueryEntries`, `toSearchParams`, `appendQuery`. |
| URL helpers | `buildUrl`, `isAbsoluteUrl`, `isExternalUrl`. |
| `url` | Namespace aliases for the same helpers. |

## Basic example

```ts
const path = joinPath("/api", "/users/", userId);

const href = buildUrl("https://api.example.com/api", path, {
  page: 1,
  keyword: "",
  active: false,
  unused: undefined
});
```

## Behavior notes

- `joinPath` drops `null`, `undefined`, and empty string parts.
- `toSearchParams` skips `null` and `undefined` but preserves `""`, `0`, and `false`.
- `appendQuery` inserts query strings before hash fragments.
- `buildUrl` appends relative paths to the existing base path instead of replacing it.

## Edge cases

- `isAbsoluteUrl` checks URL strings with a scheme such as `https://`.
- `isExternalUrl` also treats protocol-relative values such as `//example.com` as external.
- Array query values are appended as repeated query keys.
- This module is for web and API URLs. Use Node's `node:path` module for filesystem paths.

## Related modules

- `@maxxuxx/ts-utils/object` for cleaning query objects before URL building.
- `@maxxuxx/ts-utils/api-fetch` for API-specific URL building.
