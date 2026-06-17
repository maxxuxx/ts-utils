# URL 모듈

[English](./readme.md)

web path, API URL, query string, URL shape check를 위한 dependency-free helper입니다.

## 언제 사용하나

- API path를 중복 slash 없이 join해야 할 때 사용합니다.
- query object에서 `null`, `undefined`는 제외하고 의미 있는 falsy value는 보존해야 할 때 사용합니다.
- base URL과 relative path를 일관되게 합쳐야 할 때 사용합니다.

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

## 주요 export

| Export | 역할 |
|---|---|
| Path helpers | `splitPath`, `stripLeadingSlash`, `stripTrailingSlash`, `ensureLeadingSlash`, `withTrailingSlash`, `normalizePath`, `joinPath`입니다. |
| Query helpers | `toQueryEntries`, `toSearchParams`, `appendQuery`입니다. |
| URL helpers | `buildUrl`, `isAbsoluteUrl`, `isExternalUrl`입니다. |
| `url` | 동일 helper의 namespace alias입니다. |

## 기본 예제

```ts
const path = joinPath("/api", "/users/", userId);

const href = buildUrl("https://api.example.com/api", path, {
  page: 1,
  keyword: "",
  active: false,
  unused: undefined
});
```

## 동작 메모

- `joinPath`는 `null`, `undefined`, 빈 문자열 segment를 제외합니다.
- `toSearchParams`는 `null`, `undefined`를 제외하고 `""`, `0`, `false`는 보존합니다.
- `appendQuery`는 hash fragment 앞에 query string을 추가합니다.
- `buildUrl`은 relative path를 base path에 붙이며 base path를 대체하지 않습니다.

## 주의할 점

- `isAbsoluteUrl`은 `https://`처럼 scheme이 있는 URL string을 확인합니다.
- `isExternalUrl`은 `//example.com` 같은 protocol-relative 값도 external로 봅니다.
- array query value는 같은 key를 반복 append합니다.
- 이 모듈은 web/API URL용입니다. filesystem path는 Node `node:path` module을 사용합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/object`는 URL 생성 전 query object cleanup에 사용합니다.
- `@maxxuxx/ts-utils/api-fetch`는 API-specific URL building에 사용합니다.
