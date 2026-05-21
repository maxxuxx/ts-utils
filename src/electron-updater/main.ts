import { resolveUpdaterChannels } from "./channels.js";
import { DEFAULT_INSTALL_DELAY_MS } from "./constants.js";
import {
  appUpdateStateSchema,
  type AppUpdateState
} from "./schemas.js";
import {
  clampProgressPercent,
  createInitialUpdateState,
  createUpdateStateResolver
} from "./state.js";
import type {
  AutoUpdaterEventName,
  AutoUpdaterListener,
  ProgressInfoLike,
  UpdateCheckResultLike,
  UpdateDownloadedInfoLike,
  UpdateInfoLike,
  UpdaterMainBridgeOptions,
  UpdaterService,
  UpdaterServiceOptions,
  UpdateStateListener
} from "./types.js";

const PRERELEASE_VERSION_PATTERN = /-[0-9A-Za-z.-]+$/u;

const ACTIVE_STATUSES = new Set<AppUpdateState["status"]>([
  "checking",
  "downloading",
  "installing"
]);

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message || error.stack || String(error);
  }

  return String(error);
};

const trimUrl = (url: string): string => url.trim().replace(/\/+$/u, "");

const getReleaseLabel = (info?: UpdateInfoLike | UpdateDownloadedInfoLike | null): string => {
  if (!info) {
    return "unknown";
  }

  return info.version || info.releaseName || "unknown";
};

const isUpdateResultAvailable = (
  result: UpdateCheckResultLike | null | undefined | void
): boolean | undefined => {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  return result.isUpdateAvailable;
};

const resolveAllowPrerelease = (
  option: UpdaterServiceOptions["shouldAllowPrerelease"],
  version: string
): boolean => {
  if (typeof option === "boolean") {
    return option;
  }

  if (typeof option === "function") {
    return option(version);
  }

  return PRERELEASE_VERSION_PATTERN.test(version);
};

