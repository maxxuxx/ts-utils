import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_UPDATER_CHANNELS,
  appUpdateStateSchema
} from "../src/electron-updater/index.js";
import {
  createUpdaterService,
  registerUpdaterIpcHandlers
} from "../src/electron-updater/main.js";
import { createUpdaterBridge } from "../src/electron-updater/preload.js";
import {
  applyAwsCredentials,
  createPublishConfig,
  createS3PublishConfig,
  patchUpdaterCacheDirName,
  normalizePublishPath
} from "../src/electron-updater/builder.js";
import type {
  AppLike,
  AutoUpdaterEventName,
  AutoUpdaterLike,
  AutoUpdaterListener,
  ProgressInfoLike,
  UpdateInfoLike,
  UpdaterIpcRendererLike
} from "../src/electron-updater/index.js";

const createApp = (input: Partial<AppLike> = {}): AppLike => ({
  getVersion: () => "1.0.0",
  isPackaged: true,
  ...input
});

const createAutoUpdater = () => {
  const listeners = new Map<AutoUpdaterEventName, AutoUpdaterListener[]>();
  const updater: AutoUpdaterLike = {
    autoDownload        : true,
    autoInstallOnAppQuit: true,
    checkForUpdates     : vi.fn(async () => undefined),
    downloadUpdate      : vi.fn(async () => undefined),
    on                  : vi.fn((eventName, listener) => {
      listeners.set(eventName, [
        ...(listeners.get(eventName) ?? []),
        listener
      ]);
    }),
    quitAndInstall: vi.fn(),
    removeListener: vi.fn((eventName, listener) => {
      listeners.set(
        eventName,
        (listeners.get(eventName) ?? []).filter((candidate) => candidate !== listener)
      );
    }),
    setFeedURL: vi.fn()
  };

  const emit = (eventName: AutoUpdaterEventName, ...args: unknown[]): void => {
    for (const listener of listeners.get(eventName) ?? []) {
      listener(...args);
    }
  };

  return {
    emit,
    updater
  };
};

