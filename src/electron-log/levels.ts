import { LOG_LEVELS } from "./constants.js";
import type { BaseLoggerOptions, LogLevel, LogLevelOption } from "./types.js";

const levelOrder = new Map<LogLevel, number>(
  LOG_LEVELS.map((level, index) => [level, index])
);

// Level helpers
export const isProductionRuntime = (): boolean => (
  typeof process !== "undefined" && process.env.NODE_ENV === "production"
);

export const resolveLogLevel = (
  options: BaseLoggerOptions = {}
): LogLevelOption => {
  if (options.enabled === false) {
    return false;
  }

  const isProduction = options.isProduction ?? isProductionRuntime();

  if (isProduction) {
    return options.productionLevel ?? "info";
  }

  return options.level ?? "debug";
};

export const shouldLogLevel = (
  messageLevel: LogLevel,
  minimumLevel: LogLevelOption
): boolean => {
  if (minimumLevel === false) {
    return false;
  }

  const messageOrder = levelOrder.get(messageLevel);
  const minimumOrder = levelOrder.get(minimumLevel);

  return messageOrder !== undefined
    && minimumOrder !== undefined
    && messageOrder <= minimumOrder;
};
