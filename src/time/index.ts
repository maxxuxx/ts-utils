/** Default same-origin header name for exposing server time in milliseconds */
export const SERVER_TIME_HEADER = "x-server-time-ms" as const;

/** Payload shape for server time */
export type ServerTimePayload = {
  serverTimeMs: number;
  serverReceiveTimeMs: number;
  serverTransmitTimeMs: number;
  iso: string;
};

/** Represents server time input */
export type ServerTimeInput = number | {
  serverTimeMs?: number;
  serverReceiveTimeMs?: number;
  serverTransmitTimeMs?: number;
  timeMs?: number;
  nowMs?: number;
  timestampMs?: number;
};

/** Represents time sync timestamps */
export type TimeSyncTimestamps = {
  clientSendTimeMs: number;
  serverReceiveTimeMs: number;
  serverTransmitTimeMs: number;
  clientReceiveTimeMs: number;
};

/** Represents time offset */
export type TimeOffset = TimeSyncTimestamps & {
  offsetMs: number;
  roundTripMs: number;
  serverProcessingMs: number;
};

/** Represents time sync sample */
export type TimeSyncSample = TimeOffset & {
  sampledAtMs: number;
};

/** Represents clock snapshot */
export type ClockSnapshot = {
  offsetMs: number;
  localTimeMs: number;
  serverTimeMs: number;
  serverDate: Date;
};

/** Options for server clock */
export type ServerClockOptions = {
  maxSamples?: number;
  now?: () => number;
};

/** Tracks sampled server time and exposes adjusted server clock values */
export type ServerClock = Readonly<{
  clear: () => void;
  getSample: () => TimeSyncSample | undefined;
  getServerDate: (localTimeMs?: number) => Date | undefined;
  getServerTimeMs: (localTimeMs?: number) => number | undefined;
  getSnapshot: (localTimeMs?: number) => ClockSnapshot | undefined;
  update: (sample: TimeSyncSample) => TimeSyncSample;
}>;

/** Readable header shape accepted by server time helpers */
export type ServerTimeReadableHeaders = Pick<Headers, "get">;

/** Mutable header shape accepted by server time helpers */
export type ServerTimeHeaders = Pick<Headers, "get" | "set">;

/** Options for resolving server time from headers or a clock */
export type ResolveServerTimeOptions = {
  clock?: ServerClock;
  header?: string;
  headers?: ServerTimeReadableHeaders;
  now?: () => number;
};

/** Options for writing server time headers */
export type SetServerTimeHeaderOptions = Omit<ResolveServerTimeOptions, "headers">;

/** Minimal compatible shape for fetch response */
export type FetchResponseLike = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
};

/** Minimal compatible shape for fetch */
export type FetchLike = (
  endpoint: string,
  init?: unknown
) => Promise<FetchResponseLike | ServerTimeInput>;

/** Options for fetch server time */
export type FetchServerTimeOptions = {
  endpoint: string;
  fetch: FetchLike;
  init?: unknown;
  now?: () => number;
};

const DEFAULT_MAX_SAMPLES = 10;

const isFiniteMs = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value)
);

const assertFiniteMs = (value: unknown, name: string): number => {
  if (!isFiniteMs(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }

  return value;
};

const hasJson = (value: unknown): value is FetchResponseLike & { json: () => Promise<unknown> } => (
  typeof value === "object"
  && value !== null
  && typeof (value as { json?: unknown }).json === "function"
);

const parseServerPayload = (payload: unknown): {
  serverReceiveTimeMs: number;
  serverTransmitTimeMs: number;
} => {
  if (isFiniteMs(payload)) {
    return {
      serverReceiveTimeMs : payload,
      serverTransmitTimeMs: payload
    };
  }

  if (typeof payload !== "object" || payload === null) {
    throw new TypeError("server time payload must be a number or object");
  }

  const record = payload as Record<string, unknown>;
  const fallbackTimeMs = record.serverTimeMs ?? record.timeMs ?? record.nowMs ?? record.timestampMs;
  const serverReceiveTimeMs = record.serverReceiveTimeMs ?? fallbackTimeMs;
  const serverTransmitTimeMs = record.serverTransmitTimeMs ?? fallbackTimeMs;

  return {
    serverReceiveTimeMs : assertFiniteMs(serverReceiveTimeMs, "serverReceiveTimeMs"),
    serverTransmitTimeMs: assertFiniteMs(serverTransmitTimeMs, "serverTransmitTimeMs")
  };
};

const normalizeMaxSamples = (value: number | undefined): number => (
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.trunc(value))
    : DEFAULT_MAX_SAMPLES
);

