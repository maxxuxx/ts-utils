# ts-utils

[![CI](https://github.com/maxxuxx/ts-utils/actions/workflows/ci.yml/badge.svg)](https://github.com/maxxuxx/ts-utils/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@maxxuxx/ts-utils.svg)](https://www.npmjs.com/package/@maxxuxx/ts-utils)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)

[English](../README.md) · [0.8 마이그레이션 가이드](./migration-0.8.md)

**TypeScript 개발 편의성을 높이기 위한 유틸리티 모듈 모음.**

API client, 런타임 검증, session, 비동기 제어, 데이터 변환, formatting 등 TypeScript 애플리케이션에서 자주 필요한 기능을 제공합니다.

## 설치

```bash
npm install @maxxuxx/ts-utils
```

GitHub에서 직접 설치할 수도 있습니다.

```bash
npm install github:maxxuxx/ts-utils
```

## 빠른 시작

검증된 API client와 재사용 가능한 endpoint를 정의합니다.

```ts
import {
  createApiFetcher,
  endpoint,
  z
} from "@maxxuxx/ts-utils/api-fetch";

const api = createApiFetcher({
  baseURL: "https://api.example.com",
  retry: {
    delay: 250,
    limit: 2,
    strategy: "exponential"
  },
  timeout: 5000
});

const User = z.object({
  id: z.number(),
  name: z.string()
});

const getUser = endpoint.get("/users/:id", {
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  responseSchema: User
});

const result = await api.call(getUser, {
  params: {
    id: 42
  }
});

console.log(result.response.name);
```

## 주요 모듈

| 모듈 | 사용 목적 |
|---|---|
| [`api-fetch`](../src/api-fetch/readme.kr.md) | 검증된 API client, typed endpoint, auth refresh, retry, timeout, hook |
| [`session`](../src/session/readme.kr.md) | TypeScript, React, SvelteKit 애플리케이션을 위한 token session |
| [`parser`](../src/parser/readme.kr.md) | 재사용 가능한 strict/coercing Zod parser |
| [`promise`](../src/promise/readme.kr.md) | Timeout, retry, 병렬 작업, settle, single-flight |
| [`json`](../src/json/readme.kr.md) | 안전한 JSON parse, stringify, schema 검증 |
| [`jwt`](../src/jwt/readme.kr.md) | JWT decode, schema 검증, 만료 판별 |

## 모듈 맵

| Entry point | Core role | Details |
|---|---|---|
| [`@maxxuxx/ts-utils/parser`](../src/parser/readme.kr.md) | 반복적인 런타임 검증을 위한 Zod parser preset과 wrapper | [parser](../src/parser/readme.kr.md) |
| [`@maxxuxx/ts-utils/is`](../src/is/readme.kr.md) | primitive, object, collection, built-in 값을 판별하는 runtime type guard | [is](../src/is/readme.kr.md) |
| [`@maxxuxx/ts-utils/result`](../src/result/readme.kr.md) | 성공/실패 Result 생성과 data/error 변환 helper | [result](../src/result/readme.kr.md) |
| [`@maxxuxx/ts-utils/try-catch`](../src/try-catch/readme.kr.md) | 동기/비동기 에러 경계를 Result 형태로 다루는 helper | [try-catch](../src/try-catch/readme.kr.md) |
| [`@maxxuxx/ts-utils/format`](../src/format/readme.kr.md) | 숫자, 원화, 날짜, 전화번호, 값+단위 표시 helper | [format](../src/format/readme.kr.md) |
| [`@maxxuxx/ts-utils/normalize`](../src/normalize/readme.kr.md) | number, text, date, boolean 값으로 보정하는 작은 coercion helper | [normalize](../src/normalize/readme.kr.md) |
| [`@maxxuxx/ts-utils/object`](../src/object/readme.kr.md) | request/response payload를 다듬는 plain object helper | [object](../src/object/readme.kr.md) |
| [`@maxxuxx/ts-utils/url`](../src/url/readme.kr.md) | web path, API URL, query string helper | [url](../src/url/readme.kr.md) |
| [`@maxxuxx/ts-utils/promise`](../src/promise/readme.kr.md) | promise task timeout, retry, 병렬 실행, settle helper | [promise](../src/promise/readme.kr.md) |
| [`@maxxuxx/ts-utils/json`](../src/json/readme.kr.md) | JSON parse/stringify, fallback, safe result, schema boundary helper | [json](../src/json/readme.kr.md) |
| [`@maxxuxx/ts-utils/encoding`](../src/encoding/readme.kr.md) | UTF-8, base64, hex, byte 변환 helper | [encoding](../src/encoding/readme.kr.md) |
| [`@maxxuxx/ts-utils/encoding/base64url`](../src/encoding/readme.kr.md) | browser와 Node에서 동일하게 검증하는 strict base64url text/byte helper | [encoding/base64url](../src/encoding/readme.kr.md) |
| [`@maxxuxx/ts-utils/jwt`](../src/jwt/readme.kr.md) | JWT header/payload decode와 만료 판별 helper | [jwt](../src/jwt/readme.kr.md) |
| [`@maxxuxx/ts-utils/env`](../src/env/readme.kr.md) | runtime env 값 읽기와 Zod schema helper | [env](../src/env/readme.kr.md) |
| [`@maxxuxx/ts-utils/time`](../src/time/readme.kr.md) | client/server timestamp 기반 server time 추정 helper | [time](../src/time/readme.kr.md) |
| [`@maxxuxx/ts-utils/device`](../src/device/readme.kr.md) | runtime을 자동 선택하는 device UUID helper | [device](../src/device/readme.kr.md) |
| [`@maxxuxx/ts-utils/device/browser`](../src/device/readme.kr.md) | browser/renderer cookie 기반 device UUID helper | [device/browser](../src/device/readme.kr.md) |
| [`@maxxuxx/ts-utils/device/node`](../src/device/readme.kr.md) | Node machine ID 기반 device UUID helper | [device/node](../src/device/readme.kr.md) |
| [`@maxxuxx/ts-utils/session`](../src/session/readme.kr.md) | framework 독립 token session controller | [session](../src/session/readme.kr.md) |
| [`@maxxuxx/ts-utils/session/sveltekit`](../src/session/readme.kr.md) | SvelteKit cookie session factory | [session/sveltekit](../src/session/readme.kr.md) |
| [`@maxxuxx/ts-utils/session/react`](../src/session/readme.kr.md) | React browser storage token session helper | [session/react](../src/session/readme.kr.md) |
| [`@maxxuxx/ts-utils/api-fetch`](../src/api-fetch/readme.kr.md) | validation, refresh, retry, timeout, hooks, endpoint를 포함한 fetch API client | [api-fetch](../src/api-fetch/readme.kr.md) |
| [`@maxxuxx/ts-utils/api-fetch/sveltekit`](../src/api-fetch/readme.kr.md) | api-fetch auth refresh용 SvelteKit adapter | [api-fetch/sveltekit](../src/api-fetch/readme.kr.md) |
| [`@maxxuxx/ts-utils/http-response`](../src/http-response/readme.kr.md) | route handler용 작은 Web Response helper | [http-response](../src/http-response/readme.kr.md) |

## 런타임 참고

- 이 패키지는 ESM 전용이며 Node 대상 기능을 사용할 때 Node.js 22.12 이상이 필요합니다.
- Zod가 유일한 직접 런타임 의존성이며 schema 중심 subpath에서 다시 export됩니다.
- React와 iron-session은 각 session adapter에서만 사용하는 선택적 peer dependency입니다.
- 일반 유틸 모듈은 browser와 server code에서 사용할 수 있도록 설계되었으며 device helper는 browser와 Node entry point를 명시적으로 제공합니다.
- 상세 동작, edge case, 관련 API는 위 표에서 연결된 각 모듈 README에서 확인할 수 있습니다.

## 개발

```bash
npm run typecheck
npm run build
```
