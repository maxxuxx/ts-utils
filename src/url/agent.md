# URL module notes

## Purpose

This module provides dependency free helpers for web path joining, API URL building, and query string creation

## Public shape

Expose URL utilities through `src/url/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/url`

Provide named exports plus the grouped `url` namespace

```ts
joinPath("/api", "/users");
url.join("/api", "/users");
appendQuery("/users", { page: 1 });
url.build("https://api.example.com/api", "/users");
```

## Internal layout

Keep this module flat in `index.ts` while the implementation remains small

Split into files only if URL helpers grow into distinct runtime areas that become hard to scan

## Design decisions

All helpers must be dependency free

This module is for web/API paths and URLs, not filesystem paths

Do not wrap or replace Node's `node:path`

`joinPath` should preserve leading slash intent and remove duplicate separators between segments

`appendQuery` and `toSearchParams` must preserve `""`, `0`, and `false`, but skip `null` and `undefined`

`buildUrl` should join relative paths onto the base path instead of treating a leading slash as host root replacement

Keep module docs updated whenever URL behavior, exports, or internal file layout changes