export const createUpdaterService = (
  options: UpdaterServiceOptions
): UpdaterService => {
  const channels = resolveUpdaterChannels(options.channels);
  const installDelayMs = options.installDelayMs ?? DEFAULT_INSTALL_DELAY_MS;
  const disableWhenNotPackaged = options.disableWhenNotPackaged ?? true;
  const autoUpdater = options.autoUpdater;
  const listeners = new Set<UpdateStateListener>();
  const registeredListeners: Array<{
    eventName: AutoUpdaterEventName;
    listener : AutoUpdaterListener;
  }> = [];
  const resolveUpdateState = createUpdateStateResolver(options.app);

  let state = createInitialUpdateState(options.app);
  let isInitialized = false;
  let installTimer: ReturnType<typeof setTimeout> | null = null;
  let lastAvailableReleaseLabel: string | null = null;

  const emitState = (): void => {
    const parsedState = appUpdateStateSchema.parse(state);
    const window = options.getWindow?.();

    if (window && !window.isDestroyed()) {
      window.webContents.send(channels.stateChanged, parsedState);
    }

    for (const listener of listeners) {
      listener(parsedState);
    }
  };

  const setState = (input: Parameters<typeof resolveUpdateState>[1]): AppUpdateState => {
    state = resolveUpdateState(state, input);
    emitState();

    return state;
  };

  const clearInstallTimer = (): void => {
    if (installTimer) {
      clearTimeout(installTimer);
      installTimer = null;
    }
  };

  const isConfigured = (): boolean => {
    if (options.requireFeedUrl) {
      return Boolean(options.feedUrl && trimUrl(options.feedUrl).length > 0);
    }

    if (options.feedUrl === undefined) {
      return true;
    }

    return trimUrl(options.feedUrl).length > 0;
  };

  const resolveDisabledState = (): AppUpdateState | null => {
    if (!isConfigured()) {
      return setState({
        enabled        : false,
        progressPercent: null,
        reason         : "not-configured",
        status         : "disabled"
      });
    }

    if (disableWhenNotPackaged && !options.app.isPackaged) {
      return setState({
        enabled        : false,
        progressPercent: null,
        reason         : "not-packaged",
        status         : "disabled"
      });
    }

    return null;
  };

  const scheduleInstall = (): void => {
    clearInstallTimer();

    installTimer = setTimeout(() => {
      installTimer = null;
      autoUpdater.quitAndInstall();
    }, installDelayMs);
  };

  const install = async (): Promise<AppUpdateState> => {
    setup();

    if (!state.enabled || state.status !== "downloaded") {
      options.logger?.warn?.("Install requested without a downloaded update.");
      return state;
    }

    setState({
      availableVersion: state.availableVersion,
      enabled         : true,
      progressPercent : null,
      status          : "installing"
    });

    scheduleInstall();

    return state;
  };

  const handleUpdateAvailable = (info: UpdateInfoLike): void => {
    const releaseLabel = getReleaseLabel(info);

    if (
      lastAvailableReleaseLabel === releaseLabel
      && ["available", "downloading", "downloaded", "installing"].includes(state.status)
    ) {
      options.logger?.debug?.("Duplicate update-available event ignored:", releaseLabel);
      return;
    }

    lastAvailableReleaseLabel = releaseLabel;
    options.logger?.info?.("Update available:", releaseLabel);

    setState({
      availableVersion: info.version || releaseLabel,
      enabled         : true,
      progressPercent : null,
      status          : "available"
    });
  };

  const handleUpdateNotAvailable = (info: UpdateInfoLike): void => {
    lastAvailableReleaseLabel = null;
    options.logger?.info?.("Update not available:", getReleaseLabel(info));

    setState({
      enabled        : true,
      progressPercent: null,
      status         : "not-available"
    });
  };

  const handleDownloadProgress = (progress: ProgressInfoLike): void => {
    setState({
      availableVersion: state.availableVersion,
      enabled         : true,
      progressPercent : clampProgressPercent(progress.percent),
      status          : "downloading"
    });
  };

  const handleUpdateDownloaded = (info: UpdateDownloadedInfoLike): void => {
    const releaseLabel = getReleaseLabel(info);
    options.logger?.info?.("Update downloaded:", releaseLabel);

    setState({
      availableVersion: info.version || state.availableVersion || releaseLabel,
      enabled         : true,
      progressPercent : null,
      status          : "downloaded"
    });

    if (options.autoInstallOnDownloaded) {
      void install();
    }
  };

  const handleError = (error: Error): void => {
    const message = getErrorMessage(error);
    options.logger?.error?.("Updater error:", message);

    lastAvailableReleaseLabel = null;

    setState({
      availableVersion: state.availableVersion,
      enabled         : isConfigured(),
      error           : message,
      progressPercent : null,
      reason          : "error",
      status          : "error"
    });
  };

  const registerEvent = (
    eventName: AutoUpdaterEventName,
    listener: AutoUpdaterListener
  ): void => {
    autoUpdater.on(eventName, listener);
    registeredListeners.push({
      eventName,
      listener
    });
  };

  const registerEvents = (): void => {
    registerEvent("checking-for-update", (() => {
      options.logger?.info?.("Checking for update");

      setState({
        enabled        : true,
        progressPercent: null,
        status         : "checking"
      });
    }) as AutoUpdaterListener);

    registerEvent("update-available", ((info: UpdateInfoLike) => {
      handleUpdateAvailable(info);
    }) as AutoUpdaterListener);

    registerEvent("update-not-available", ((info: UpdateInfoLike) => {
      handleUpdateNotAvailable(info);
    }) as AutoUpdaterListener);

    registerEvent("download-progress", ((progress: ProgressInfoLike) => {
      handleDownloadProgress(progress);
    }) as AutoUpdaterListener);

    registerEvent("update-downloaded", ((info: UpdateDownloadedInfoLike) => {
      handleUpdateDownloaded(info);
    }) as AutoUpdaterListener);

    registerEvent("update-cancelled", ((info: UpdateInfoLike) => {
      options.logger?.warn?.("Update cancelled:", getReleaseLabel(info));
      setState({
        availableVersion: state.availableVersion,
        enabled         : true,
        progressPercent : null,
        status          : "cancelled"
      });
    }) as AutoUpdaterListener);

    registerEvent("error", ((error: Error) => {
      handleError(error);
    }) as AutoUpdaterListener);
  };

  const configureUpdater = (): void => {
    if (options.logger !== undefined) {
      autoUpdater.logger = options.logger;
    }

    autoUpdater.autoDownload = options.autoDownload ?? true;
    autoUpdater.autoInstallOnAppQuit = options.autoInstallOnAppQuit ?? true;
    autoUpdater.allowPrerelease = resolveAllowPrerelease(
      options.shouldAllowPrerelease,
      options.app.getVersion()
    );
    autoUpdater.disableDifferentialDownload = options.disableDifferentialDownload ?? true;
    autoUpdater.disableWebInstaller = options.disableWebInstaller ?? true;

    if (options.forceDevUpdateConfig !== undefined) {
      autoUpdater.forceDevUpdateConfig = options.forceDevUpdateConfig;
    }

    if (options.feedUrl !== undefined) {
      autoUpdater.setFeedURL?.({
        provider: "generic",
        url     : trimUrl(options.feedUrl)
      });
    }
  };

  function setup(): AppUpdateState {
    if (isInitialized) {
      emitState();
      return state;
    }

    const disabledState = resolveDisabledState();
    if (disabledState) {
      return disabledState;
    }

    configureUpdater();
    registerEvents();
    isInitialized = true;

    return setState({
      enabled        : true,
      progressPercent: null,
      status         : "idle"
    });
  }

  const check = async (): Promise<AppUpdateState> => {
    setup();

    if (!state.enabled || ACTIVE_STATUSES.has(state.status)) {
      return state;
    }

    const previousAutoDownload = autoUpdater.autoDownload;

    try {
      autoUpdater.autoDownload = false;
      const result = await autoUpdater.checkForUpdates();
      const isAvailable = isUpdateResultAvailable(result);

      if (isAvailable === true && result && typeof result === "object" && result.updateInfo) {
        handleUpdateAvailable(result.updateInfo);
      }

      if (isAvailable === false) {
        handleUpdateNotAvailable(result?.updateInfo ?? {});
      }
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(getErrorMessage(error)));
    } finally {
      autoUpdater.autoDownload = previousAutoDownload;
    }

    return state;
  };

  const start = async (): Promise<AppUpdateState> => {
    setup();

    if (!state.enabled) {
      return state;
    }

    if (state.status === "downloaded") {
      return install();
    }

    if (ACTIVE_STATUSES.has(state.status)) {
      return state;
    }

    if (state.status === "available" && autoUpdater.downloadUpdate) {
      try {
        setState({
          availableVersion: state.availableVersion,
          enabled         : true,
          progressPercent : 0,
          status          : "downloading"
        });
        await autoUpdater.downloadUpdate();
      } catch (error) {
        handleError(error instanceof Error ? error : new Error(getErrorMessage(error)));
      }

      return state;
    }

    const previousAutoDownload = autoUpdater.autoDownload;

    try {
      autoUpdater.autoDownload = true;
      const result = await autoUpdater.checkForUpdates();
      const isAvailable = isUpdateResultAvailable(result);

      if (isAvailable === true && result && typeof result === "object" && result.updateInfo) {
        handleUpdateAvailable(result.updateInfo);
      }

      if (isAvailable === false) {
        handleUpdateNotAvailable(result?.updateInfo ?? {});
      }
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(getErrorMessage(error)));
    } finally {
      autoUpdater.autoDownload = previousAutoDownload;
    }

    return state;
  };

  const getState = (): AppUpdateState => appUpdateStateSchema.parse(state);

  const onState = (listener: UpdateStateListener): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const dispose = (): void => {
    clearInstallTimer();
    listeners.clear();

    for (const registeredListener of registeredListeners) {
      autoUpdater.removeListener?.(
        registeredListener.eventName,
        registeredListener.listener
      );
    }

    registeredListeners.length = 0;
    isInitialized = false;
  };

  return Object.freeze({
    check,
    dispose,
    getState,
    install,
    onState,
    setup,
    start
  });
};

export const registerUpdaterIpcHandlers = (
  options: UpdaterMainBridgeOptions
): (() => void) => {
  const channels = resolveUpdaterChannels(options.channels);
  const removeExistingHandlers = options.removeExistingHandlers ?? true;

  if (removeExistingHandlers) {
    options.ipcMain.removeHandler?.(channels.check);
    options.ipcMain.removeHandler?.(channels.install);
    options.ipcMain.removeHandler?.(channels.start);
    options.ipcMain.removeHandler?.(channels.stateGet);
  }

  options.ipcMain.handle(channels.check, async () => options.service.check());
  options.ipcMain.handle(channels.install, async () => options.service.install());
  options.ipcMain.handle(channels.start, async () => options.service.start());
  options.ipcMain.handle(channels.stateGet, () => options.service.getState());

  return () => {
    options.ipcMain.removeHandler?.(channels.check);
    options.ipcMain.removeHandler?.(channels.install);
    options.ipcMain.removeHandler?.(channels.start);
    options.ipcMain.removeHandler?.(channels.stateGet);
  };
};
