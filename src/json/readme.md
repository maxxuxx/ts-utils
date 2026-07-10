# JSON module

[한국어](./readme.kr.md)

Dependency-free JSON parse, stringify, result helpers, fallback helpers, schema validation, and JSON-compatible value checks.

## Use this when

- JSON boundaries should be explicit and safe around storage, query params, or message payloads.
- Invalid parse or stringify should return a result or fallback instead of crashing a caller.
- Parsed values need to pass a schema-like object with a `parse` method.

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

## Core exports

| Export | Role |
|---|---|
| `safeParseJson`, `parseJson` | Parse JSON as result or throwing/fallback helper. |
| `safeStringifyJson`, `stringifyJson` | Stringify values as result or throwing/fallback helper. |
| `safeParseJsonWithSchema`, `parseJsonWithSchema` | Parse JSON and validate the result with a schema. |
| `isJsonValue` | Checks whether a value is JSON-compatible. |
| `JsonParseError`, `JsonStringifyError` | Error wrappers for parse and stringify failures. |
| `json` | Namespace containing the same helpers. |

## Basic example

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

## Behavior notes

- `safeParseJson` accepts only strings. `null` and `undefined` are invalid input.
- `parseJson` throws without an explicit `fallback`.
- `safeStringifyJson` treats top-level `undefined` as failure because `JSON.stringify` returns `undefined`.
- Schema helpers accept any object with a `parse(value)` function.
- `JsonResult` aliases the shared `Result` contract from `@maxxuxx/ts-utils/result`

## Edge cases

- Circular objects and `BigInt` stringify failures become `JsonStringifyError`.
- `isJsonValue` rejects `NaN`, `Infinity`, `undefined`, functions, symbols, `BigInt`, dates, maps, sets, class instances, and circular structures.
- Schema validation errors are returned as-is from safe schema helpers.
- Use `encoding` when JSON text must be base64 or hex encoded.

## Related modules

- `@maxxuxx/ts-utils/parser` for Zod schema creation.
- `@maxxuxx/ts-utils/encoding` for encoded JSON payloads.
- `@maxxuxx/ts-utils/env` for JSON env preprocess schemas.
- `@maxxuxx/ts-utils/result` for shared result factories and transformations
