# Time 모듈

[English](./readme.md)

client/server timestamp로 server time offset을 추정하고 보정된 clock snapshot을 만드는 helper입니다.

## 언제 사용하나

- client가 server에 계속 묻지 않고 대략적인 server clock을 계산해야 할 때 사용합니다.
- client send/receive timestamp와 server receive/transmit timestamp를 측정할 수 있을 때 사용합니다.
- 여러 sample 중 latency가 가장 낮은 sample을 선택해야 할 때 사용합니다.

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

## 주요 export

| Export | 역할 |
|---|---|
| `calculateTimeOffset` | NTP 방식 offset, round trip, server processing time을 계산합니다. |
| `createTimeSyncSample` | offset sample을 만들고 `sampledAtMs`를 기록합니다. |
| `pickBestTimeSyncSample` | round trip이 가장 낮고, 다음으로 절대 offset이 낮고, 다음으로 최신 sample을 선택합니다. |
| `createClockSnapshot` | `offsetMs`로 local/server clock snapshot을 만듭니다. |
| `createServerClock` | time sync sample을 저장하고 보정된 server time을 노출합니다. |
| `SERVER_TIME_HEADER`, `setServerTimeHeader` | same-origin server time header를 계산하고 기록합니다. |
| `localMsToServerMs`, `localMsToServerDate` | offset으로 local timestamp를 server 기준으로 변환합니다. |
| `createServerTimePayload`, `fetchServerTimeSample` | server response helper와 client fetch helper입니다. |

## 기본 예제

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

## Header relay 예제

```ts
const apiServerClock = createServerClock();

setServerTimeHeader(response.headers, {
  clock: apiServerClock
});
```

## 동작 메모

- offset 공식은 `((serverReceive - clientSend) + (serverTransmit - clientReceive)) / 2`입니다.
- `roundTripMs`는 server processing time을 제외합니다.
- client receive는 client send보다 앞설 수 없고 server transmit은 server receive보다 앞설 수 없으며 round trip은 음수가 될 수 없습니다
- `createServerClock`은 sample이 기록되기 전까지 `undefined` snapshot을 반환합니다.
- `setServerTimeHeader`는 기존 header, clock, `Date.now()` 순서로 server time을 선택합니다.
- `fetchServerTimeSample`은 fetch-like function을 받으며 DOM fetch type에 의존하지 않습니다.
- server response는 number 또는 `serverTimeMs`, `serverReceiveTimeMs`, `serverTransmitTimeMs`를 가진 object일 수 있습니다.

## 주의할 점

- synchronization과 Date-producing timestamp input은 JavaScript Date 범위 안의 finite number여야 합니다
- 해당 helper에서 non-finite input은 `TypeError`, 잘못된 순서와 음수 round trip, 범위 초과, 잘못된 파생 timestamp는 `RangeError`를 throw합니다
- clock snapshot과 local-to-server 변환은 반환 전에 최종 server timestamp를 검증합니다
- `ok: false`인 fetch-like response는 status와 status text를 포함한 error를 throw합니다.
- `pickBestTimeSyncSample([])`은 `undefined`를 반환합니다.
- `createClockSnapshot`은 live clock function이 아니라 snapshot object를 반환합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/api-fetch`는 time endpoint를 shared API client로 호출할 때 사용합니다.
- `@maxxuxx/ts-utils/format`은 보정된 date 표시 formatting에 사용합니다.
