# Time module

[한국어](./readme.kr.md)

Client/server timestamp helpers for estimating server time offset and building adjusted clock snapshots.

## Use this when

- A client needs an approximate server clock without constantly asking the server.
- You can measure client send/receive timestamps and server receive/transmit timestamps.
- Several samples should be compared and the lowest-latency sample should be selected.

## Import

```ts
import {
  calculateTimeOffset,
  createTimeSyncSample,
  pickBestTimeSyncSample,
  createClockSnapshot,
  createServerClock,
  createServerTimePayload,
  fetchServerTimeSample,
  setServerTimeHeader
} from "@maxxuxx/ts-utils/time";
```

## Core exports

| Export | Role |
|---|---|
| `calculateTimeOffset` | Calculates NTP-style offset, round trip, and server processing time. |
| `createTimeSyncSample` | Creates an offset sample and records `sampledAtMs`. |
| `pickBestTimeSyncSample` | Chooses the lowest round trip sample, then lower absolute offset, then newest sample. |
| `createClockSnapshot` | Builds a local/server clock snapshot from `offsetMs`. |
| `createServerClock` | Stores time sync samples and exposes adjusted server time. |
| `SERVER_TIME_HEADER`, `setServerTimeHeader` | Resolve and write the same-origin server time header. |
| `localMsToServerMs`, `localMsToServerDate` | Converts local timestamps using an offset. |
| `createServerTimePayload`, `fetchServerTimeSample` | Server response helper and client fetch helper. |

## Basic example

```ts
const sample = await fetchServerTimeSample({
  endpoint: "/time",
  fetch,
  now: Date.now
});

const snapshot = createClockSnapshot(sample.offsetMs);

snapshot.serverTimeMs;
snapshot.serverDate;
```

## Header relay example

```ts
const apiServerClock = createServerClock();

setServerTimeHeader(response.headers, {
  clock: apiServerClock
});
```

## Behavior notes

- Offset formula is `((serverReceive - clientSend) + (serverTransmit - clientReceive)) / 2`.
- `roundTripMs` subtracts server processing time.
- `createServerClock` returns `undefined` snapshots until at least one sample is recorded.
- `setServerTimeHeader` resolves time from an existing header, then a clock, then `Date.now()`.
- `fetchServerTimeSample` accepts a fetch-like function and does not depend on DOM fetch types.
- Server responses can be a number or an object with `serverTimeMs`, `serverReceiveTimeMs`, and `serverTransmitTimeMs`.

## Edge cases

- All timestamp inputs must be finite numbers.
- Failed fetch-like responses with `ok: false` throw an error containing status and status text.
- `pickBestTimeSyncSample([])` returns `undefined`.
- `createClockSnapshot` returns a snapshot object, not a live clock function.

## Related modules

- `@maxxuxx/ts-utils/api-fetch` when the time endpoint should use the shared API client.
- `@maxxuxx/ts-utils/format` for displaying corrected dates.