/** Calculates time offset */
export const calculateTimeOffset = ({
  clientSendTimeMs,
  serverReceiveTimeMs,
  serverTransmitTimeMs,
  clientReceiveTimeMs
}: TimeSyncTimestamps): TimeOffset => {
  assertFiniteMs(clientSendTimeMs, "clientSendTimeMs");
  assertFiniteMs(serverReceiveTimeMs, "serverReceiveTimeMs");
  assertFiniteMs(serverTransmitTimeMs, "serverTransmitTimeMs");
  assertFiniteMs(clientReceiveTimeMs, "clientReceiveTimeMs");

  const serverProcessingMs = serverTransmitTimeMs - serverReceiveTimeMs;
  const roundTripMs = (clientReceiveTimeMs - clientSendTimeMs) - serverProcessingMs;
  const offsetMs = ((serverReceiveTimeMs - clientSendTimeMs) + (serverTransmitTimeMs - clientReceiveTimeMs)) / 2;

  return {
    clientSendTimeMs,
    serverReceiveTimeMs,
    serverTransmitTimeMs,
    clientReceiveTimeMs,
    offsetMs,
    roundTripMs,
    serverProcessingMs
  };
};

/** Creates time sync sample */
export const createTimeSyncSample = (timestamps: TimeSyncTimestamps): TimeSyncSample => {
  const offset = calculateTimeOffset(timestamps);

  return {
    ...offset,
    sampledAtMs: timestamps.clientReceiveTimeMs
  };
};

/** Picks selected values */
export const pickBestTimeSyncSample = (
  samples: readonly TimeSyncSample[]
): TimeSyncSample | undefined => {
  let best: TimeSyncSample | undefined;

  for (const sample of samples) {
    if (!best) {
      best = sample;
      continue;
    }

    if (sample.roundTripMs < best.roundTripMs) {
      best = sample;
      continue;
    }

    if (
      sample.roundTripMs === best.roundTripMs
      && Math.abs(sample.offsetMs) < Math.abs(best.offsetMs)
    ) {
      best = sample;
      continue;
    }

    if (
      sample.roundTripMs === best.roundTripMs
      && Math.abs(sample.offsetMs) === Math.abs(best.offsetMs)
      && sample.sampledAtMs > best.sampledAtMs
    ) {
      best = sample;
    }
  }

  return best;
};

/** Creates clock snapshot */
export const createClockSnapshot = (
  offsetMs: number,
  localTimeMs = Date.now()
): ClockSnapshot => {
  assertFiniteMs(offsetMs, "offsetMs");
  assertFiniteMs(localTimeMs, "localTimeMs");

  const serverTimeMs = localTimeMs + offsetMs;

  return {
    offsetMs,
    localTimeMs,
    serverTimeMs,
    serverDate: new Date(serverTimeMs)
  };
};

/** Creates a server clock backed by sampled time offsets */
export const createServerClock = (
  options: ServerClockOptions = {}
): ServerClock => {
  const maxSamples = normalizeMaxSamples(options.maxSamples);
  const now        = options.now ?? Date.now;
  const samples: TimeSyncSample[] = [];
  let selectedSample: TimeSyncSample | undefined;

  const getSnapshot = (
    localTimeMs = now()
  ): ClockSnapshot | undefined => (
    selectedSample
      ? createClockSnapshot(selectedSample.offsetMs, localTimeMs)
      : undefined
  );

  return Object.freeze({
    clear: () => {
      samples.length  = 0;
      selectedSample  = undefined;
    },
    getSample: () => selectedSample,
    getServerDate: (localTimeMs) => getSnapshot(localTimeMs)?.serverDate,
    getServerTimeMs: (localTimeMs) => getSnapshot(localTimeMs)?.serverTimeMs,
    getSnapshot,
    update: (sample) => {
      samples.push(sample);

      if (samples.length > maxSamples) {
        samples.splice(0, samples.length - maxSamples);
      }

      selectedSample = pickBestTimeSyncSample(samples);

      return sample;
    }
  });
};

