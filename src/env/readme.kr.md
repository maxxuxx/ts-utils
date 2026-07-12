# Env 모듈

[English](./readme.md)

Node, Vite, Electron, test, injected source에서 env 값을 읽고 Zod preprocess schema로 검증하는 helper입니다.

## 언제 사용하나

- optional 또는 required environment value를 짧게 읽고 싶을 때 사용합니다.
- number, boolean, JSON env 값을 Zod 검증 전에 보정하고 싶을 때 사용합니다.
- Node 밖에서도 실행될 수 있는 코드가 injected env source를 받아야 할 때 사용합니다.

## Import

```ts
import {
  env,
  envSchema,
  getEnv,
  requireEnv,
  parseEnv,
  z
} from "@maxxuxx/ts-utils/env";
```

## 주요 export

| Export | 역할 |
|---|---|
| `getEnv`, `requireEnv` | optional 또는 required string-like env 값을 읽습니다. |
| `getEnvNumber`, `getEnvBoolean` | number와 boolean으로 보정된 값을 읽습니다. |
| `parseEnv`, `safeParseEnv` | 정규화한 env source를 Zod schema로 검증합니다. |
| `envSchema` | string, number, boolean, JSON용 Zod preprocess helper입니다. |
| `env` | 동일 helper를 묶은 namespace입니다. |
| `EnvMissingError` | `requireEnv`가 missing 또는 blank value에서 throw하는 error입니다. |

## 기본 예제

```ts
const Config = z.object({
  API_URL: envSchema.string(),
  DEBUG: envSchema.boolean().default(false),
  PORT: envSchema.number().default(3000)
});

const config = env.parse(Config, {
  API_URL: " https://api.example.com ",
  DEBUG: "false",
  PORT: "4000"
});
```

## 동작 메모

- source를 넘기지 않으면 `globalThis.process?.env`를 읽고 없으면 빈 객체를 사용합니다.
- `envSchema.string()`은 기본적으로 trim하고 blank 값을 거부합니다.
- `envSchema.boolean()`은 `1`, `true`, `yes`, `on`과 대응 false 값을 처리합니다.
- number와 boolean getter는 injected raw value를 문자열로 바꾸기 전에 parse합니다
- raw boolean, number, bigint 의미는 해당 schema helper와 같습니다
- string getter와 `envSchema.string()`은 text 기반 동작을 유지합니다
- `normalizeEnvSource`는 `undefined`만 제거하고 `null`은 schema 검증을 위해 보존합니다.

## 주의할 점

- `requireEnv`는 `allowEmpty`가 true가 아니면 빈 문자열을 거부합니다.
- getter helper에서 invalid number 또는 boolean은 fallback을 반환합니다.
- safe integer 범위를 벗어난 bigint는 invalid number이며 fallback 또는 `undefined`를 반환합니다
- `envSchema.json(schema)`는 invalid JSON text를 그대로 두어 schema validation이 실패하게 합니다.
- object와 array는 schema helper가 처리하지 않는 한 string getter에서 변환되지 않습니다.

## 관련 모듈

- `@maxxuxx/ts-utils/parser`는 request와 form parsing preset에 사용합니다.
- `@maxxuxx/ts-utils/json`은 env schema 밖에서 명시적으로 JSON을 parse할 때 사용합니다.
