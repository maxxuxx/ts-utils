# Object module

[한국어](./readme.kr.md)

Dependency-free helpers for shallow object selection, cleanup, default merging, typed entries, and typed object construction.

## Use this when

- Request payloads, query objects, or response objects need shallow cleanup.
- `null` should be preserved in one path and removed in another.
- Typed `Object.entries` or `Object.fromEntries` wrappers make call sites clearer.

## Import

```ts
import {
  object,
  pick,
  omit,
  compact,
  removeUndefined,
  mergeDefaults
} from "@maxxuxx/ts-utils/object";
```

## Core exports

| Export | Role |
|---|---|
| `pick`, `omit` | Return shallow object copies with selected keys included or excluded. |
| `removeUndefined` | Drops only `undefined` values. |
| `compact` | Drops `null` and `undefined` values. |
| `mergeDefaults` | Shallow merges defaults with defined values from the caller. |
| `entries`, `fromEntries` | Typed wrappers around object entry operations. |
| `object` | Namespace containing the same helpers. |

## Basic example

```ts
const publicUser = omit(user, ["passwordHash"]);

const query = compact({
  keyword: "",
  page: 1,
  categoryId: null,
  active: false
});
```

## Behavior notes

- All helpers are shallow and return new objects.
- `compact` preserves falsy business values such as empty string, `0`, and `false`.
- `removeUndefined` preserves explicit `null` values.
- `mergeDefaults(value, defaults)` spreads defaults first, then defined values from `value`.
- `pick`, `removeUndefined`, `compact`, and `fromEntries` create own data properties for every key, including `__proto__`, without changing the ordinary object prototype

## Edge cases

- `pick` copies enumerable own properties only.
- `omit` shallow-copies with object spread before deleting keys.
- `entries` follows `Object.entries`, so symbol keys are not included.
- `fromEntries` can build string, number, or symbol keyed objects from iterable entries.

## Related modules

- `@maxxuxx/ts-utils/url` for turning cleaned query objects into search params.
- `@maxxuxx/ts-utils/json` for JSON compatibility checks after object shaping.
