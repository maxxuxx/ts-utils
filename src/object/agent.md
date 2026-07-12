# Object module notes

## Purpose

This module provides dependency free object shaping helpers for request payloads, query objects, response DTOs, and option defaults

## Public shape

Expose object utilities through `src/object/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/object`

Provide named exports plus the grouped `object` namespace

```ts
pick(value, ["id"]);
object.pick(value, ["id"]);
compact(query);
object.compact(query);
```

## Internal layout

Keep this module flat in `index.ts` while the implementation remains small

Split into files only if object helpers grow into distinct runtime areas that become hard to scan

## Design decisions

All helpers must be dependency free

Keep functions shallow and predictable; do not add deep merge or path traversal behavior unless explicitly requested

`compact` removes only `null` and `undefined` so falsy business values such as `0`, `false`, and `""` remain intact

`removeUndefined` preserves `null` because callers often use it to explicitly clear optional fields

`mergeDefaults(value, defaults)` treats `undefined` as missing and preserves explicit values from `value`

`entries` follows `Object.entries` semantics and only returns enumerable string-keyed entries

Builders that start from an empty object must use `setOwn` for every key because direct assignment invokes the inherited `__proto__` setter

Prototype-safe builders still return ordinary objects with `Object.prototype`; do not switch them to null-prototype objects

Keep module docs updated whenever object behavior, exports, or internal file layout changes
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
