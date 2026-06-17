# Format 모듈

[English](./readme.md)

숫자, 원화 label, 한국 전화번호, date token, 값+단위 표시를 위한 dependency-free helper입니다.

## 언제 사용하나

- UI 코드에서 throw 대신 fallback 문자열을 반환하는 작은 format helper가 필요할 때 사용합니다.
- 한국 서비스 화면에서 기본 `ko-KR` 숫자와 원화 표시가 필요할 때 사용합니다.
- 전화번호와 날짜 표시를 여러 call site에서 일관되게 유지하고 싶을 때 사용합니다.

## Import

```ts
import {
  format,
  formatNumber,
  formatCurrency,
  formatDate,
  formatPhoneNumber,
  formatValueUnit
} from "@maxxuxx/ts-utils/format";
```

## 주요 export

| Export | 역할 |
|---|---|
| `formatNumber` | `Intl.NumberFormat`으로 finite number-like 값을 표시합니다. |
| `formatCurrency` | 숫자를 표시한 뒤 기본 `원` currency/unit label을 붙입니다. |
| `formatDate` | date-like 값을 간단한 token으로 표시합니다. |
| `formatPhoneNumber` | 주요 한국 전화번호 형태를 표시합니다. |
| `formatValueUnit` | 숫자를 표시한 뒤 임의 unit과 separator를 붙입니다. |
| `format` | 동일 helper를 묶은 namespace입니다. |

## 기본 예제

```ts
format.number(1234.5);
format.currency(12000);
format.phoneNumber("01012345678");
format.date(new Date(2026, 4, 20), "yyyy.mm.dd");
format.valueUnit(12.5, "kg");
```

## 동작 메모

- 기본 locale은 `ko-KR`입니다.
- `formatDate`는 `yyyy`, `mm`, `dd`, `HH`, `MM`, `ss` token을 지원합니다.
- `formatPhoneNumber`는 mobile, 서울 지역번호, 일반 지역번호, 대표번호 패턴을 처리합니다.
- `formatValueUnit`의 기본 separator는 한 칸 공백입니다.

## 주의할 점

- 유효하지 않은 입력은 `fallback`을 반환하며 기본값은 빈 문자열입니다.
- safe integer 범위를 벗어난 `bigint`와 invalid date는 invalid number input으로 봅니다.
- `formatValueUnit`은 unit이 blank이면 fallback을 반환합니다.
- 표시가 아니라 data coercion이 필요하면 `normalize`를 사용합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/normalize`는 fallback 중심 값 보정에 사용합니다.
- `@maxxuxx/ts-utils/parser`는 format 전 입력 검증에 사용합니다.
