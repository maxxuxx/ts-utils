// Result types
export type ResultSuccess<TData> = Readonly<{
  ok  : true;
  data: TData;
}>;

export type ResultFailure<TError = unknown> = Readonly<{
  ok   : false;
  error: TError;
}>;

export type Result<TData, TError = unknown> =
  | ResultSuccess<TData>
  | ResultFailure<TError>;

// Result factories
const success = <TData>(data: TData): ResultSuccess<TData> => ({
  ok  : true,
  data: data
});

const failure = <TError>(error: TError): ResultFailure<TError> => ({
  ok   : false,
  error: error
});

// Try catch helpers
export const tryCatch = <TData, TError = unknown>(
  fn: () => TData
): Result<TData, TError> => {
  try {
    return success(fn());
  } catch (error) {
    return failure(error as TError);
  }
};

export const tryCatchAsync = async <TData, TError = unknown>(
  fn: () => PromiseLike<TData>
): Promise<Result<TData, TError>> => {
  try {
    return success(await fn());
  } catch (error) {
    return failure(error as TError);
  }
};

// Error helpers
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
