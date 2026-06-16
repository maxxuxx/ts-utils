import type { AppUpdateState } from "./schemas.js";

export type {
  AppUpdateReason,
  AppUpdateState,
  AppUpdateStatus
} from "./schemas.js";

/** Represents updater channels */
export type UpdaterChannels = Readonly<{
  check       : string;
  install     : string;
  start       : string;
  stateChanged: string;
  stateGet    : string;
}>;

/** Options for updater channel */
export type UpdaterChannelOptions = Partial<UpdaterChannels>;

/** Minimal compatible shape for update info */
export type UpdateInfoLike = Readonly<{
  releaseDate ?: string;
  releaseName ?: string | null;
  version     ?: string;
  [key: string]: unknown;
}>;

/** Minimal compatible shape for update downloaded info */
export type UpdateDownloadedInfoLike = UpdateInfoLike;

/** Minimal compatible shape for progress info */
export type ProgressInfoLike = Readonly<{
  bytesPerSecond?: number;
  percent        : number;
  total          ?: number;
  transferred    ?: number;
  [key: string]  : unknown;
}>;

/** Minimal compatible shape for update check result */
export type UpdateCheckResultLike = Readonly<{
  isUpdateAvailable?: boolean;
  updateInfo       ?: UpdateInfoLike;
  [key: string]    : unknown;
}>;

/** Minimal compatible shape for app */
export type AppLike = Readonly<{
  getVersion : () => string;
  isPackaged : boolean;
}>;

/** Represents auto updater event name */
export type AutoUpdaterEventName =
  | "checking-for-update"
  | "update-available"
  | "update-not-available"
  | "download-progress"
  | "update-downloaded"
  | "update-cancelled"
  | "error";

/** Listener signature for auto updater */
export type AutoUpdaterListener = (...args: unknown[]) => void;

/** Options for generic feed url */
export type GenericFeedUrlOptions = Readonly<{
  provider: "generic";
  url     : string;
}>;

/** Minimal compatible shape for auto updater */
export type AutoUpdaterLike = {
  allowPrerelease            ?: boolean;
  autoDownload                : boolean;
  autoInstallOnAppQuit        : boolean;
  disableDifferentialDownload?: boolean;
  disableWebInstaller        ?: boolean;
  forceDevUpdateConfig       ?: boolean;
  logger                     ?: unknown;
  checkForUpdates: () => Promise<UpdateCheckResultLike | null | undefined | void>;
  downloadUpdate ?: () => Promise<unknown>;
  on             : (eventName: AutoUpdaterEventName, listener: AutoUpdaterListener) => void;
  quitAndInstall : (isSilent?: boolean, isForceRunAfter?: boolean) => void;
  removeListener?: (eventName: AutoUpdaterEventName, listener: AutoUpdaterListener) => void;
  setFeedURL    ?: (options: GenericFeedUrlOptions) => void;
};

/** Minimal compatible shape for update logger */
export type UpdateLoggerLike = Partial<Readonly<{
  debug: (...data: unknown[]) => void;
  error: (...data: unknown[]) => void;
  info : (...data: unknown[]) => void;
  warn : (...data: unknown[]) => void;
}>>;

/** Minimal compatible shape for updater web contents */
export type UpdaterWebContentsLike = Readonly<{
  send: (channel: string, payload: unknown) => void;
}>;

/** Minimal compatible shape for updater window */
export type UpdaterWindowLike = Readonly<{
  isDestroyed: () => boolean;
  webContents: UpdaterWebContentsLike;
}>;

/** Listener signature for update state */
export type UpdateStateListener = (state: AppUpdateState) => void;

/** Represents set update state input */
export type SetUpdateStateInput = Readonly<Partial<Omit<AppUpdateState, "currentVersion">> & {
  status: AppUpdateState["status"];
}>;

/** Options for updater service */
export type UpdaterServiceOptions = Readonly<{
  app                         : AppLike;
  autoDownload                ?: boolean;
  autoInstallOnAppQuit        ?: boolean;
  autoInstallOnDownloaded     ?: boolean;
  autoUpdater                 : AutoUpdaterLike;
  channels                    ?: UpdaterChannelOptions;
  disableDifferentialDownload ?: boolean;
  disableWebInstaller         ?: boolean;
  disableWhenNotPackaged      ?: boolean;
  feedUrl                     ?: string;
  forceDevUpdateConfig        ?: boolean;
  getWindow                   ?: () => UpdaterWindowLike | null | undefined;
  installDelayMs              ?: number;
  logger                      ?: UpdateLoggerLike | null;
  requireFeedUrl              ?: boolean;
  shouldAllowPrerelease       ?: boolean | ((version: string) => boolean);
}>;

/** Represents updater service */
export type UpdaterService = Readonly<{
  check   : () => Promise<AppUpdateState>;
  dispose : () => void;
  getState: () => AppUpdateState;
  install : () => Promise<AppUpdateState>;
  onState : (listener: UpdateStateListener) => () => void;
  setup   : () => AppUpdateState;
  start   : () => Promise<AppUpdateState>;
}>;

/** Minimal compatible shape for updater ipc main */
export type UpdaterIpcMainLike = {
  handle: (
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => unknown
  ) => void;
  removeHandler?: (channel: string) => void;
};

/** Options for updater main bridge */
export type UpdaterMainBridgeOptions = Readonly<{
  channels             ?: UpdaterChannelOptions;
  ipcMain               : UpdaterIpcMainLike;
  removeExistingHandlers?: boolean;
  service               : UpdaterService;
}>;

/** Minimal compatible shape for updater ipc renderer */
export type UpdaterIpcRendererLike = {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void
  ) => void;
  off?: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void
  ) => void;
  removeListener?: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void
  ) => void;
};

/** Minimal compatible shape for updater context bridge */
export type UpdaterContextBridgeLike = Readonly<{
  exposeInMainWorld: (apiKey: string, api: unknown) => void;
}>;

/** Bridge API for updater */
export type UpdaterBridge = Readonly<{
  check   : () => Promise<AppUpdateState>;
  getState: () => Promise<AppUpdateState>;
  install : () => Promise<AppUpdateState>;
  onState : (listener: UpdateStateListener) => () => void;
  start   : () => Promise<AppUpdateState>;
}>;

/** Options for updater preload bridge */
export type UpdaterPreloadBridgeOptions = Readonly<{
  apiKey       ?: string;
  channels     ?: UpdaterChannelOptions;
  contextBridge : UpdaterContextBridgeLike;
  ipcRenderer   : UpdaterIpcRendererLike;
}>;

/** Represents publish provider name */
export type PublishProviderName = "generic" | "github" | "s3";

/** Configuration shape for generic publish */
export type GenericPublishConfig = Readonly<{
  channel          ?: string;
  provider          : "generic";
  publishAutoUpdate?: boolean;
  url               : string;
}>;

/** Configuration shape for s3 publish */
export type S3PublishConfig = Readonly<{
  acl              ?: string | null;
  bucket            : string;
  channel          ?: string;
  path             ?: string;
  provider          : "s3";
  publishAutoUpdate?: boolean;
  region            : string;
}>;

/** Configuration shape for github publish */
export type GithubPublishConfig = Readonly<{
  channel          ?: string;
  host             ?: string;
  owner            ?: string;
  private          ?: boolean;
  protocol         ?: "https" | "http";
  provider          : "github";
  publishAutoUpdate?: boolean;
  releaseType      ?: "draft" | "prerelease" | "release";
  repo             ?: string;
}>;

/** Configuration shape for publish */
export type PublishConfig = GenericPublishConfig | GithubPublishConfig | S3PublishConfig;
