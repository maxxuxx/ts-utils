import type { AppUpdateState } from "./schemas.js";

export type {
  AppUpdateReason,
  AppUpdateState,
  AppUpdateStatus
} from "./schemas.js";

export type UpdaterChannels = Readonly<{
  check       : string;
  install     : string;
  start       : string;
  stateChanged: string;
  stateGet    : string;
}>;

export type UpdaterChannelOptions = Partial<UpdaterChannels>;

export type UpdateInfoLike = Readonly<{
  releaseDate ?: string;
  releaseName ?: string | null;
  version     ?: string;
  [key: string]: unknown;
}>;

export type UpdateDownloadedInfoLike = UpdateInfoLike;

export type ProgressInfoLike = Readonly<{
  bytesPerSecond?: number;
  percent        : number;
  total          ?: number;
  transferred    ?: number;
  [key: string]  : unknown;
}>;

export type UpdateCheckResultLike = Readonly<{
  isUpdateAvailable?: boolean;
  updateInfo       ?: UpdateInfoLike;
  [key: string]    : unknown;
}>;

export type AppLike = Readonly<{
  getVersion : () => string;
  isPackaged : boolean;
}>;

export type AutoUpdaterEventName =
  | "checking-for-update"
  | "update-available"
  | "update-not-available"
  | "download-progress"
  | "update-downloaded"
  | "update-cancelled"
  | "error";

export type AutoUpdaterListener = (...args: unknown[]) => void;

export type GenericFeedUrlOptions = Readonly<{
  provider: "generic";
  url     : string;
}>;

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

export type UpdateLoggerLike = Partial<Readonly<{
  debug: (...data: unknown[]) => void;
  error: (...data: unknown[]) => void;
  info : (...data: unknown[]) => void;
  warn : (...data: unknown[]) => void;
}>>;

export type UpdaterWebContentsLike = Readonly<{
  send: (channel: string, payload: unknown) => void;
}>;

export type UpdaterWindowLike = Readonly<{
  isDestroyed: () => boolean;
  webContents: UpdaterWebContentsLike;
}>;

export type UpdateStateListener = (state: AppUpdateState) => void;

export type SetUpdateStateInput = Readonly<Partial<Omit<AppUpdateState, "currentVersion">> & {
  status: AppUpdateState["status"];
}>;

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

export type UpdaterService = Readonly<{
  check   : () => Promise<AppUpdateState>;
  dispose : () => void;
  getState: () => AppUpdateState;
  install : () => Promise<AppUpdateState>;
  onState : (listener: UpdateStateListener) => () => void;
  setup   : () => AppUpdateState;
  start   : () => Promise<AppUpdateState>;
}>;

export type UpdaterIpcMainLike = {
  handle: (
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => unknown
  ) => void;
  removeHandler?: (channel: string) => void;
};

export type UpdaterMainBridgeOptions = Readonly<{
  channels             ?: UpdaterChannelOptions;
  ipcMain               : UpdaterIpcMainLike;
  removeExistingHandlers?: boolean;
  service               : UpdaterService;
}>;

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

export type UpdaterContextBridgeLike = Readonly<{
  exposeInMainWorld: (apiKey: string, api: unknown) => void;
}>;

export type UpdaterBridge = Readonly<{
  check   : () => Promise<AppUpdateState>;
  getState: () => Promise<AppUpdateState>;
  install : () => Promise<AppUpdateState>;
  onState : (listener: UpdateStateListener) => () => void;
  start   : () => Promise<AppUpdateState>;
}>;

export type UpdaterPreloadBridgeOptions = Readonly<{
  apiKey       ?: string;
  channels     ?: UpdaterChannelOptions;
  contextBridge : UpdaterContextBridgeLike;
  ipcRenderer   : UpdaterIpcRendererLike;
}>;

export type PublishProviderName = "generic" | "github" | "s3";

export type GenericPublishConfig = Readonly<{
  channel          ?: string;
  provider          : "generic";
  publishAutoUpdate?: boolean;
  url               : string;
}>;

export type S3PublishConfig = Readonly<{
  acl              ?: string | null;
  bucket            : string;
  channel          ?: string;
  path             ?: string;
  provider          : "s3";
  publishAutoUpdate?: boolean;
  region            : string;
}>;

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

export type PublishConfig = GenericPublishConfig | GithubPublishConfig | S3PublishConfig;
