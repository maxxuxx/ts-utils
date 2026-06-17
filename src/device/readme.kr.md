# Device 모듈

[English](./readme.md)

browser-like renderer와 Node main process에서 device UUID를 읽거나 생성하는 helper입니다.

## 언제 사용하나

- browser 또는 renderer에서 cookie 기반 application UUID가 필요할 때 사용합니다.
- Node main process에서 macOS, Linux, Windows machine UUID가 필요할 때 사용합니다.
- 공유 코드에서 runtime 자동 판별이 가능한 단일 `getDeviceUuid`가 필요할 때 사용합니다.

## Import

```ts
import { getDeviceUuid } from "@maxxuxx/ts-utils/device";
import { getBrowserDeviceUuid } from "@maxxuxx/ts-utils/device/browser";
import { getNodeDeviceUuid } from "@maxxuxx/ts-utils/device/node";
```

## 주요 export

| Export | 역할 |
|---|---|
| `getDeviceUuid` | `document`가 있으면 browser 전략, Node process가 있으면 Node 전략을 선택합니다. |
| `getBrowserDeviceUuid` | cookie에서 UUID를 읽거나 없으면 생성합니다. |
| `createCookieDeviceUuidStore` | cookie 기반 browser UUID store를 만듭니다. |
| `getNodeDeviceUuid` | platform command를 실행해서 machine UUID를 정규화합니다. |
| `parseNodeDeviceUuidOutput`, `normalizeDeviceUuid` | command output 또는 machine-id를 UUID로 변환합니다. |
| `getNodeDeviceUuidCommands` | 테스트나 custom executor용 platform command 목록을 반환합니다. |

## 기본 예제

```ts
const browserId = getBrowserDeviceUuid({
  cookieName: "device_uuid",
  sameSite: "Lax",
  secure: true
});

const nodeId = await getNodeDeviceUuid({
  platform: "linux"
});

const detectedId = await getDeviceUuid();
```

## 동작 메모

- target runtime이 정해져 있으면 `device/browser` 또는 `device/node` subpath를 우선 사용합니다.
- browser UUID는 application cookie이며 hardware identifier가 아닙니다.
- root entry는 Node 구현을 동적으로 import하므로 Node runtime module을 정적으로 끌어오지 않습니다.
- Node lookup은 macOS `ioreg`, Linux machine-id 파일, Windows `wmic` 또는 PowerShell을 사용합니다.

## 주의할 점

- `createCookieDeviceUuidStore`는 browser document가 없으면 throw합니다.
- 기존 cookie 값이 UUID가 아니면 새 UUID로 교체합니다.
- Node lookup은 모든 command가 실패하거나 parse 실패하면 `AggregateError`를 throw합니다.
- 지원하지 않는 Node platform은 command 실행 전에 실패합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/env`는 cookie name이나 platform 설정을 읽을 때 같이 사용할 수 있습니다.
- `@maxxuxx/ts-utils/electron-log`는 Electron app에서 device lookup 실패를 기록할 때 유용합니다.