/** Parses an HTTP Date header into a millisecond timestamp */
export const parseServerDateHeader = (
  value: string | null | undefined
): number | undefined => {
  if (!value) {
    return undefined;
  }

  const timeMs = Date.parse(value);

  return isFiniteMs(timeMs) ? timeMs : undefined;
};

/** Reads a server time millisecond header */
export const getServerTimeHeaderMs = (
  headers: ServerTimeReadableHeaders,
  header: string = SERVER_TIME_HEADER
): number | undefined => {
  const value = headers.get(header);

  if (!value || value.trim() === "") {
    return undefined;
  }

  const timeMs = Number(value);

  return isFiniteMs(timeMs) ? timeMs : undefined;
};

/** Resolves server time from headers, a sampled clock, or local fallback time */
export const resolveServerTimeMs = ({
  clock,
  header = SERVER_TIME_HEADER,
  headers,
  now = Date.now
}: ResolveServerTimeOptions = {}): number => {
  const headerTimeMs = headers
    ? getServerTimeHeaderMs(headers, header)
    : undefined;

  if (headerTimeMs !== undefined) {
    return headerTimeMs;
  }

  const clockTimeMs = clock?.getServerTimeMs();

  if (clockTimeMs !== undefined) {
    return clockTimeMs;
  }

  return assertFiniteMs(now(), "now");
};

/** Writes a server time millisecond header and returns the written value */
export const setServerTimeHeader = (
  headers: ServerTimeHeaders,
  options: SetServerTimeHeaderOptions = {}
): number => {
  const header = options.header ?? SERVER_TIME_HEADER;
  const timeMs = resolveServerTimeMs({
    ...options,
    header,
    headers
  });

  headers.set(header, String(timeMs));

  return timeMs;
};

/** Converts local ms to server ms */
export const localMsToServerMs = (
  localTimeMs: number,
  offsetMs: number
): number => (
  assertFiniteMs(localTimeMs, "localTimeMs") + assertFiniteMs(offsetMs, "offsetMs")
);

/** Converts local ms to server date */
export const localMsToServerDate = (
  localTimeMs: number,
  offsetMs: number
): Date => (
  new Date(localMsToServerMs(localTimeMs, offsetMs))
);

/** Creates server time payload */
export const createServerTimePayload = (
  nowMs = Date.now()
): ServerTimePayload => {
  const serverTimeMs = assertFiniteMs(nowMs, "nowMs");

  return {
    serverTimeMs,
    serverReceiveTimeMs : serverTimeMs,
    serverTransmitTimeMs: serverTimeMs,
    iso                 : new Date(serverTimeMs).toISOString()
  };
};

/** Fetches server time sample */
export const fetchServerTimeSample = async ({
  endpoint,
  fetch,
  init,
  now = Date.now
}: FetchServerTimeOptions): Promise<TimeSyncSample> => {
  const clientSendTimeMs = assertFiniteMs(now(), "clientSendTimeMs");
  const response = await fetch(endpoint, init);

  if (hasJson(response)) {
    if (response.ok === false) {
      const status = response.status === undefined ? "unknown" : String(response.status);
      const statusText = response.statusText ? ` ${response.statusText}` : "";

      throw new Error(`server time request failed with status ${status}${statusText}`);
    }

    const payload = await response.json();
    const clientReceiveTimeMs = assertFiniteMs(now(), "clientReceiveTimeMs");
    const serverTimes = parseServerPayload(payload);

    return createTimeSyncSample({
      clientSendTimeMs,
      ...serverTimes,
      clientReceiveTimeMs
    });
  }

  const clientReceiveTimeMs = assertFiniteMs(now(), "clientReceiveTimeMs");
  const serverTimes = parseServerPayload(response);

  return createTimeSyncSample({
    clientSendTimeMs,
    ...serverTimes,
    clientReceiveTimeMs
  });
};
