# Device module

Device UUID helpers for Node main processes and browser-like renderers.

## Public API

```ts
import {
  createCookieDeviceUuidStore,
  getBrowserDeviceUuid
} from "@maxxuxx/ts-utils/device/browser";
import {
  getNodeDeviceUuid
} from "@maxxuxx/ts-utils/device/node";
import {
  getDeviceUuid
} from "@maxxuxx/ts-utils/device";
```

Prefer the runtime-specific subpaths when the target environment is known. The
root `@maxxuxx/ts-utils/device` entry is kept for compatibility and automatic
runtime detection.

`getNodeDeviceUuid` reads a stable machine identifier from the host platform.
It accepts an injected command executor for tests and custom runtimes.
If platform commands run but their output cannot be parsed, the thrown
`AggregateError` includes per-command parse errors with stdout and stderr
summaries.

`getBrowserDeviceUuid` stores a temporary generated UUID in a cookie. It uses
narrow `globalThis.document` and `globalThis.crypto` typings so consumers do
not need DOM library types.

`getDeviceUuid` conservatively chooses the browser cookie path when a document
is available, otherwise it uses the Node path when a Node process is detected.
