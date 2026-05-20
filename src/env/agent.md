# Env module notes

## Purpose

This module provides small runtime environment helpers for validated app configuration.

## Public shape

Expose utilities through `src/env/index.ts`.

Consumers import this module through `@maxxuxx/ts-utils/env`.

```ts
import { env, envSchema, z } from "@maxxuxx/ts-utils/env";
```

## Design decisions

Keep source injection first-class so Node, Vite, Electron, tests, and browser-adjacent runtimes can use the same helpers.

Default source discovery should use `globalThis.process?.env` instead of directly depending on a Node-only global.

Use Zod for typed config parsing because it is already a package dependency.

Do not use `z.coerce.boolean()` for env flags because `"false"` would become `true`. Use the module boolean parser instead.

Keep individual getters small and predictable. Missing values return the fallback or `undefined`; required values throw `EnvMissingError`.

Keep this module free of DOM type references.
