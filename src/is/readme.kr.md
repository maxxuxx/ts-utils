# Is 모듈

[English](./readme.md)

자주 쓰는 JavaScript/TypeScript runtime value check를 위한 dependency-free type guard 모음입니다.

## 언제 사용하나

- unknown input을 business logic 전에 단순 type narrowing 해야 할 때 사용합니다.
- schema dependency 없이 collection, built-in instance, plain object를 판별하고 싶을 때 사용합니다.
- named guard 또는 `is` namespace 형태가 call site를 더 읽기 좋게 만들 때 사용합니다.

## Import

```ts
import {
  is,
  isDefined,
  isPlainObject,
  isNonEmptyArray
} from "@maxxuxx/ts-utils/is";
```

## 주요 export

| Export | 역할 |
|---|---|
| Primitive guards | `isString`, `isNonEmptyString`, `isNumber`, `isFiniteNumber`, `isBoolean`, `isNil`, `isDefined` 등입니다. |
| Object guards | `isObject`, `isPlainObject`, `isRecord`, `hasOwn`, `isFunction`, `isPromiseLike`입니다. |
| Collection guards | `isArray`, `isNonEmptyArray`, `isMap`, `isSet`, `isWeakMap`, `isWeakSet`입니다. |
| Instance guards | `isDate`, `isValidDate`, `isRegExp`, `isError`, `isURL`입니다. |
| Common guards | `isEmpty`, `isTruthy`, `isFalsy`입니다. |
| `is` | 동일 guard의 namespace alias입니다. |

## 기본 예제

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

## 동작 메모

- `isNumber`는 `NaN`을 제외합니다. `Infinity`까지 제외하려면 `isFiniteNumber`를 사용합니다.
- `isPrimitive`는 `NaN`을 포함한 모든 JavaScript number primitive를 허용합니다
- `isObject`는 JavaScript 기준에 따라 배열과 class instance도 object로 봅니다.
- `isPlainObject`는 object literal과 null-prototype object만 허용합니다.
- `isRecord`는 현재 plain-object check를 `Record<string, unknown>`으로 type narrowing합니다.

## 주의할 점

- `isEmpty`는 `null`, `undefined`, 빈 문자열, 빈 array/map/set/plain object를 empty로 봅니다.
- `isTruthy`, `isFalsy`는 falsy `0n`을 포함한 JavaScript truthiness를 따릅니다
- nested object shape 검증은 하지 않습니다. 그 경우 `parser` 또는 Zod schema를 사용합니다.
- `isURL`은 string parse가 아니라 `value instanceof URL`을 검사합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/parser`는 schema 기반 검증에 사용합니다.
- `@maxxuxx/ts-utils/normalize`는 fallback 기반 값 보정에 사용합니다.
