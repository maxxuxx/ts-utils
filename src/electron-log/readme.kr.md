# Electron log 모듈

[English](./readme.md)

`electron-log` 기반 Electron logging helper이며 main, preload, renderer, bridge-client entry를 제공합니다.

## 언제 사용하나

- Electron main process에서 console, file, IPC transport를 일관되게 설정할 때 사용합니다.
- preload script에서 `contextBridge`로 좁은 logging bridge를 노출할 때 사용합니다.
- renderer에서 main-process code를 import하지 않고 DevTools 또는 main process로 log를 보낼 때 사용합니다.

## Import

```ts
import { configureMainLogger, registerMainBridge } from "@maxxuxx/ts-utils/electron-log/main";
import { exposeBridge } from "@maxxuxx/ts-utils/electron-log/preload";
import { configureRendererLogger } from "@maxxuxx/ts-utils/electron-log/renderer";
import { createBridgeLogger } from "@maxxuxx/ts-utils/electron-log";
```

## 주요 export

| Export | 역할 |
|---|---|
| `electron-log/main` | main process transport 설정과 IPC bridge 등록을 담당합니다. |
| `electron-log/preload` | 안전한 renderer logging bridge를 만들거나 노출합니다. |
| `electron-log/renderer` | renderer 쪽 `electron-log` transport를 설정합니다. |
| `createBridgeLogger` | 노출된 bridge API로 log를 보내는 renderer logger를 만듭니다. |
| `resolveLogLevel`, `shouldLogLevel` | production-aware log level 결정과 message filtering을 담당합니다. |

## 기본 예제

```ts
const logger = configureMainLogger({
  isProduction: app.isPackaged,
  level: "debug",
  productionLevel: "info",
  file: {
    fileName: "main.log"
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

## 동작 메모

- `electron-log`는 package dependency이고 `electron`은 consuming app이 제공하는 optional peer입니다.
- renderer bundle이 main-process module을 끌어오지 않도록 process-specific subpath를 사용합니다.
- 기본 preload API key는 `electronLog`입니다.
- main bridge는 payload shape을 검증한 뒤 logger에 기록합니다.

## 주의할 점

- `productionLevel: false`로 production logging을 끌 수 있습니다.
- main entry는 `electron-log/main`을 lazy-load하므로 import 자체는 테스트하기 쉽습니다.
- 잘못된 bridge payload는 IPC에서 throw하지 않고 무시됩니다.
- 테스트에서는 실제 Electron transport 대신 logger를 주입하는 것이 좋습니다.

## 관련 모듈

- `@maxxuxx/ts-utils/electron-updater`는 update service logging과 같이 사용됩니다.
- `@maxxuxx/ts-utils/device`는 Electron app device identifier lookup과 같이 사용할 수 있습니다.
