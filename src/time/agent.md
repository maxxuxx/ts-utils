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

`createServerClock` stores bounded samples and exposes adjusted server time from the currently selected sample.

`setServerTimeHeader` writes `x-server-time-ms` by default and resolves time from an existing header, then a clock, then local `Date.now()`.

Keep this module free of runtime dependencies. Core clock math should stay independent from `fetch`; header helpers may accept the platform `Headers` shape.
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
