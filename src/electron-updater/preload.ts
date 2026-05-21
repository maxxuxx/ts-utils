import { resolveUpdaterChannels } from "./channels.js";
import { appUpdateStateSchema } from "./schemas.js";
import type {
  AppUpdateState,
  UpdaterBridge,
  UpdaterChannelOptions,
  UpdaterIpcRendererLike,
  UpdaterPreloadBridgeOptions,
  UpdateStateListener
} from "./types.js";

const invokeState = async (
  ipcRenderer: UpdaterIpcRendererLike,
  channel: string
): Promise<AppUpdateState> => appUpdateStateSchema.parse(
  await ipcRenderer.invoke(channel)
);

export const createUpdaterBridge = (
  ipcRenderer: UpdaterIpcRendererLike,
  channelOptions: UpdaterChannelOptions = {}
): UpdaterBridge => {
  const channels = resolveUpdaterChannels(channelOptions);

  return Object.freeze({
    check   : () => invokeState(ipcRenderer, channels.check),
    getState: () => invokeState(ipcRenderer, channels.stateGet),
    install : () => invokeState(ipcRenderer, channels.install),
    onState : (listener: UpdateStateListener): (() => void) => {
      const wrappedListener = (_event: unknown, payload: unknown): void => {
        listener(appUpdateStateSchema.parse(payload));
      };

      ipcRenderer.on(channels.stateChanged, wrappedListener);

      return () => {
        if (ipcRenderer.off) {
          ipcRenderer.off(channels.stateChanged, wrappedListener);
          return;
        }

        ipcRenderer.removeListener?.(channels.stateChanged, wrappedListener);
      };
    },
    start: () => invokeState(ipcRenderer, channels.start)
  });
};

export const exposeUpdaterBridge = (
  options: UpdaterPreloadBridgeOptions
): UpdaterBridge => {
  const api = createUpdaterBridge(options.ipcRenderer, options.channels);

  options.contextBridge.exposeInMainWorld(options.apiKey ?? "electronUpdater", api);

  return api;
};
