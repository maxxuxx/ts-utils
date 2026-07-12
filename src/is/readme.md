# Is module

[한국어](./readme.kr.md)

Dependency-free runtime type guards for common JavaScript and TypeScript value checks.

## Use this when

- Unknown input needs simple type narrowing before business logic.
- Collections, built-in instances, and plain objects should be checked without a schema dependency.
- Call sites read better with either named guards or a grouped `is` namespace.

## Import

```ts
import {
  is,
  isDefined,
  isPlainObject,
  isNonEmptyArray
} from "@maxxuxx/ts-utils/is";
```

## Core exports

| Export | Role |
|---|---|
| Primitive guards | `isString`, `isNonEmptyString`, `isNumber`, `isFiniteNumber`, `isBoolean`, `isNil`, `isDefined`, and more. |
| Object guards | `isObject`, `isPlainObject`, `isRecord`, `hasOwn`, `isFunction`, `isPromiseLike`. |
| Collection guards | `isArray`, `isNonEmptyArray`, `isMap`, `isSet`, `isWeakMap`, `isWeakSet`. |
| Instance guards | `isDate`, `isValidDate`, `isRegExp`, `isError`, `isURL`. |
| Common guards | `isEmpty`, `isTruthy`, `isFalsy`. |
| `is` | Namespace aliases for the same guards. |

## Basic example

```ts
const values: Array<string | null | undefined> = ["a", null, "b"];
const defined = values.filter(isDefined);

if (isPlainObject(payload) && is.hasOwn(payload, "id")) {
  payload.id;
}

if (isNonEmptyArray(items)) {
  items[0];
}
```

## Behavior notes

- `isNumber` excludes `NaN`; use `isFiniteNumber` when `Infinity` must also be rejected.
- `isPrimitive` accepts every JavaScript number primitive, including `NaN`
- `isObject` accepts arrays and class instances because JavaScript treats them as objects.
- `isPlainObject` accepts object literals and null-prototype objects only.
- `isRecord` is currently the same plain-object check typed as `Record<string, unknown>`.

## Edge cases

- `isEmpty` treats `null`, `undefined`, empty strings, arrays, maps, sets, and plain objects as empty.
- `isTruthy` and `isFalsy` follow JavaScript truthiness, including falsy `0n`
- These helpers do not validate nested object shapes. Use `parser` or Zod schemas for that.
- `isURL` checks `value instanceof URL`, not whether a string is a valid URL.

## Related modules

- `@maxxuxx/ts-utils/parser` for schema-backed validation.
- `@maxxuxx/ts-utils/normalize` for fallback-based value coercion.
