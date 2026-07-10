import {
  err,
  ok,
  type Result as SharedResult
} from "../result/index.js";

/** Success variant returned by try-catch helpers */
// Result types
export type ResultSuccess<TData> = Readonly<Extract<
  SharedResult<TData, never>,
  { ok: true }
>>;

/** Failure variant returned by try-catch helpers */
export type ResultFailure<TError = unknown> = Readonly<Extract<
  SharedResult<never, TError>,
  { ok: false }
>>;

/** Result returned by result */
export type Result<TData, TError = unknown> =
  | ResultSuccess<TData>
  | ResultFailure<TError>;

// Try catch helpers
/** Runs catch and returns a result object */
export const tryCatch = <TData, TError = unknown>(
  fn: () => TData
): Result<TData, TError> => {
  try {
    return ok(fn());
  } catch (error) {
    return err(error as TError);
  }
};

/** Runs catch async and returns a result object */
export const tryCatchAsync = async <TData, TError = unknown>(
  fn: () => PromiseLike<TData>
): Promise<Result<TData, TError>> => {
  try {
    return ok(await fn());
  } catch (error) {
    return err(error as TError);
  }
};

// Error helpers
/** Returns error message */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (hasMessage(error)) {
    return error.message;
  }

  return stringifyError(error);
};

/** Normalizes error */
export const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(getErrorMessage(error));
};

// Unknown value helpers
const hasMessage = (error: unknown): error is { message: string } => (
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string"
);

const stringifyError = (error: unknown): string => {
  try {
    const serialized = JSON.stringify(error);

    if (typeof serialized === "string") {
      return serialized;
    }
  } catch {
    // Fall back to String for circular or non-serializable values
  }

  try {
    return String(error);
  } catch {
    return "Unknown error";
  }
};
