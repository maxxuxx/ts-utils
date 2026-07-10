// Result types
/** Represents a success or failure value with a discriminated `ok` field */
export type Result<TData, TError = unknown> =
  | {
      ok  : true;
      data: TData;
    }
  | {
      ok   : false;
      error: TError;
    };

// Result factories
/** Creates a successful result containing the provided data */
export const ok = <TData>(data: TData): Result<TData, never> => ({
  data,
  ok: true
});

/** Creates a failed result containing the provided error */
export const err = <TError>(error: TError): Result<never, TError> => ({
  error,
  ok: false
});

// Result transformations
/** Transforms successful data while preserving failed results by reference */
export const map = <TData, TNext, TError>(
  result: Result<TData, TError>,
  transform: (data: TData) => TNext
): Result<TNext, TError> => (
  result.ok ? ok(transform(result.data)) : result
);

/** Transforms failed errors while preserving successful results by reference */
export const mapError = <TData, TError, TNextError>(
  result: Result<TData, TError>,
  transform: (error: TError) => TNextError
): Result<TData, TNextError> => (
  result.ok ? result : err(transform(result.error))
);
