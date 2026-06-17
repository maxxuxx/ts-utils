# Device module

[한국어](./readme.kr.md)

Device UUID helpers for browser-like renderers and Node main processes, with runtime-specific subpaths and a compatibility root entry.

## Use this when

- A browser or renderer needs a stable application-scoped UUID stored in a cookie.
- A Node main process needs a host machine UUID from macOS, Linux, or Windows platform commands.
- Shared code wants a single `getDeviceUuid` entry and can tolerate runtime detection.

## Import

```ts
import { getDeviceUuid } from "@maxxuxx/ts-utils/device";
import { getBrowserDeviceUuid } from "@maxxuxx/ts-utils/device/browser";
import { getNodeDeviceUuid } from "@maxxuxx/ts-utils/device/node";
```

## Core exports

| Export | Role |
|---|---|
| `getDeviceUuid` | Chooses the browser strategy when `document` exists, otherwise the Node strategy when `process.versions.node` exists. |
| `getBrowserDeviceUuid` | Reads or creates a UUID in a browser cookie. |
| `createCookieDeviceUuidStore` | Builds the cookie-backed browser UUID store. |
| `getNodeDeviceUuid` | Runs platform commands and returns a normalized machine UUID. |
| `parseNodeDeviceUuidOutput`, `normalizeDeviceUuid` | Parse UUID or machine-id command output into canonical UUID text. |
| `getNodeDeviceUuidCommands` | Returns the platform command list for tests or custom executors. |

## Basic example

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

## Behavior notes

- Prefer `device/browser` or `device/node` when the target runtime is known. This keeps bundlers away from the wrong runtime imports.
- The browser UUID is an application cookie, not a hardware identifier.
- The root entry dynamically imports the Node implementation and does not statically import Node runtime modules.
- Node lookup uses `ioreg` on macOS, machine-id files on Linux, and `wmic` or PowerShell on Windows.

## Edge cases

- `createCookieDeviceUuidStore` throws when no browser document is available.
- Invalid existing cookie values are replaced with a new UUID.
- Node lookup throws `AggregateError` after every candidate command fails or returns unparsable output.
- Unsupported Node platforms throw before command execution.

## Related modules

- `@maxxuxx/ts-utils/env` for runtime configuration around cookie names or platform behavior.
- `@maxxuxx/ts-utils/electron-log` when recording device lookup failures in Electron apps.
