# Is module

Dependency free type guards for common TypeScript runtime checks

## Public API

```ts
import { is, isString, isDefined, isPlainObject } from "@maxxuxx/ts-utils/is";
```

Use named guards when tree-shaking or direct imports are preferred

```ts
isString("hello");
isDefined(value);
isPlainObject(payload);
```

Use the `is` namespace when call sites read better with grouped predicates

```ts
is.string("hello");
is.number(10);
is.nonEmptyArray(items);
is.validDate(value);
```

## Guard groups

Primitive guards include `isString`, `isNonEmptyString`, `isNumber`, `isFiniteNumber`, `isInteger`, `isSafeInteger`, `isBoolean`, `isBigInt`, `isSymbol`, `isUndefined`, `isNull`, `isNil`, `isDefined`, and `isPrimitive`

Object guards include `isObject`, `isPlainObject`, `isRecord`, `hasOwn`, `isFunction`, and `isPromiseLike`

Collection guards include `isArray`, `isNonEmptyArray`, `isMap`, `isSet`, `isWeakMap`, and `isWeakSet`

Built-in instance guards include `isDate`, `isValidDate`, `isRegExp`, `isError`, and `isURL`

Common value guards include `isEmpty`, `isTruthy`, and `isFalsy`

## Behavior notes

`isNumber` excludes `NaN`

`isObject` accepts arrays and class instances because JavaScript treats them as objects

`isPlainObject` only accepts object literals or objects with a null prototype

`isEmpty` treats `null`, `undefined`, empty strings, empty arrays, empty maps, empty sets, and empty plain objects as empty
