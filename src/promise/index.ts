import { err, ok, type Result } from "../result/index.js";

/** Context passed to each retry attempt */
export type RetryContext = Readonly<{
  attempt: number;
  signal : AbortSignal;
}>;

/** Function that returns a value or promise for promise helpers */
export type PromiseTask<TValue> = (
  context: RetryContext
) => TValue | PromiseLike<TValue>;

/** Options for an abort-aware promise sleep */
export type PromiseSleepOptions = Readonly<{
  signal?: AbortSignal;
}>;

/** Options for promise run */
export type PromiseRunOptions = {
  timeoutMs?: number;
  timeoutMessage?: string;
  retries?: number;
  delayMs?: number;
};

/** Options for promise timeout */
export type PromiseTimeoutOptions = Pick<
  PromiseRunOptions,
  "timeoutMessage" | "timeoutMs"
>;

/** Represents promise configured task */
export type PromiseConfiguredTask<TValue> = PromiseRunOptions & {
  task: PromiseTask<TValue>;
};

/** Configuration shape for promise task */
export type PromiseTaskConfig<TValue> =
  | PromiseConfiguredTask<TValue>
  | PromiseTask<TValue>;

/** Represents promise task value */
export type PromiseTaskValue<TTask> =
  TTask extends PromiseTask<infer TValue>
    ? Awaited<TValue>
    : TTask extends PromiseConfiguredTask<infer TValue>
      ? Awaited<TValue>
      : never;

/** Result returned by promise */
export type PromiseResult<TData, TError = unknown> = Result<TData, TError>;

/** Keyed single-flight runner with explicit cache clearing and entry count */
export type SingleFlight<TKey, TValue> = {
  clear: (key?: TKey) => void;
  run  : (key: TKey, task: () => Promise<TValue>) => Promise<TValue>;
  readonly size: number;
};

/** Result returned by promise all */
export type PromiseAllResult<TTasks extends readonly PromiseTaskConfig<unknown>[]> = {
  [TKey in keyof TTasks]: PromiseTaskValue<TTasks[TKey]>
};

/** Result returned by promise settle */
export type PromiseSettleResult<TTasks extends readonly PromiseTaskConfig<unknown>[]> = {
  [TKey in keyof TTasks]: PromiseResult<PromiseTaskValue<TTasks[TKey]>>
};

/** Named promise task map used by object helpers */
export type PromiseTaskRecord = Readonly<Record<string, PromiseTaskConfig<unknown>>>;

/** Result returned by promise all object */
export type PromiseAllObjectResult<TTasks extends PromiseTaskRecord> = {
  [TKey in keyof TTasks]: PromiseTaskValue<TTasks[TKey]>
};

/** Result returned by promise settle object */
export type PromiseSettleObjectResult<TTasks extends PromiseTaskRecord> = {
  [TKey in keyof TTasks]: PromiseResult<PromiseTaskValue<TTasks[TKey]>>
};

type ResolvedPromiseRunOptions = {
  delayMs: number;
  retries: number;
  timeoutMessage?: string;
  timeoutMs?: number;
};

type SingleFlightEntry<TValue> = {
  expiresAt?: number;
  promise   : Promise<TValue>;
};

/** Constant value for default_promise_options */
export const DEFAULT_PROMISE_OPTIONS = Object.freeze({
  delayMs: 300,
  retries: 0
});

/** Error raised for promise timeout failures */
export class PromiseTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message = `Promise timed out after ${timeoutMs} ms`) {
    super(message);

