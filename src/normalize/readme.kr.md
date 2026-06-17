# Normalize 모듈

[English](./readme.md)

unknown input을 fallback 중심으로 보정하는 작은 coercion helper입니다.

## 언제 사용하나

- UI 또는 adapter code에서 unknown input을 안정적인 primitive value로 바꿔야 할 때 사용합니다.
- invalid value를 throw하지 않고 fallback으로 처리하고 싶을 때 사용합니다.
- schema validation 없이 date, text, number, boolean flag, record check가 필요할 때 사용합니다.

## Import

```ts
import {
  to,
  is,
  toNumber,
  toText,
  toDate,
  toDateString,
  toFlagBoolean
} from "@maxxuxx/ts-utils/normalize";
```

## 주요 export

| Export | 역할 |
|---|---|
| `toNumber` | number-like 값을 finite number로 변환하고 실패하면 fallback을 반환합니다. |
| `toText` | defined value를 text로 변환하고 nullish 또는 실패 시 fallback을 반환합니다. |
| `toDate`, `toDateString` | date-like 값을 변환하고 간단한 date token으로 표시합니다. |
| `toFlagBoolean` | custom true value와 common flag string을 boolean으로 변환합니다. |
| `isNotEmptyString`, `isRecord` | normalization call site에서 쓰는 작은 guard입니다. |
| `to`, `is` | 동일 helper를 묶은 namespace입니다. |

## 기본 예제

```ts
const page = to.number(query.page, 1);
const title = to.text(input.title);
const active = to.flagBoolean(query.active);
const day = to.dateString(input.createdAt, "yyyy-mm-dd");
```

## 동작 메모

- `toNumber`는 finite number, numeric string, boolean, safe bigint, valid date를 받습니다.
- `toText`는 valid date를 ISO string으로 반환합니다.
- `toDate`는 `Date` instance를 clone해서 반환합니다.
- `toFlagBoolean`은 `true`, `false`, `yes`, `no`, `on`, `off`, `1`, `0` 같은 문자열을 처리합니다.

## 주의할 점

- 기본 number fallback은 `0`, 기본 text fallback은 빈 문자열입니다.
- invalid date는 fallback 또는 `undefined`를 반환합니다.
- `isRecord`는 object literal과 null-prototype object를 허용하고 array, date, function, `null`은 거부합니다.
- invalid input을 조용히 보정하지 말고 보고해야 하면 `parser` 또는 `env`를 사용합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/format`은 normalization 이후 표시 format에 사용합니다.
- `@maxxuxx/ts-utils/parser`는 schema 기반 검증에 사용합니다.
