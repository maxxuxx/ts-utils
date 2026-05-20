# Device module

Device UUID helpers for Node main processes and browser-like renderers.

## Public API

```ts
import {
  createCookieDeviceUuidStore,
  getBrowserDeviceUuid,
  getDeviceUuid,
  getNodeDeviceUuid
} from "@maxxuxx/ts-utils/device";
```

`getNodeDeviceUuid` reads a stable machine identifier from the host platform.
It accepts an injected command executor for tests and custom runtimes.

`getBrowserDeviceUuid` stores a temporary generated UUID in a cookie. It uses
narrow `globalThis.document` and `globalThis.crypto` typings so consumers do
not need DOM library types.

`getDeviceUuid` conservatively chooses the browser cookie path when a document
is available, otherwise it uses the Node path when a Node process is detected.