    this.name = "PromiseTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

// Timing

const MAX_TIMER_MS = 2_147_483_647;

const validateTimerMs = (
  value: number,
  name: string
): number => {
  if (!Number.isFinite(value) || value < 0 || value > MAX_TIMER_MS) {
    throw new RangeError(`${name} must be between 0 and ${MAX_TIMER_MS}`);
  }

  return value;
};

const normalizeOptionalMs = (
  value: number | undefined,
  name: string
): number | undefined => (
  value === undefined ? undefined : validateTimerMs(value, name)
);

const getAbortReason = (signal: AbortSignal): unknown => {
  if (signal.reason !== undefined) {
    return signal.reason;
  }

  const error = new Error("The operation was aborted");

  error.name = "AbortError";

  return error;
};

const normalizeRetries = (value: number | undefined): number => {
  const retries = value ?? DEFAULT_PROMISE_OPTIONS.retries;

  if (!Number.isInteger(retries) || retries < 0) {
    throw new RangeError("retries must be a non-negative integer");
  }

  return retries;
};

const mergeDefinedOptions = (
  base: PromiseRunOptions,
  override: PromiseRunOptions
): PromiseRunOptions => {
  const result: PromiseRunOptions = { ...base };

  if (override.delayMs !== undefined) {
    result.delayMs = override.delayMs;
  }

  if (override.retries !== undefined) {
    result.retries = override.retries;
  }

  if (override.timeoutMessage !== undefined) {
    result.timeoutMessage = override.timeoutMessage;
  }

  if (override.timeoutMs !== undefined) {
    result.timeoutMs = override.timeoutMs;
  }

  return result;
};

const resolveRunOptions = (
  options: PromiseRunOptions = {}
): ResolvedPromiseRunOptions => {
  const timeoutMs = normalizeOptionalMs(options.timeoutMs, "timeoutMs");
  const timeoutMessage = options.timeoutMessage;

  return {
    delayMs: validateTimerMs(
      options.delayMs ?? DEFAULT_PROMISE_OPTIONS.delayMs,
      "delayMs"
    ),
    retries: normalizeRetries(options.retries),
    ...(timeoutMessage === undefined ? {} : { timeoutMessage }),
    ...(timeoutMs === undefined ? {} : { timeoutMs })
  };
};

const resolveTaskConfig = <TValue>(
  config: PromiseTaskConfig<TValue>,
  options: PromiseRunOptions
): {
  options: PromiseRunOptions;
  task: PromiseTask<TValue>;
} => {
  if (typeof config === "function") {
    return {
      options,
      task: config
    };
  }

  const { task, ...taskOptions } = config;

  return {
    options: mergeDefinedOptions(options, taskOptions),
    task
  };
};

const runTaskConfig = async <TTask extends PromiseTaskConfig<unknown>>(
  config: TTask,
  options: PromiseRunOptions
): Promise<PromiseTaskValue<TTask>> => {
  const taskConfig = resolveTaskConfig(config, options);

  return await run(taskConfig.task, taskConfig.options) as PromiseTaskValue<TTask>;
};

const settleTaskConfig = async <TTask extends PromiseTaskConfig<unknown>>(
  config: TTask,
  options: PromiseRunOptions
): Promise<PromiseResult<PromiseTaskValue<TTask>>> => {
  try {
    return ok(await runTaskConfig(config, options));
  } catch (error) {
    return err(error);
  }
};

/** Waits for the given number of milliseconds and rejects when its signal aborts */
export const sleep = (
  ms: number,
  options: PromiseSleepOptions = {}
): Promise<void> => {
  const delayMs = validateTimerMs(ms, "ms");
  const signal = options.signal;

  if (signal?.aborted === true) {
    return Promise.reject(getAbortReason(signal));
  }

  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(getAbortReason(signal as AbortSignal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
};

const executeWithTimeout = async <TValue>(
  input: PromiseLike<TValue> | PromiseTask<TValue>,
  options: PromiseTimeoutOptions,
  attempt: number
): Promise<Awaited<TValue>> => {
  const timeoutMs = normalizeOptionalMs(options.timeoutMs, "timeoutMs");
  const controller = new AbortController();
  const execute = async (): Promise<Awaited<TValue>> => (
    typeof input === "function"
      ? await input({
        attempt,
        signal: controller.signal
      }) as Awaited<TValue>
      : await input as Awaited<TValue>
  );

  if (timeoutMs === undefined) {
    return await execute();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      execute(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new PromiseTimeoutError(timeoutMs, options.timeoutMessage));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
};

/** Runs a task or existing promise with an optional timeout */
export const withTimeout = async <TValue>(
  input: PromiseLike<TValue> | PromiseTask<TValue>,
  options: PromiseTimeoutOptions = {}
): Promise<Awaited<TValue>> => (
  executeWithTimeout(input, options, 1)
);

/** Retries a task until it succeeds or the retry limit is reached */
export const retry = async <TValue>(
  task: PromiseTask<TValue>,
  options: PromiseRunOptions = {}
): Promise<Awaited<TValue>> => {
  const runOptions = resolveRunOptions(options);
  const maxAttempts = runOptions.retries + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await executeWithTimeout(task, runOptions, attempt);
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts) {
        break;
      }

      await sleep(runOptions.delayMs);
    }
  }

  throw lastError;
};

/** Runs one configured promise task with retry and timeout options */
export const run = async <TValue>(
  task: PromiseTask<TValue>,
  options: PromiseRunOptions = {}
): Promise<Awaited<TValue>> => (
  retry(task, options)
);

// Single-flight

/** Creates a keyed runner that shares in-flight work and optionally retains successes */
export const createSingleFlight = <TKey, TValue>(
  options: Readonly<{
    successTtlMs?: number;
  }> = {}
): SingleFlight<TKey, TValue> => {
  const successTtlMs = validateTimerMs(options.successTtlMs ?? 0, "successTtlMs");
  const entries = new Map<TKey, SingleFlightEntry<TValue>>();

  const removeExpiredEntries = (): void => {
    const now = Date.now();

    for (const [key, entry] of entries) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        entries.delete(key);
      }
    }
  };

  const runSingle = (
    key: TKey,
    task: () => Promise<TValue>
  ): Promise<TValue> => {
    removeExpiredEntries();

    const existing = entries.get(key);

    if (existing !== undefined) {
      return existing.promise;
    }

    const promise = Promise.resolve().then(task);
    const entry: SingleFlightEntry<TValue> = { promise };

    entries.set(key, entry);
    void promise.then(
      () => {
        if (entries.get(key) !== entry) {
          return;
        }

        if (successTtlMs === 0) {
          entries.delete(key);

          return;
        }

        entry.expiresAt = Date.now() + successTtlMs;
      },
      () => {
        if (entries.get(key) === entry) {
          entries.delete(key);
        }
      }
    );

    return promise;
  };

  return {
    clear: (key?: TKey): void => {
      if (key === undefined) {
        entries.clear();

        return;
      }

      entries.delete(key);
    },
    run: runSingle,
    get size(): number {
      removeExpiredEntries();

      return entries.size;
    }
  };
};

