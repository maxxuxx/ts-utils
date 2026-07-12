import { describe, expect, it } from "vitest";

import {
  SERVER_TIME_HEADER,
  calculateTimeOffset,
  createClockSnapshot,
  createServerClock,
  createServerTimePayload,
  createTimeSyncSample,
  fetchServerTimeSample,
  getServerTimeHeaderMs,
  localMsToServerDate,
  localMsToServerMs,
  parseServerDateHeader,
  pickBestTimeSyncSample,
  resolveServerTimeMs,
  setServerTimeHeader,
  type FetchLike
} from "../src/time/index.js";

describe("time", () => {
  it("calculates NTP-style offset and round trip", () => {
    const result = calculateTimeOffset({
      clientSendTimeMs    : 1_000,
      serverReceiveTimeMs : 1_080,
      serverTransmitTimeMs: 1_090,
      clientReceiveTimeMs : 1_060
    });

    expect(result.offsetMs).toBe(55);
    expect(result.roundTripMs).toBe(50);
    expect(result.serverProcessingMs).toBe(10);
  });

  it("rejects inconsistent timestamp ordering and negative round trips", () => {
    expect(() => calculateTimeOffset({
      clientSendTimeMs    : 1_000,
      serverReceiveTimeMs : 1_100,
      serverTransmitTimeMs: 1_090,
      clientReceiveTimeMs : 1_200
    })).toThrow(RangeError);
    expect(() => calculateTimeOffset({
      clientSendTimeMs    : 1_100,
      serverReceiveTimeMs : 1_000,
      serverTransmitTimeMs: 1_010,
      clientReceiveTimeMs : 1_090
    })).toThrow(RangeError);
    expect(() => calculateTimeOffset({
      clientSendTimeMs    : 1_000,
      serverReceiveTimeMs : 1_100,
      serverTransmitTimeMs: 1_120,
      clientReceiveTimeMs : 1_010
    })).toThrow(RangeError);
  });

  it("builds a time sync sample from client and server timestamps", () => {
    const sample = createTimeSyncSample({
      clientSendTimeMs    : 2_000,
      serverReceiveTimeMs : 2_040,
      serverTransmitTimeMs: 2_050,
      clientReceiveTimeMs : 2_030
    });

    expect(sample).toMatchObject({
      offsetMs          : 30,
      roundTripMs       : 20,
      serverProcessingMs: 10,
      sampledAtMs       : 2_030
    });
  });

  it("picks the sample with lowest round trip then lower absolute offset then newest", () => {
    const slow = {
      ...createTimeSyncSample({
        clientSendTimeMs    : 1_000,
        serverReceiveTimeMs : 1_100,
        serverTransmitTimeMs: 1_100,
        clientReceiveTimeMs : 1_200
      }),
      roundTripMs: 200
    };
    const highOffset = {
      ...createTimeSyncSample({
        clientSendTimeMs    : 2_000,
        serverReceiveTimeMs : 2_100,
        serverTransmitTimeMs: 2_100,
        clientReceiveTimeMs : 2_200
      }),
      roundTripMs: 50,
      offsetMs   : 90,
      sampledAtMs: 2_200
    };
    const best = {
      ...highOffset,
      offsetMs   : 10,
      sampledAtMs: 2_100
    };
    const newestTie = {
      ...best,
      sampledAtMs: 2_300
    };

    expect(pickBestTimeSyncSample([slow, highOffset, best, newestTie])).toBe(newestTie);
    expect(pickBestTimeSyncSample([])).toBeUndefined();
  });

  it("creates clock snapshots and converts local time to server time", () => {
    const snapshot = createClockSnapshot(250, 10_000);

    expect(snapshot).toEqual({
      offsetMs    : 250,
      localTimeMs : 10_000,
      serverTimeMs: 10_250,
      serverDate  : new Date(10_250)
    });
    expect(localMsToServerMs(20_000, -500)).toBe(19_500);
    expect(localMsToServerDate(20_000, -500)).toEqual(new Date(19_500));
    expect(() => createClockSnapshot(Number.MAX_VALUE, Number.MAX_VALUE)).toThrow(RangeError);
    expect(() => createClockSnapshot(1, 8_640_000_000_000_000)).toThrow(RangeError);
    expect(() => localMsToServerMs(8_640_000_000_000_000, 1)).toThrow(RangeError);
    expect(() => localMsToServerDate(8_640_000_000_000_000, 1)).toThrow(RangeError);
  });

  it("parses HTTP date headers into millisecond timestamps", () => {
    expect(parseServerDateHeader("Thu, 01 Jan 1970 00:00:02 GMT")).toBe(2_000);
    expect(parseServerDateHeader("not a date")).toBeUndefined();
    expect(parseServerDateHeader(null)).toBeUndefined();
  });

  it("tracks server clock samples and exposes adjusted server time", () => {
    const clock = createServerClock({
      now: () => 2_000
    });

    expect(clock.getServerTimeMs()).toBeUndefined();

    clock.update(createTimeSyncSample({
      clientSendTimeMs    : 1_000,
      serverReceiveTimeMs : 1_500,
      serverTransmitTimeMs: 1_500,
      clientReceiveTimeMs : 1_000
    }));

    expect(clock.getServerTimeMs()).toBe(2_500);
    expect(clock.getSnapshot()).toMatchObject({
      localTimeMs : 2_000,
      offsetMs    : 500,
      serverTimeMs: 2_500
    });

    clock.clear();

    expect(clock.getServerTimeMs()).toBeUndefined();
  });

  it("resolves server time from existing headers before clock and local fallback", () => {
    const clock = createServerClock({
      now: () => 2_000
    });

    clock.update(createTimeSyncSample({
      clientSendTimeMs    : 1_000,
      serverReceiveTimeMs : 1_500,
      serverTransmitTimeMs: 1_500,
      clientReceiveTimeMs : 1_000
    }));

    expect(resolveServerTimeMs({
      clock,
      headers: new Headers({
        [SERVER_TIME_HEADER]: "1234"
      }),
      now: () => 9_000
    })).toBe(1_234);

    expect(resolveServerTimeMs({
      clock,
      headers: new Headers({
        [SERVER_TIME_HEADER]: "bad"
      }),
      now: () => 9_000
    })).toBe(2_500);

    expect(resolveServerTimeMs({
      now: () => 9_000
    })).toBe(9_000);
  });

  it("sets server time headers with custom header support", () => {
    const headers = new Headers();

    expect(setServerTimeHeader(headers, {
      header: "x-api-time-ms",
      now   : () => 3_333
    })).toBe(3_333);
    expect(headers.get("x-api-time-ms")).toBe("3333");
    expect(getServerTimeHeaderMs(headers, "x-api-time-ms")).toBe(3_333);

    headers.set("x-api-time-ms", "4444");

    expect(setServerTimeHeader(headers, {
      header: "x-api-time-ms",
      now   : () => 9_999
    })).toBe(4_444);
    expect(headers.get("x-api-time-ms")).toBe("4444");
  });

  it("fetches a sample from a structured response payload", async () => {
    const times = [5_000, 5_080];
    const fetch: FetchLike = async (endpoint, init) => {
      expect(endpoint).toBe("/time");
      expect(init).toEqual({
        headers: {
          accept: "application/json"
        }
      });

      return {
        ok  : true,
        json: async () => ({
          serverReceiveTimeMs : 5_050,
          serverTransmitTimeMs: 5_060
        })
      };
    };

    const sample = await fetchServerTimeSample({
      endpoint: "/time",
      fetch,
      init: {
        headers: {
          accept: "application/json"
        }
      },
      now: () => {
        const next = times.shift();

        if (next === undefined) {
          throw new Error("unexpected clock read");
        }

        return next;
      }
    });

    expect(sample.offsetMs).toBe(15);
    expect(sample.roundTripMs).toBe(70);
    expect(sample.sampledAtMs).toBe(5_080);
  });

  it("fetches a sample from a numeric response payload", async () => {
    const times = [10_000, 10_100];
    const sample = await fetchServerTimeSample({
      endpoint: "/time",
      fetch: async () => ({
        ok  : true,
        json: async () => 10_075
      }),
      now: () => times.shift() ?? 0
    });

    expect(sample.offsetMs).toBe(25);
    expect(sample.roundTripMs).toBe(100);
  });

  it("fetches a sample from a directly returned payload", async () => {
    const times = [20_000, 20_040];
    const sample = await fetchServerTimeSample({
      endpoint: "/time",
      fetch: async () => ({
        serverTimeMs: 20_030
      }),
      now: () => times.shift() ?? 0
    });

    expect(sample.offsetMs).toBe(10);
    expect(sample.roundTripMs).toBe(40);
  });

  it("throws on failed response status", async () => {
    await expect(fetchServerTimeSample({
      endpoint: "/time",
      fetch   : async () => ({
        ok        : false,
        status    : 503,
        statusText: "Service Unavailable",
        json      : async () => ({})
      }),
      now: () => 1_000
    })).rejects.toThrow("server time request failed with status 503 Service Unavailable");
  });

  it("creates a structured server time payload", () => {
    expect(createServerTimePayload(1_234)).toEqual({
      serverTimeMs        : 1_234,
      serverReceiveTimeMs : 1_234,
      serverTransmitTimeMs: 1_234,
      iso                 : new Date(1_234).toISOString()
    });
    expect(() => createServerTimePayload(Number.MAX_VALUE)).toThrow(RangeError);
  });
});