describe("electron-updater module", () => {
  it("creates disabled state for unpackaged apps", () => {
    const { updater } = createAutoUpdater();
    const service = createUpdaterService({
      app: createApp({
        isPackaged: false
      }),
      autoUpdater: updater,
      feedUrl    : "https://updates.example.com"
    });

    expect(service.setup()).toMatchObject({
      enabled: false,
      reason : "not-packaged",
      status : "disabled"
    });
    expect(updater.setFeedURL).not.toHaveBeenCalled();
  });

  it("checks for updates without starting auto-download", async () => {
    const { updater } = createAutoUpdater();
    updater.checkForUpdates = vi.fn(async () => ({
      isUpdateAvailable: true,
      updateInfo       : {
        version: "1.1.0"
      }
    }));

    const service = createUpdaterService({
      app        : createApp(),
      autoUpdater: updater,
      feedUrl    : "https://updates.example.com/"
    });

    const state = await service.check();

    expect(updater.setFeedURL).toHaveBeenCalledWith({
      provider: "generic",
      url     : "https://updates.example.com"
    });
    expect(updater.autoDownload).toBe(true);
    expect(state).toMatchObject({
      availableVersion: "1.1.0",
      enabled         : true,
      status          : "available"
    });
  });

  it("publishes update state to listeners and the configured window", () => {
    const { emit, updater } = createAutoUpdater();
    const send = vi.fn();
    const service = createUpdaterService({
      app        : createApp(),
      autoUpdater: updater,
      getWindow  : () => ({
        isDestroyed: () => false,
        webContents: {
          send
        }
      })
    });
    const listener = vi.fn();

    service.onState(listener);
    service.setup();
    emit("download-progress", {
      percent: 48.6
    } satisfies ProgressInfoLike);

    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({
      progressPercent: 49,
      status         : "downloading"
    }));
    expect(send).toHaveBeenLastCalledWith(
      DEFAULT_UPDATER_CHANNELS.stateChanged,
      expect.objectContaining({
        progressPercent: 49,
        status         : "downloading"
      })
    );
  });

  it("downloads an available update and can auto-install after download", () => {
    vi.useFakeTimers();

    const { emit, updater } = createAutoUpdater();
    const service = createUpdaterService({
      app                    : createApp(),
      autoInstallOnDownloaded: true,
      autoUpdater            : updater,
      installDelayMs         : 10
    });

    service.setup();
    emit("update-available", {
      version: "1.1.0"
    } satisfies UpdateInfoLike);
    emit("update-downloaded", {
      version: "1.1.0"
    } satisfies UpdateInfoLike);

    expect(service.getState()).toMatchObject({
      availableVersion: "1.1.0",
      status          : "installing"
    });

    vi.advanceTimersByTime(10);
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("registers main IPC handlers", async () => {
    const handlers = new Map<string, () => unknown>();
    const service = {
      check   : vi.fn(async () => appUpdateStateSchema.parse({
        currentVersion : "1.0.0",
        enabled        : true,
        progressPercent: null,
        status         : "idle"
      })),
      getState: vi.fn(),
      install : vi.fn(),
      start   : vi.fn()
    };

    const dispose = registerUpdaterIpcHandlers({
      ipcMain: {
        handle: (channel, listener) => {
          handlers.set(channel, listener as () => unknown);
        },
        removeHandler: (channel) => {
          handlers.delete(channel);
        }
      },
      service: service as never
    });

    await handlers.get(DEFAULT_UPDATER_CHANNELS.check)?.();

    expect(service.check).toHaveBeenCalledTimes(1);

    dispose();
    expect(handlers.size).toBe(0);
  });

  it("creates a preload bridge with state parsing and event cleanup", async () => {
    let listener: ((event: unknown, payload: unknown) => void) | undefined;
    const ipcRenderer: UpdaterIpcRendererLike = {
      invoke: vi.fn(async () => ({
        currentVersion : "1.0.0",
        enabled        : true,
        progressPercent: null,
        status         : "idle"
      })),
      on: (_channel, nextListener) => {
        listener = nextListener;
      },
      removeListener: (_channel, nextListener) => {
        if (listener === nextListener) {
          listener = undefined;
        }
      }
    };
    const bridge = createUpdaterBridge(ipcRenderer);
    const onState = vi.fn();

    await expect(bridge.getState()).resolves.toMatchObject({
      status: "idle"
    });

    const dispose = bridge.onState(onState);
    listener?.({}, {
      currentVersion : "1.0.0",
      enabled        : true,
      progressPercent: null,
      status         : "available"
    });

    expect(onState).toHaveBeenCalledWith(expect.objectContaining({
      status: "available"
    }));

    dispose();
    expect(listener).toBeUndefined();
  });

  it("creates publish configs and patches updater cache dir", () => {
    const env = {
      APP_UPDATE_ACCESS_KEY: "access",
      APP_UPDATE_SECRET_KEY: "secret"
    };

    applyAwsCredentials({
      env,
      source: env
    });

    expect(env).toMatchObject({
      AWS_ACCESS_KEY_ID    : "access",
      AWS_SECRET_ACCESS_KEY: "secret"
    });
    expect(normalizePublishPath("/releases/prod/")).toBe("releases/prod");
    expect(createS3PublishConfig({
      bucket: "updates",
      path  : "/desktop/prod/"
    })).toEqual({
      acl              : null,
      bucket           : "updates",
      path             : "desktop/prod",
      provider         : "s3",
      publishAutoUpdate: true,
      region           : "ap-northeast-2"
    });
    expect(createPublishConfig({
      generic: {
        url: "https://cdn.example.com/"
      },
      s3: {
        bucket: "updates"
      }
    })).toHaveLength(2);
    expect(patchUpdaterCacheDirName("provider: generic\n", "app-updater")).toBe(
      "provider: generic\nupdaterCacheDirName: app-updater\n"
    );
  });
});
