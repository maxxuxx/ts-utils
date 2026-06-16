import type { LOG_LEVELS, LOG_METHODS } from "./constants.js";

/** Represents log level */
export type LogLevel       = typeof LOG_LEVELS[number];

/** Log method name accepted by logger bridge helpers */
export type LogMethod      = typeof LOG_METHODS[number];

/** Represents log level option */
export type LogLevelOption = LogLevel | false;

/** Represents log target */
export type LogTarget      = "console" | "main" | "terminal";

/** Payload shape for log */
export type LogPayload = Readonly<{
  data     : unknown[];
  level    : LogLevel;
  createdAt: string;
  scope?   : string;
}>;

/** Represents logger functions */
export type LoggerFunctions = Readonly<{
  error  : (...data: unknown[]) => void;
  warn   : (...data: unknown[]) => void;
  info   : (...data: unknown[]) => void;
  verbose: (...data: unknown[]) => void;
  debug  : (...data: unknown[]) => void;
  silly  : (...data: unknown[]) => void;
  log    : (...data: unknown[]) => void;
}>;

/** Renderer bridge API used to send log payloads */
export type BridgeApi = LoggerFunctions & Readonly<{
  send: (payload: LogPayload) => void;
}>;

/** Minimal electron-log transport shape used for configuration */
export type LogTransport = {
  level        ?: LogLevelOption;
  format       ?: unknown;
  useStyles    ?: boolean;
  [key: string] : unknown;
};

/** File transport shape used by main logger configuration */
export type FileTransport = LogTransport & {
  fileName     ?: string;
  maxSize      ?: number;
  resolvePathFn?: (variables: LogPathVariables, message?: unknown) => string;
  setAppName   ?: (appName: string) => void;
  sync         ?: boolean;
  writeOptions ?: LogWriteOptions;
};

/** Minimal logger instance used by electron-log helpers */
export type LogInstance = LoggerFunctions & {
  initialize?: (options?: InitializeOptions) => void;
  transports: {
    console      ?: LogTransport;
    file         ?: FileTransport;
    ipc          ?: LogTransport;
    [key: string] : unknown;
  };
};

/** Represents log path variables */
export type LogPathVariables = Readonly<{
  appData           ?: string;
  appName           ?: string;
  appVersion        ?: string;
  electronDefaultDir?: string;
  fileName          ?: string;
  home              ?: string;
  libraryDefaultDir ?: string;
  libraryTemplate   ?: string;
  tempDir           ?: string;
  userData          ?: string;
}>;

/** Options for log write */
export type LogWriteOptions = Readonly<{
  encoding?: string;
  flag    ?: string;
  mode    ?: number;
}>;

/** Options for initialize */
export type InitializeOptions = Readonly<{
  getSessions          ?: () => object[];
  includeFutureSessions?: boolean;
  preload              ?: string | boolean;
  spyRendererConsole   ?: boolean;
}>;

/** Options for base logger */
export type BaseLoggerOptions = Readonly<{
  enabled?: boolean;
  isProduction?: boolean;
  level?: LogLevelOption;
  productionLevel?: LogLevelOption;
}>;

/** Options for transport */
export type TransportOptions = Readonly<{
  enabled  ?: boolean;
  format   ?: unknown;
  level    ?: LogLevelOption;
  useStyles?: boolean;
}>;

/** Options for file */
export type FileOptions = TransportOptions & Readonly<{
  appName     ?: string;
  dir         ?: string;
  fileName    ?: string;
  maxSize     ?: number;
  path        ?: string;
  resolvePath ?: (variables: LogPathVariables, message?: unknown) => string;
  sync        ?: boolean;
  writeOptions?: LogWriteOptions;
}>;

/** Options for main logger */
export type MainLoggerOptions = BaseLoggerOptions & Readonly<{
  console   ?: TransportOptions;
  file      ?: FileOptions;
  initialize?: boolean | InitializeOptions;
  ipc       ?: TransportOptions;
  logger    ?: LogInstance;
}>;

/** Options for renderer logger */
export type RendererLoggerOptions = BaseLoggerOptions & Readonly<{
  console?: TransportOptions;
  logger ?: LogInstance;
  main   ?: TransportOptions;
  targets?: LogTarget[];
}>;

/** Options for bridge logger */
export type BridgeLoggerOptions = BaseLoggerOptions & Readonly<{
  bridge ?: BridgeApi;
  console?: TransportOptions;
  main   ?: TransportOptions;
  targets?: LogTarget[];
}>;

/** Options for main bridge */
export type MainBridgeOptions = Readonly<{
  channel?: string;
  ipcMain : ElectronIpcMainLike;
  logger  : LoggerFunctions;
}>;

/** Options for preload bridge */
export type PreloadBridgeOptions = Readonly<{
  apiKey       ?: string;
  channel      ?: string;
  contextBridge : ElectronContextBridgeLike;
  ipcRenderer   : ElectronIpcRendererLike;
}>;

/** Minimal compatible shape for electron ipc main */
export type ElectronIpcMainLike = {
  on: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void
  ) => void;
  removeListener?: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void
  ) => void;
};

/** Minimal compatible shape for electron ipc renderer */
export type ElectronIpcRendererLike = {
  send: (channel: string, payload: unknown) => void;
};

/** Minimal compatible shape for electron context bridge */
export type ElectronContextBridgeLike = {
  exposeInMainWorld: (apiKey: string, api: unknown) => void;
};
