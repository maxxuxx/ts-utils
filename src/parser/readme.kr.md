# Parser 모듈

[English](./readme.md)

반복적인 runtime validation pattern을 위한 Zod 기반 parser preset과 작은 wrapper입니다.

## 언제 사용하나

- route params, query value, form value, env-like string을 반복 검증해야 할 때 사용합니다.
- call site에서 `parse`, `safeParse`, `is`, `optional`, `nullable`, `array`를 일관되게 쓰고 싶을 때 사용합니다.
- common strict/coercing parser를 매번 다시 정의하지 않고 사용하고 싶을 때 사용합니다.

## Import

```ts
import {
  createParser,
  parser,
  z
} from "@maxxuxx/ts-utils/parser";
```

## 주요 export

| Export | 역할 |
|---|---|
| `parser` | strict/coercing value용 preset parser namespace입니다. |
| `createParser` | Zod schema를 parse, safeParse, is, optional, nullable, array helper로 감쌉니다. |
| `z` | 가까운 곳에서 schema를 정의하기 위한 Zod re-export입니다. |
| Strict presets | `string`, `number`, `integer`, `boolean`, `date`, `email`, `nonEmptyString`, `uuid`입니다. |
| Coercing presets | `id`, `page`, `limit`, `coerce.*` parser입니다. |

## 기본 예제

```ts
const page = parser.page.parse(query.page);
const limit = parser.limit.parse(query.limit);
const email = parser.email.parse(body.email);

const User = createParser(z.object({
  id: z.number(),
  name: z.string()
}));

if (User.is(payload)) {
  payload.name;
}
```

## 동작 메모

- strict preset은 값을 변환하지 않고 검증합니다.
- `parser.page`는 기본값이 `1`이고 `parser.limit`은 기본값이 `20`, 최대값이 `100`입니다.
- `parser.id`는 positive integer로 coerce합니다.
- `parser.coerce.boolean`은 helper가 처리하는 명시적 boolean-like 값만 허용합니다.

## 주의할 점

- coercing number, integer, page, limit 흐름에서는 빈 문자열이 `undefined`로 전처리됩니다.
- `createParser(...).optional()` 같은 method는 새 parser wrapper를 반환합니다.
- 입력 source가 environment variable이고 JSON env parsing이 필요하면 `env`를 사용합니다.
- 복잡한 cross-field validation은 직접 Zod schema를 작성하는 것이 좋습니다.

## 관련 모듈

- `@maxxuxx/ts-utils/env`는 environment config parsing에 사용합니다.
- `@maxxuxx/ts-utils/api-fetch`는 request/response schema validation에 사용합니다.
- `@maxxuxx/ts-utils/json`은 JSON string boundary에 사용합니다.
