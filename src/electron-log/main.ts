import path from "node:path";
import { createRequire } from "node:module";

import { resolveLogLevel } from "./levels.js";
import { configureTransport, resolveTransportLevel } from "./transport.js";
import type {
  FileOptions,
  FileTransport,
  LogInstance,
  MainLoggerOptions
} from "./types.js";

const require = createRequire(import.meta.url);

const loadDefaultElectronLog = (): LogInstance => (
  require("electron-log/main") as LogInstance
);

const configureFileTransport = (
  transport: FileTransport | undefined,
  baseLevel: ReturnType<typeof resolveLogLevel>,
  options?: FileOptions
): void => {
  configureTransport(transport, baseLevel, options);

  if (!transport) {
    return;
  }

  if (options?.appName && typeof transport.setAppName === "function") {
    transport.setAppName(options.appName);
  }

  if (options?.fileName !== undefined) {
    transport.fileName = options.fileName;
  }

  if (options?.maxSize !== undefined) {
    transport.maxSize = options.maxSize;
  }

  if (options?.sync !== undefined) {
    transport.sync = options.sync;
  }

  if (options?.writeOptions !== undefined) {
    transport.writeOptions = options.writeOptions;
  }

  if (options?.resolvePath) {
    transport.resolvePathFn = options.resolvePath;
    return;
  }

  if (options?.path) {
    transport.resolvePathFn = () => options.path as string;
    return;
  }

  if (options?.dir || options?.fileName) {
    transport.resolvePathFn = (variables) => path.join(
      options.dir ?? variables.libraryDefaultDir ?? "",
      options.fileName ?? variables.fileName ?? "main.log"
    );
  }
};

// Main logger
/** Configures main logger */
export const configureMainLogger = (
  options: MainLoggerOptions = {}
): LogInstance => {
  const logger = options.logger ?? loadDefaultElectronLog();
  const baseLevel = resolveLogLevel(options);

  configureTransport(logger.transports.console, baseLevel, options.console);
  configureFileTransport(logger.transports.file, baseLevel, options.file);
  configureTransport(
    logger.transports.ipc,
    resolveTransportLevel(baseLevel, options.ipc),
    options.ipc
  );

  if (options.initialize) {
    const initializeOptions = options.initialize === true ? undefined : options.initialize;
    logger.initialize?.(initializeOptions);
  }

  return logger;
};

export { registerMainBridge } from "./bridge-main.js";
