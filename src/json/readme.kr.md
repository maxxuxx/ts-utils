# JSON 모듈

[English](./readme.md)

JSON parse, stringify, result helper, fallback helper, schema validation, JSON-compatible value check를 제공합니다.

## 언제 사용하나

- storage, query params, message payload 같은 JSON boundary를 명시적으로 다루고 싶을 때 사용합니다.
- invalid parse/stringify를 result 또는 fallback으로 처리하고 싶을 때 사용합니다.
- parse한 값을 `parse` method가 있는 schema-like object로 검증하고 싶을 때 사용합니다.

## Import

```ts
import {
  json,
  parseJson,
  safeParseJson,
  stringifyJson,
  isJsonValue
} from "@maxxuxx/ts-utils/json";
```

## 주요 export

| Export | 역할 |
|---|---|
| `safeParseJson`, `parseJson` | JSON parse를 result 또는 throw/fallback 방식으로 처리합니다. |
| `safeStringifyJson`, `stringifyJson` | stringify를 result 또는 throw/fallback 방식으로 처리합니다. |
| `safeParseJsonWithSchema`, `parseJsonWithSchema` | JSON parse 후 schema로 검증합니다. |
| `isJsonValue` | 값이 JSON-compatible인지 확인합니다. |
| `JsonParseError`, `JsonStringifyError` | parse/stringify 실패를 감싸는 error입니다. |
| `json` | 동일 helper를 묶은 namespace입니다. |

## 기본 예제

```ts
const config = json.parse(localStorage.getItem("config"), {
  fallback: {
    theme: "light"
  }
});

const text = json.stringify(config, {
  space: 2
});
```

## 동작 메모

- `safeParseJson`은 string만 받습니다. `null`과 `undefined`는 invalid input입니다.
- `parseJson`은 명시적 `fallback`이 없으면 throw합니다.
- `safeStringifyJson`은 top-level `undefined`를 실패로 처리합니다.
- schema helper는 `parse(value)` function이 있는 객체를 받을 수 있습니다.
- `JsonResult`는 `@maxxuxx/ts-utils/result`의 공통 `Result` contract alias입니다

## 주의할 점

- circular object와 `BigInt` stringify 실패는 `JsonStringifyError`가 됩니다.
- `isJsonValue`는 `NaN`, `Infinity`, `undefined`, function, symbol, `BigInt`, date, map, set, class instance, circular structure를 거부합니다.
- safe schema helper는 schema validation error를 그대로 반환합니다.
- JSON text를 base64나 hex로 인코딩해야 하면 `encoding`을 함께 사용합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/parser`는 Zod schema 작성에 사용합니다.
- `@maxxuxx/ts-utils/encoding`은 encoded JSON payload에 사용합니다.
- `@maxxuxx/ts-utils/env`는 JSON env preprocess schema에 사용합니다.
- `@maxxuxx/ts-utils/result`는 공통 result factory와 transform에 사용합니다
