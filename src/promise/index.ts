/** Function that returns a value or promise for promise helpers */
export type PromiseTask<TValue> = () => TValue | PromiseLike<TValue>;

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
export type PromiseResult<TData, TError = unknown> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: TError;
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

const assertNonNegativeFiniteNumber = (
  value: number,
  name: string
): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative finite number`);
  }

  return value;
};

const normalizeOptionalMs = (
  value: number | undefined,
  name: string
): number | undefined => (
  value === undefined ? undefined : assertNonNegativeFiniteNumber(value, name)
);

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
    delayMs: assertNonNegativeFiniteNumber(
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
    return {
      data: await runTaskConfig(config, options),
      ok  : true
    };
  } catch (error) {
    return {
      error,
      ok: false
    };
  }
};

/** Waits for the given number of milliseconds */
export const sleep = async (ms: number): Promise<void> => {
  const delayMs = assertNonNegativeFiniteNumber(ms, "ms");

  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

/** Runs with timeout */
export const withTimeout = async <TValue>(
  input: PromiseLike<TValue> | PromiseTask<TValue>,
  options: PromiseTimeoutOptions = {}
): Promise<Awaited<TValue>> => {
  const timeoutMs = normalizeOptionalMs(options.timeoutMs, "timeoutMs");
  const execute = async (): Promise<Awaited<TValue>> => (
    typeof input === "function"
      ? await input() as Awaited<TValue>
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
      return await withTimeout(task, runOptions);
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
  retry,
  run,
  settle,
  settleObject,
  sleep,
  withTimeout
});
