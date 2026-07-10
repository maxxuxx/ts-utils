# ts-utils

[![npm version](https://img.shields.io/npm/v/@maxxuxx/ts-utils.svg)](https://www.npmjs.com/package/@maxxuxx/ts-utils)

[English](../README.md)

작고 재사용 가능한 런타임 helper가 필요한 TypeScript 프로젝트를 위한 공용 유틸리티 모음

## 설치

```bash
npm install @maxxuxx/ts-utils
```

GitHub 설치도 지원함

```bash
npm install github:maxxuxx/ts-utils
```

## import 방식

package root 대신 subpath import를 사용함. package root는 비어 있으며, application이 필요한 runtime surface만 가져오도록 설계되어 있음

```ts
import { parser } from "@maxxuxx/ts-utils/parser";
import { createApiFetcher } from "@maxxuxx/ts-utils/api-fetch";
import { createTokenSession } from "@maxxuxx/ts-utils/session";
```

## 모듈 맵

| Entry point | Core role | Details |
|---|---|---|
| [`@maxxuxx/ts-utils/parser`](./src/parser/readme.kr.md) | 반복적인 런타임 검증을 위한 Zod parser preset과 wrapper | [parser](./src/parser/readme.kr.md) |
| [`@maxxuxx/ts-utils/is`](./src/is/readme.kr.md) | primitive, object, collection, built-in 값을 판별하는 runtime type guard | [is](./src/is/readme.kr.md) |
| [`@maxxuxx/ts-utils/result`](../src/result/readme.kr.md) | 성공/실패 Result 생성과 data/error 변환 helper | [result](../src/result/readme.kr.md) |
| [`@maxxuxx/ts-utils/try-catch`](./src/try-catch/readme.kr.md) | 동기/비동기 에러 경계를 Result 형태로 다루는 helper | [try-catch](./src/try-catch/readme.kr.md) |
| [`@maxxuxx/ts-utils/format`](./src/format/readme.kr.md) | 숫자, 원화, 날짜, 전화번호, 값+단위 표시 helper | [format](./src/format/readme.kr.md) |
| [`@maxxuxx/ts-utils/normalize`](./src/normalize/readme.kr.md) | number, text, date, boolean 값으로 보정하는 작은 coercion helper | [normalize](./src/normalize/readme.kr.md) |
| [`@maxxuxx/ts-utils/object`](./src/object/readme.kr.md) | request/response payload를 다듬는 plain object helper | [object](./src/object/readme.kr.md) |
| [`@maxxuxx/ts-utils/url`](./src/url/readme.kr.md) | web path, API URL, query string helper | [url](./src/url/readme.kr.md) |
| [`@maxxuxx/ts-utils/promise`](./src/promise/readme.kr.md) | promise task timeout, retry, 병렬 실행, settle helper | [promise](./src/promise/readme.kr.md) |
| [`@maxxuxx/ts-utils/json`](./src/json/readme.kr.md) | JSON parse/stringify, fallback, safe result, schema boundary helper | [json](./src/json/readme.kr.md) |
| [`@maxxuxx/ts-utils/encoding`](./src/encoding/readme.kr.md) | UTF-8, base64, hex, byte 변환 helper | [encoding](./src/encoding/readme.kr.md) |
| [`@maxxuxx/ts-utils/encoding/base64url`](../src/encoding/readme.kr.md) | browser와 Node에서 동일하게 검증하는 strict base64url text/byte helper | [encoding/base64url](../src/encoding/readme.kr.md) |
| [`@maxxuxx/ts-utils/jwt`](./src/jwt/readme.kr.md) | JWT header/payload decode와 만료 판별 helper | [jwt](./src/jwt/readme.kr.md) |
| [`@maxxuxx/ts-utils/env`](./src/env/readme.kr.md) | runtime env 값 읽기와 Zod schema helper | [env](./src/env/readme.kr.md) |
| [`@maxxuxx/ts-utils/time`](./src/time/readme.kr.md) | client/server timestamp 기반 server time 추정 helper | [time](./src/time/readme.kr.md) |
| [`@maxxuxx/ts-utils/device`](./src/device/readme.kr.md) | runtime을 자동 선택하는 device UUID helper | [device](./src/device/readme.kr.md) |
| [`@maxxuxx/ts-utils/device/browser`](./src/device/readme.kr.md) | browser/renderer cookie 기반 device UUID helper | [device/browser](./src/device/readme.kr.md) |
| [`@maxxuxx/ts-utils/device/node`](./src/device/readme.kr.md) | Node machine ID 기반 device UUID helper | [device/node](./src/device/readme.kr.md) |
| [`@maxxuxx/ts-utils/session`](./src/session/readme.kr.md) | framework 독립 token session controller | [session](./src/session/readme.kr.md) |
| [`@maxxuxx/ts-utils/session/sveltekit`](./src/session/readme.kr.md) | SvelteKit cookie session factory | [session/sveltekit](./src/session/readme.kr.md) |
| [`@maxxuxx/ts-utils/session/react`](./src/session/readme.kr.md) | React browser storage token session helper | [session/react](./src/session/readme.kr.md) |
| [`@maxxuxx/ts-utils/api-fetch`](./src/api-fetch/readme.kr.md) | validation, refresh, retry, timeout, hooks, endpoint를 포함한 fetch API client | [api-fetch](./src/api-fetch/readme.kr.md) |
| [`@maxxuxx/ts-utils/api-fetch/sveltekit`](./src/api-fetch/readme.kr.md) | api-fetch auth refresh용 SvelteKit adapter | [api-fetch/sveltekit](./src/api-fetch/readme.kr.md) |
| [`@maxxuxx/ts-utils/http-response`](./src/http-response/readme.kr.md) | route handler용 작은 Web Response helper | [http-response](./src/http-response/readme.kr.md) |

## 런타임 참고

- 일반 유틸 모듈은 의존성을 작게 유지하며 browser와 server code에서 쓰기 쉽게 설계됨
- Zod 기반 모듈은 schema를 가까운 곳에서 정의할 수 있도록 각 subpath에서 `z`를 re-export함
- Device helper는 browser와 Node subpath로 분리되어 있으며 target runtime을 알면 runtime-specific path를 우선 사용함

## 개발

```bash
npm run typecheck
npm test
npm run build
```
