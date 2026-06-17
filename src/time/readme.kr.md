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
  createServerTimePayload,
  fetchServerTimeSample
} from "@maxxuxx/ts-utils/time";
```

## 주요 export

| Export | 역할 |
|---|---|
| `calculateTimeOffset` | NTP 방식 offset, round trip, server processing time을 계산합니다. |
| `createTimeSyncSample` | offset sample을 만들고 `sampledAtMs`를 기록합니다. |
| `pickBestTimeSyncSample` | round trip이 가장 낮고, 다음으로 절대 offset이 낮고, 다음으로 최신 sample을 선택합니다. |
| `createClockSnapshot` | `offsetMs`로 local/server clock snapshot을 만듭니다. |
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

## 동작 메모

- offset 공식은 `((serverReceive - clientSend) + (serverTransmit - clientReceive)) / 2`입니다.
- `roundTripMs`는 server processing time을 제외합니다.
- `fetchServerTimeSample`은 fetch-like function을 받으며 DOM fetch type에 의존하지 않습니다.
- server response는 number 또는 `serverTimeMs`, `serverReceiveTimeMs`, `serverTransmitTimeMs`를 가진 object일 수 있습니다.

## 주의할 점

- 모든 timestamp input은 finite number여야 합니다.
- `ok: false`인 fetch-like response는 status와 status text를 포함한 error를 throw합니다.
- `pickBestTimeSyncSample([])`은 `undefined`를 반환합니다.
- `createClockSnapshot`은 live clock function이 아니라 snapshot object를 반환합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/api-fetch`는 time endpoint를 shared API client로 호출할 때 사용합니다.
- `@maxxuxx/ts-utils/format`은 보정된 date 표시 formatting에 사용합니다.
