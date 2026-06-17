import { DEFAULT_CHANNEL } from "./constants.js";
import { deserializeLogData, isLogPayload } from "./bridge-payload.js";
import type { LoggerFunctions, MainBridgeOptions } from "./types.js";

const logToMain = (
  logger: LoggerFunctions,
  payload: Parameters<MainBridgeOptions["ipcMain"]["on"]>[1] extends (
    event: unknown,
    payload: infer TPayload
  ) => void ? TPayload : unknown
): void => {
  if (!isLogPayload(payload)) {
    return;
  }

  logger[payload.level](...deserializeLogData(payload.data));
};

// Main bridge
/** Registers main bridge */
export const registerMainBridge = (
  options: MainBridgeOptions
): (() => void) => {
  const channel = options.channel ?? DEFAULT_CHANNEL;
  const listener = (_event: unknown, payload: unknown): void => {
    logToMain(options.logger, payload);
  };

  options.ipcMain.on(channel, listener);

  return () => {
    options.ipcMain.removeListener?.(channel, listener);
  };
};
