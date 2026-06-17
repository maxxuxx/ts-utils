import { LOG_LEVELS } from "./constants.js";
import { resolveLogLevel, shouldLogLevel } from "./levels.js";
import type {
  BridgeLoggerOptions,
  LoggerFunctions,
  LogLevel,
  LogTarget
} from "./types.js";

const hasTarget = (
  targets: readonly LogTarget[],
  target: LogTarget
): boolean => (
  targets.includes(target) || (target === "main" && targets.includes("terminal"))
);

const writeToConsole = (level: LogLevel, data: unknown[]): void => {
  const method = level === "silly" || level === "verbose" ? "debug" : level;
  const writer = console[method] ?? console.log;

  writer(...data);
};

let warnedMissingBridge = false;

const warnMissingBridge = (): void => {
  if (warnedMissingBridge) {
    return;
  }

  warnedMissingBridge = true;
  console.warn(
    "[ts-utils/electron-log] \"main\" target is enabled but no bridge was provided; main-process logs are dropped"
  );
};

// Renderer bridge client
/** Creates bridge logger */
export const createBridgeLogger = (
  options: BridgeLoggerOptions = {}
): LoggerFunctions => {
  const targets = options.targets ?? ["console", "main"];
  const baseLevel = resolveLogLevel(options);

  const write = (level: LogLevel, data: unknown[]): void => {
    if (!shouldLogLevel(level, baseLevel)) {
      return;
    }

    if (hasTarget(targets, "console") && options.console?.enabled !== false) {
      writeToConsole(level, data);
    }

    if (hasTarget(targets, "main") && options.main?.enabled !== false) {
      if (options.bridge) {
        options.bridge[level](...data);
      } else {
        warnMissingBridge();
      }
    }
  };

  const logger = Object.fromEntries(
    LOG_LEVELS.map((level) => [
      level,
      (...data: unknown[]) => write(level, data)
    ])
  ) as Record<LogLevel, (...data: unknown[]) => void>;

  return Object.freeze({
    ...logger,
    log: (...data: unknown[]) => write("info", data)
  });
};
