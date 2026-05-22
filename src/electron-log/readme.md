# Electron log module

Electron logging helpers built on top of `electron-log`

Use process specific imports so renderer bundles do not load main process code

## Main process

`electron-log` is included as a package dependency

Electron itself is expected to be provided by Electron apps

```ts
import { app, ipcMain } from "electron";
import {
  configureMainLogger,
  registerMainBridge
} from "@maxxuxx/ts-utils/electron-log/main";

const logger = configureMainLogger({
  isProduction: app.isPackaged,
  level: "debug",
  productionLevel: "info",
  console: {
    enabled: true
  },
  file: {
    path: "/absolute/path/to/app.log",
    level: "info",
    maxSize: 1024 * 1024,
    format: "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}"
  }
});

registerMainBridge({
  ipcMain,
  logger
});
```

The main bridge validates renderer payload shape before writing to the logger so malformed IPC messages are ignored

Set `productionLevel` to `false` to disable logging in production

```ts
configureMainLogger({
  isProduction: app.isPackaged,
  productionLevel: false
});
```

## Preload bridge

```ts
import { contextBridge, ipcRenderer } from "electron";
import { exposeBridge } from "@maxxuxx/ts-utils/electron-log/preload";

exposeBridge({
  contextBridge,
  ipcRenderer
});
```

This exposes `window.electronLog` by default

## Web renderer

Use the bridge client when the renderer should log to DevTools console, main process terminal, or both

```ts
import { createBridgeLogger } from "@maxxuxx/ts-utils/electron-log";
import type { BridgeApi } from "@maxxuxx/ts-utils/electron-log";

declare global {
  interface Window {
    electronLog: BridgeApi;
  }
}

const logger = createBridgeLogger({
  bridge: window.electronLog,
  isProduction: import.meta.env.PROD,
  productionLevel: "info",
  targets: ["console", "terminal"]
});

logger.info("renderer ready");
logger.debug("hidden in production when productionLevel is info");
```

Use the renderer adapter when the renderer imports `electron-log/renderer` directly

The main process should call `configureMainLogger({ initialize: true })` before renderer IPC transport is used

```ts
import { configureRendererLogger } from "@maxxuxx/ts-utils/electron-log/renderer";

const logger = configureRendererLogger({
  isProduction: import.meta.env.PROD,
  productionLevel: "info",
  targets: ["console", "main"]
});

logger.info("renderer ready");
```

The `main` and `terminal` targets both send renderer logs to the main process

## Levels

Supported levels are `error`, `warn`, `info`, `verbose`, `debug`, and `silly`

Setting the minimum level to `info` logs `error`, `warn`, and `info`, while dropping `verbose`, `debug`, and `silly`
