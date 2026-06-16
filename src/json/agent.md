# JSON module notes

## Purpose

This module provides dependency free helpers for JSON parse, stringify, JSON value checks, and schema validation at string boundaries

It is intended for local storage values, environment-ish config blobs, API-adjacent text payloads, and other places where a JSON string becomes an unknown JavaScript value

## Public shape

Expose JSON utilities through `src/json/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/json`

Provide named exports plus the grouped `json` namespace

```ts
json.safeParse(text);
json.parse(text, { fallback: {} });
json.safeParseWithSchema(text, Schema);
```

## Design decisions

All helpers must be dependency free

Do not import Zod directly in this module. Schema helpers should accept a structural `parse(value)` contract so callers can pass Zod, parser wrappers, or compatible validators

`safeParseJson` and `parseJson` accept only strings. Treat `null` and `undefined` as invalid text so `localStorage.getItem(...)` does not silently become JSON `null`

`parseJson` throws `JsonParseError` unless a fallback is explicitly provided

`safeStringifyJson` treats an undefined stringify result as failure because this module returns JSON text, not JavaScript values

`isJsonValue` should represent actual JSON-compatible values, so reject `NaN`, `Infinity`, `undefined`, functions, symbols, `BigInt`, dates, maps, sets, class instances, and circular structures

Keep this module focused on JSON parsing and serialization. Do not add UTF, base64, or hex conversion here; use the `encoding` module for byte/string representation conversion

Keep module docs updated whenever JSON behavior, exports, error classes, or schema semantics change
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