/** Runs configured promise tasks in parallel and returns ordered values */
export const all = async <const TTasks extends readonly PromiseTaskConfig<unknown>[]>(
  tasks: TTasks,
  options: PromiseRunOptions = {}
): Promise<PromiseAllResult<TTasks>> => {
  const results = await Promise.all(
    tasks.map((task) => runTaskConfig(task, options))
  );

  return results as PromiseAllResult<TTasks>;
};

/** Runs named promise tasks in parallel and returns values by key */
export const allObject = async <const TTasks extends PromiseTaskRecord>(
  tasks: TTasks,
  options: PromiseRunOptions = {}
): Promise<PromiseAllObjectResult<TTasks>> => {
  const entries = Object.entries(tasks) as Array<[keyof TTasks, TTasks[keyof TTasks]]>;
  const results = await Promise.all(
    entries.map(async ([key, task]) => [
      key,
      await runTaskConfig(task, options)
    ] as const)
  );

  return Object.fromEntries(results) as PromiseAllObjectResult<TTasks>;
};

/** Runs configured promise tasks and returns result objects instead of throwing */
export const settle = async <const TTasks extends readonly PromiseTaskConfig<unknown>[]>(
  tasks: TTasks,
  options: PromiseRunOptions = {}
): Promise<PromiseSettleResult<TTasks>> => {
  const results = await Promise.all(
    tasks.map((task) => settleTaskConfig(task, options))
  );

  return results as PromiseSettleResult<TTasks>;
};

/** Runs named promise tasks and returns result objects by key */
export const settleObject = async <const TTasks extends PromiseTaskRecord>(
  tasks: TTasks,
  options: PromiseRunOptions = {}
): Promise<PromiseSettleObjectResult<TTasks>> => {
  const entries = Object.entries(tasks) as Array<[keyof TTasks, TTasks[keyof TTasks]]>;
  const results = await Promise.all(
    entries.map(async ([key, task]) => [
      key,
      await settleTaskConfig(task, options)
    ] as const)
  );

  return Object.fromEntries(results) as PromiseSettleObjectResult<TTasks>;
};

/** Grouped helpers for the promise module */
export const promise = Object.freeze({
  all,
  allObject,
  createSingleFlight,
  retry,
  run,
  settle,
  settleObject,
  sleep,
  withTimeout
});
