import { LOG_LEVELS } from "./constants.js";
import type { LogLevel, LogPayload } from "./types.js";

type SerializedError = Readonly<{
  __type: "Error";
  message: string;
  name: string;
  stack?: string;
}>;

const logLevels = new Set<string>(LOG_LEVELS);

// Payload helpers
/** Converts log data into bridge-safe serializable values */
export const serializeLogData = (data: unknown[]): unknown[] => (
  data.map((value) => {
    if (value instanceof Error) {
      const serialized: SerializedError = {
        __type: "Error",
        message: value.message,
        name:    value.name,
        stack:   value.stack
      };

      return serialized;
    }

    return value;
  })
);

const isSerializedError = (value: unknown): value is SerializedError => (
  typeof value === "object"
  && value !== null
  && (value as { __type?: unknown }).__type === "Error"
  && typeof (value as SerializedError).message === "string"
  && typeof (value as SerializedError).name === "string"
);

/** Restores bridge-serialized values back into native objects such as Error */
export const deserializeLogData = (data: unknown[]): unknown[] => (
  data.map((value) => {
    if (isSerializedError(value)) {
      const error = new Error(value.message);

      error.name = value.name;

      if (value.stack !== undefined) {
        error.stack = value.stack;
      }

      return error;
    }

    return value;
  })
);

/** Creates log payload */
export const createLogPayload = (
  level: LogLevel,
  data: unknown[]
): LogPayload => ({
  createdAt: new Date().toISOString(),
  data:      serializeLogData(data),
  level
});

/** Checks whether a value is log payload */
export const isLogPayload = (payload: unknown): payload is LogPayload => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const record = payload as Partial<LogPayload>;

  return (
    typeof record.createdAt === "string"
    && Array.isArray(record.data)
    && typeof record.level === "string"
    && logLevels.has(record.level)
    && (record.scope === undefined || typeof record.scope === "string")
  );
};
