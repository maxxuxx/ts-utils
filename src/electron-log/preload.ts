import { DEFAULT_CHANNEL } from "./constants.js";
import { createLogPayload } from "./bridge-payload.js";
import type {
  ElectronIpcRendererLike,
  BridgeApi,
  LogLevel,
  LogPayload,
  PreloadBridgeOptions
} from "./types.js";

const createSender = (
  ipcRenderer: ElectronIpcRendererLike,
  channel: string
) => (payload: LogPayload): void => {
  ipcRenderer.send(channel, payload);
};

// Preload bridge
/** Creates bridge api */
export const createBridgeApi = (
  ipcRenderer: ElectronIpcRendererLike,
  channel = DEFAULT_CHANNEL
): BridgeApi => {
  const send = createSender(ipcRenderer, channel);
  const log = (level: LogLevel, ...data: unknown[]): void => {
    send(createLogPayload(level, data));
  };

  return Object.freeze({
    send,
    error:   (...data: unknown[]) => log("error", ...data),
    warn:    (...data: unknown[]) => log("warn", ...data),
    info:    (...data: unknown[]) => log("info", ...data),
    verbose: (...data: unknown[]) => log("verbose", ...data),
    debug:   (...data: unknown[]) => log("debug", ...data),
    silly:   (...data: unknown[]) => log("silly", ...data),
    log:     (...data: unknown[]) => log("info", ...data)
  });
};

/** Exposes bridge */
export const exposeBridge = (
  options: PreloadBridgeOptions
): BridgeApi => {
  const api = createBridgeApi(
    options.ipcRenderer,
    options.channel ?? DEFAULT_CHANNEL
  );

  options.contextBridge.exposeInMainWorld(options.apiKey ?? "electronLog", api);

  return api;
};
