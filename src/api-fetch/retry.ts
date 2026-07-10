import { ApiMethod } from "./types.js";
import type {
  ApiRetry,
  ApiRetryContext,
  ApiRetryOptions,
  RetryStrategy
} from "./types.js";

const DEFAULT_RETRY_METHODS = [ApiMethod.GET] as const;
const DEFAULT_RETRY_STATUS_CODES = [
  408,
  409,
  425,
  429,
  500,
  502,
  503,
  504
] as const;

/** Normalized retry options used by request execution */
export type ResolvedRetryOptions = Readonly<{
  delay            : NonNullable<ApiRetryOptions["delay"]>;
  jitter           : number;
  limit            : number;
  methods          : readonly ApiMethod[];
  respectRetryAfter: boolean;
  shouldRetry      : ApiRetryOptions["shouldRetry"];
  statusCodes      : readonly number[];
  strategy         : RetryStrategy;
}>;

// Retry option resolution
/** Resolves shorthand retry settings into the complete retry policy */
export const resolveRetryOptions = (
  retry: ApiRetry | undefined
): ResolvedRetryOptions => {
  const options = typeof retry === "object" ? retry : undefined;
  const jitter  = options?.jitter ?? 0;

  if (!Number.isFinite(jitter) || jitter < 0 || jitter > 1) {
    throw new RangeError("jitter must be between 0 and 1");
  }

  return {
    delay            : options?.delay ?? 0,
    jitter,
    limit            : resolveRetryLimit(retry, options),
    methods          : options?.methods ?? DEFAULT_RETRY_METHODS,
    respectRetryAfter: options?.respectRetryAfter ?? true,
    shouldRetry      : options?.shouldRetry,
    statusCodes      : options?.statusCodes ?? DEFAULT_RETRY_STATUS_CODES,
    strategy         : options?.strategy ?? "fixed"
  };
};

const resolveRetryLimit = (
  retry: ApiRetry | undefined,
  options: ApiRetryOptions | undefined
): number => {
  let limit: number;

  if (retry === true) {
    limit = 1;
  } else if (typeof retry === "number") {
    limit = retry;
  } else {
    limit = options?.limit ?? 0;
  }

  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new RangeError("retry limit must be a non-negative safe integer");
  }

  return limit;
};

// Retry delay calculation
/** Calculates the next retry delay from policy, response headers, and deterministic inputs */
export const getRetryDelay = (
  options: ResolvedRetryOptions,
  context: ApiRetryContext,
  nowMs: number,
  randomValue: number
): number => {
  const baseDelay = typeof options.delay === "function"
    ? options.delay(context)
    : options.delay;
  const strategyDelay = options.strategy === "exponential"
    ? baseDelay * (2 ** Math.max(0, context.attempt - 1))
    : baseDelay;
  const jitteredDelay = applyJitter(strategyDelay, options.jitter, randomValue);
  const retryAfterDelay = options.respectRetryAfter
    ? getRetryAfterDelay(context.response, nowMs)
    : undefined;

  return Math.max(0, jitteredDelay, retryAfterDelay ?? 0);
};

const applyJitter = (
  delay: number,
  jitter: number,
  randomValue: number
): number => {
  if (jitter === 0) {
    return delay;
  }

  const minDelay = delay * (1 - jitter);
  const maxDelay = delay * (1 + jitter);

  return minDelay + ((maxDelay - minDelay) * randomValue);
};

const getRetryAfterDelay = (
  response: Response | undefined,
  nowMs: number
): number | undefined => {
  const value = response?.headers.get("Retry-After")?.trim();

  if (!value) {
    return undefined;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds)) {
    return /^\d+$/.test(value) ? seconds * 1_000 : undefined;
  }

  const retryAt = Date.parse(value);

  return Number.isFinite(retryAt) ? Math.max(0, retryAt - nowMs) : undefined;
};
