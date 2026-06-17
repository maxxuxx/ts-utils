# Env module

[한국어](./readme.kr.md)

Runtime environment readers and Zod preprocess schemas for Node, Vite, Electron, tests, or injected sources.

## Use this when

- You need small helpers for optional and required environment values.
- You want number, boolean, and JSON env coercion before Zod validation.
- Code may run outside Node and should accept an injected env source.

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

## Core exports

| Export | Role |
|---|---|
| `getEnv`, `requireEnv` | Read optional or required string-like environment values. |
| `getEnvNumber`, `getEnvBoolean` | Read coerced number and boolean values. |
| `parseEnv`, `safeParseEnv` | Validate a normalized env source with a Zod schema. |
| `envSchema` | Zod preprocess helpers for string, number, boolean, and JSON values. |
| `env` | Namespace containing the same helpers. |
| `EnvMissingError` | Thrown by `requireEnv` for missing or blank values. |

## Basic example

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

## Behavior notes

- Without an explicit source, helpers read `globalThis.process?.env` and fall back to an empty object.
- `envSchema.string()` trims and rejects blank values by default.
- `envSchema.boolean()` accepts values such as `1`, `true`, `yes`, and `on`, and false-like equivalents.
- `normalizeEnvSource` removes only `undefined` values; `null` is preserved for schema validation.

## Edge cases

- `requireEnv` rejects blank strings unless `allowEmpty` is true.
- Invalid numbers and booleans return the provided fallback from getter helpers.
- `envSchema.json(schema)` leaves invalid JSON text unchanged so the provided schema can report validation failure.
- Objects and arrays are not converted by string getters unless schema helpers handle them.

## Related modules

- `@maxxuxx/ts-utils/parser` for request and form parsing presets.
- `@maxxuxx/ts-utils/json` for explicit JSON parsing outside env schemas.
