# Object module

Dependency free helpers for shaping plain object payloads, request options, and API response data

## Public API

```ts
import {
  compact,
  mergeDefaults,
  object,
  omit,
  pick,
  removeUndefined
} from "@maxxuxx/ts-utils/object";
```

Use named exports for direct imports

```ts
const publicUser = omit(user, ["passwordHash"]);
const query = compact({
  keyword: "",
  page: 1,
  categoryId: null,
  locale: undefined
});
```

Use the `object` namespace when grouped call sites read better

```ts
const summary = object.pick(user, ["id", "name"]);
const body = object.removeUndefined({
  name: input.name,
  imageUrl: undefined
});
```

## Behavior notes

`pick` returns a new object with the selected enumerable own properties

`omit` returns a shallow copied object without the selected keys

`compact` removes `null` and `undefined`, while keeping values like `""`, `0`, and `false`

`removeUndefined` removes only `undefined`, so explicit `null` values are preserved

`mergeDefaults(value, defaults)` shallow merges defaults first, then defined values from `value`

`entries` is a typed wrapper around `Object.entries` and returns enumerable string-keyed entries

`fromEntries` builds an object from string, number, or symbol keyed entries
