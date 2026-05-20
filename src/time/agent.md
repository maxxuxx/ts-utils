# Time module notes

## Purpose

This module provides dependency-free server clock synchronization helpers using NTP-style timestamp math.

## Public shape

Expose time utilities through `src/time/index.ts`.

Consumers should import this module through `@maxxuxx/ts-utils/time` once the package export is available.

```ts
import { fetchServerTimeSample, pickBestTimeSyncSample } from "@maxxuxx/ts-utils/time";
```

## Design decisions

The core offset calculation is pure and only uses numeric millisecond timestamps.

`fetchServerTimeSample` accepts an injected fetch-like function and a string endpoint. It intentionally uses local `FetchLike` and `FetchResponseLike` types instead of DOM fetch types.

Structured payloads use `serverReceiveTimeMs` and `serverTransmitTimeMs`. Numeric payloads are treated as both receive and transmit timestamps.

`pickBestTimeSyncSample` chooses the lowest round trip sample, then the smallest absolute offset, then the newest sample.

Keep this module free of runtime dependencies and DOM type references.
