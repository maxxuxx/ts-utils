import { describe, expect, it } from "vitest";

import {
  calculateTimeOffset,
  createClockSnapshot,
  createServerTimePayload,
  createTimeSyncSample,
  fetchServerTimeSample,
  localMsToServerDate,
  localMsToServerMs,
  pickBestTimeSyncSample,
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
  });
});
