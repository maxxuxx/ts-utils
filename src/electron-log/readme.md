# Electron log module

[한국어](./readme.kr.md)

Electron logging helpers built on `electron-log`, with main, preload, renderer, and bridge-client entry points.

## Use this when

- An Electron main process needs consistent console, file, and IPC transport configuration.
- A preload script needs to expose a narrow logging bridge through `contextBridge`.
- A renderer needs to log to DevTools, the main process, or both without importing main-process code.

## Import

```ts
import { configureMainLogger, registerMainBridge } from "@maxxuxx/ts-utils/electron-log/main";
import { exposeBridge } from "@maxxuxx/ts-utils/electron-log/preload";
import { configureRendererLogger } from "@maxxuxx/ts-utils/electron-log/renderer";
import { createBridgeLogger } from "@maxxuxx/ts-utils/electron-log";
```

## Core exports

| Export | Role |
|---|---|
| `electron-log/main` | Configures main process transports and registers the IPC bridge. |
| `electron-log/preload` | Creates or exposes a safe renderer logging bridge. |
| `electron-log/renderer` | Configures renderer-side `electron-log` transports. |
| `createBridgeLogger` | Creates a renderer logger that writes through an exposed bridge API. |
| `resolveLogLevel`, `shouldLogLevel` | Resolve production-aware log levels and filter messages. |

## Basic example

```ts
const logger = configureMainLogger({
  isProduction: app.isPackaged,
  level: "debug",
  productionLevel: "info",
  file: {
    fileName: "main.log",
    maxSize: 1024 * 1024
  }
});

registerMainBridge({
  ipcMain,
  logger
});

exposeBridge({
  contextBridge,
  ipcRenderer
});
```

## Behavior notes

- `electron-log` is a package dependency. `electron` is an optional peer and must be provided by the application.
- Use process-specific subpaths so renderer bundles do not load main-process modules.
- The default preload API key is `electronLog`.
- Bridge payloads are validated in the main process before being written to the logger.
- `Error` values sent over the bridge are restored to real `Error` instances in the main process so stack traces survive IPC.

## Edge cases

- Set `productionLevel: false` to disable logging in production.
- A global off (`enabled: false` or `productionLevel: false`) cannot be re-enabled by a per-transport `level`; transports stay off.
- The main entry lazy-loads `electron-log/main` so importing the module is test-friendly.
- Invalid bridge payloads are ignored instead of throwing through IPC.
- `createBridgeLogger` warns once if a `main` target is enabled without a `bridge`, since those logs would be dropped.
- Use an injected logger in tests to avoid touching the real Electron log transport.

## Related modules

- `@maxxuxx/ts-utils/electron-updater` for update service logging.
- `@maxxuxx/ts-utils/device` when logging device identifier lookup in Electron apps.
