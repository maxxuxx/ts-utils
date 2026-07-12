# Object 모듈

[English](./readme.md)

shallow object selection, cleanup, default merge, typed entries, typed object construction helper입니다.

## 언제 사용하나

- request payload, query object, response object를 shallow하게 정리해야 할 때 사용합니다.
- `null`을 보존해야 하는 경로와 제거해야 하는 경로를 나누고 싶을 때 사용합니다.
- typed `Object.entries` 또는 `Object.fromEntries` wrapper가 call site를 더 명확하게 만들 때 사용합니다.

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

## 주요 export

| Export | 역할 |
|---|---|
| `pick`, `omit` | 선택 key를 포함하거나 제외한 shallow object copy를 반환합니다. |
| `removeUndefined` | `undefined` 값만 제거합니다. |
| `compact` | `null`과 `undefined` 값을 제거합니다. |
| `mergeDefaults` | default와 caller가 넘긴 defined value를 shallow merge합니다. |
| `entries`, `fromEntries` | object entry operation의 typed wrapper입니다. |
| `object` | 동일 helper를 묶은 namespace입니다. |

## 기본 예제

```ts
const publicUser = omit(user, ["passwordHash"]);

const query = compact({
  keyword: "",
  page: 1,
  categoryId: null,
  active: false
});
```

## 동작 메모

- 모든 helper는 shallow하게 동작하고 새 object를 반환합니다.
- `compact`는 빈 문자열, `0`, `false` 같은 falsy business value를 보존합니다.
- `removeUndefined`는 명시적 `null` 값을 보존합니다.
- `mergeDefaults(value, defaults)`는 defaults를 먼저 펼친 뒤 `value`의 defined value를 덮어씁니다.
- `pick`, `removeUndefined`, `compact`, `fromEntries`는 `__proto__`를 포함한 모든 key를 own data property로 만들며 일반 object prototype을 바꾸지 않습니다

## 주의할 점

- `pick`은 enumerable own property만 복사합니다.
- `omit`은 object spread로 shallow copy 후 key를 삭제합니다.
- `entries`는 `Object.entries`를 따르므로 symbol key는 포함하지 않습니다.
- `fromEntries`는 string, number, symbol keyed object를 만들 수 있습니다.

## 관련 모듈

- `@maxxuxx/ts-utils/url`은 정리한 query object를 search params로 바꿀 때 사용합니다.
- `@maxxuxx/ts-utils/json`은 object shaping 후 JSON compatibility 확인에 사용합니다.
