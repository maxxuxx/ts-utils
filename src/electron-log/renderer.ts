import electronLog from "electron-log/renderer";

import { resolveLogLevel } from "./levels.js";
import { configureTransport } from "./transport.js";
import type { LogInstance, RendererLoggerOptions } from "./types.js";

const hasMainTarget = (targets: readonly string[]): boolean => (
  targets.includes("main") || targets.includes("terminal")
);

// Renderer logger
export const configureRendererLogger = (
  options: RendererLoggerOptions = {}
): LogInstance => {
  const logger = options.logger ?? electronLog as unknown as LogInstance;
  const targets = options.targets ?? ["console"];
  const baseLevel = resolveLogLevel(options);

  configureTransport(
    logger.transports.console,
    targets.includes("console") ? baseLevel : false,
    options.console
  );

  configureTransport(
    logger.transports.ipc,
    hasMainTarget(targets) ? baseLevel : false,
    options.main
  );

  return logger;
};

export { createBridgeLogger } from "./bridge-client.js";
