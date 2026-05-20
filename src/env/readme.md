# Env module

Utilities for reading and validating runtime environment values from Node, Vite, Electron, or injected sources.

## Public API

```ts
import {
  env,
  envSchema,
  getEnv,
  getEnvBoolean,
  getEnvNumber,
  parseEnv,
  requireEnv,
  z
} from "@maxxuxx/ts-utils/env";
```

## Parse a typed config

Use `parseEnv` with an explicit source when code can run outside Node or when tests need stable inputs.

```ts
const Config = z.object({
  API_URL: envSchema.string(),
  DEBUG  : envSchema.boolean().default(false),
  PORT   : envSchema.number().default(3000)
});

const config = parseEnv(Config, {
  API_URL: "https://api.example.com",
  DEBUG  : "false",
  PORT   : "4000"
});
```

The grouped `env` namespace provides the same parser.

```ts
const config = env.parse(Config, import.meta.env);
```

When no source is passed, helpers read `globalThis.process?.env` and fall back to an empty object.

## Read individual values

```ts
const apiUrl = requireEnv("API_URL");
const mode = getEnv("NODE_ENV", { fallback: "development" });
const port = getEnvNumber("PORT", { fallback: 3000 });
const debug = getEnvBoolean("DEBUG", { fallback: false });
```

`getEnvBoolean` accepts `1`, `true`, `t`, `yes`, `y`, and `on` as true values. It accepts `0`, `false`, `f`, `no`, `n`, and `off` as false values.

`requireEnv` throws `EnvMissingError` when a value is missing or blank.

## Schema helpers

`envSchema.string()` trims strings and rejects blank values by default.

`envSchema.number()` converts finite numeric strings to numbers.

`envSchema.boolean()` converts common environment flag strings to booleans.

`envSchema.json(schema)` parses JSON strings before validating with the provided schema.
