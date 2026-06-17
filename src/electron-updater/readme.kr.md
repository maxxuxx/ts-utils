# Electron updater 모듈

[English](./readme.md)

Electron update service, preload bridge, state utility, channel naming, electron-builder publish config helper를 제공합니다.

## 언제 사용하나

- Electron main process에서 `electron-updater` state와 IPC를 감싸는 service가 필요할 때 사용합니다.
- preload script에서 renderer에 update action과 state subscription을 노출할 때 사용합니다.
- build script에서 generic, S3, GitHub publish config를 반복 가능하게 만들 때 사용합니다.

## Import

```ts
import { createUpdaterService, registerUpdaterIpcHandlers } from "@maxxuxx/ts-utils/electron-updater/main";
import { createUpdaterBridge } from "@maxxuxx/ts-utils/electron-updater/preload";
import { createPublishConfig } from "@maxxuxx/ts-utils/electron-updater/builder";
import { resolveUpdaterChannels } from "@maxxuxx/ts-utils/electron-updater";
```

## 주요 export

| Export | 역할 |
|---|---|
| `electron-updater/main` | updater service 생성과 main-process IPC handler 등록을 담당합니다. |
| `electron-updater/preload` | renderer updater bridge를 만들거나 노출합니다. |
| `electron-updater/builder` | electron-builder publish config 생성과 updater cache name patch를 담당합니다. |
| `resolveUpdaterChannels` | 기본 또는 custom IPC channel name을 결정합니다. |
| `createInitialUpdateState`, `createUpdateStateResolver`, `clampProgressPercent` | updater state와 progress 값을 정규화합니다. |
| `appUpdateStateSchema` | bridge payload 검증용 Zod schema입니다. |

## 기본 예제

```ts
const updater = createUpdaterService({
  app,
  autoUpdater,
  feedUrl: "https://updates.example.com/desktop",
  getWindow: () => mainWindow,
  logger,
  autoInstallOnDownloaded: true
});

updater.setup();

registerUpdaterIpcHandlers({
  ipcMain,
  service: updater
});
```

## 동작 메모

- `electron`과 `electron-updater`는 optional peer이며 consuming app이 runtime version을 관리합니다.
- `electron-builder`가 만든 `app-update.yml`을 사용할 때는 `feedUrl`을 생략할 수 있습니다.
- 기본적으로 unpackaged app은 `not-packaged` 이유로 disabled 상태가 됩니다.
- bridge는 `check`, `start`, `install`, `getState`, `onState`를 제공합니다.

## 주의할 점

- `requireFeedUrl`을 켜면 feed URL이 없을 때 service가 disabled 됩니다.
- `check`는 auto-download를 잠시 꺼서 availability만 확인합니다.
- `start`는 available update를 다운로드하거나 auto-download enabled 상태로 확인합니다.
- preload bridge state payload는 renderer listener에 전달되기 전에 Zod로 parse됩니다.

## 관련 모듈

- `@maxxuxx/ts-utils/electron-log`는 updater service logging에 사용합니다.
- `@maxxuxx/ts-utils/env`는 build-time publish 설정을 읽을 때 같이 사용할 수 있습니다.
