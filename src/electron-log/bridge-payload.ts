import type { LogLevel, LogPayload } from "./types.js";

type SerializedError = Readonly<{
  __type: "Error";
  message: string;
  name: string;
  stack?: string;
}>;

// Payload helpers
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

export const createLogPayload = (
  level: LogLevel,
  data: unknown[]
): LogPayload => ({
  createdAt: new Date().toISOString(),
  data:      serializeLogData(data),
  level
});

export const isLogPayload = (payload: unknown): payload is LogPayload => (
  typeof payload === "object"
  && payload !== null
  && "level" in payload
  && "data" in payload
  && Array.isArray((payload as { data?: unknown }).data)
);
