# JSON module

Dependency free helpers for JSON parse, stringify, JSON value checks, and schema validation at string boundaries

## Public API

```ts
import {
  json,
  parseJson,
  safeParseJson,
  safeStringifyJson,
  stringifyJson
} from "@maxxuxx/ts-utils/json";
```

## Safe parse

```ts
const result = safeParseJson(input);

if (result.ok) {
  result.data;
} else {
  result.error;
}
```

`safeParseJson` accepts only strings. `null` and `undefined` are treated as invalid input so callers can safely pass values such as `localStorage.getItem(...)` with a fallback.

## Fallback parse

```ts
const config = parseJson(localStorage.getItem("config"), {
  fallback: {
    theme: "light"
  }
});
```

Without a fallback, `parseJson` throws `JsonParseError` on invalid input.

## Stringify

```ts
const text = stringifyJson(payload);
const pretty = json.stringify(payload, {
  space: 2
});
```

`safeStringifyJson` returns `{ ok, data }` or `{ ok, error }`. It treats top-level values that stringify to `undefined`, circular objects, and `BigInt` failures as stringify failures.

## Schema validation

Any schema-like object with a `parse(value)` method can validate the parsed value.

```ts
const result = json.safeParseWithSchema(input, UserSchema);

if (result.ok) {
  result.data;
}
```

This keeps JSON parsing separate from runtime validation while still making the common string-to-schema boundary short.

## JSON value check

```ts
json.isValue({
  id: 1,
  name: "haru",
  active: true
});
```

`isJsonValue` accepts strings, finite numbers, booleans, `null`, arrays, and plain objects that only contain JSON values. It rejects `undefined`, functions, symbols, `BigInt`, `NaN`, `Infinity`, class instances, dates, maps, sets, and circular structures.
