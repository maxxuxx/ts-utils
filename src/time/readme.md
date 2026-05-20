# Time module

Utilities for estimating server time from client and server timestamps.

## Public API

```ts
import {
  calculateTimeOffset,
  createClockSnapshot,
  createServerTimePayload,
  fetchServerTimeSample,
  pickBestTimeSyncSample
} from "@maxxuxx/ts-utils/time";
```

## NTP style offset

Use `calculateTimeOffset` or `createTimeSyncSample` with four timestamps:

- `clientSendTimeMs`
- `serverReceiveTimeMs`
- `serverTransmitTimeMs`
- `clientReceiveTimeMs`

The offset is calculated as:

```ts
((serverReceiveTimeMs - clientSendTimeMs) + (serverTransmitTimeMs - clientReceiveTimeMs)) / 2
```

`roundTripMs` excludes server processing time.

## Fetch helper

`fetchServerTimeSample` accepts an injected fetch-like function and endpoint. The endpoint can return a JSON number, a direct number, or an object with `serverTimeMs`, `serverReceiveTimeMs`, and `serverTransmitTimeMs`.

The module defines its own minimal fetch and response types so it does not depend on DOM types.

## Server helper

`createServerTimePayload()` returns the current server time as a structured payload suitable for the client helper.
