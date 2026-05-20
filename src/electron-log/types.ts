import type { LOG_LEVELS, LOG_METHODS } from "./constants.js";

export type LogLevel       = typeof LOG_LEVELS[number];
export type LogMethod      = typeof LOG_METHODS[number];
export type LogLevelOption = LogLevel | false;
export type LogTarget      = "console" | "main" | "terminal";

export type LogPayload = Readonly<{
  data     : unknown[];
  level    : LogLevel;
  createdAt: string;
  scope?   : string;
}>;

export type LoggerFunctions = Readonly<{
  error  : (...data: unknown[]) => void;
  warn   : (...data: unknown[]) => void;
  info   : (...data: unknown[]) => void;
  verbose: (...data: unknown[]) => void;
  debug  : (...data: unknown[]) => void;
  silly  : (...data: unknown[]) => void;
  log    : (...data: unknown[]) => void;
}>;

export type BridgeApi = LoggerFunctions & Readonly<{
  send: (payload: LogPayload) => void;
}>;

export type LogTransport = {
  level        ?: LogLevelOption;
  format       ?: unknown;
  useStyles    ?: boolean;
  [key: string] : unknown;
};

export type FileTransport = LogTransport & {
  fileName     ?: string;
  maxSize      ?: number;
  resolvePathFn?: (variables: LogPathVariables, message?: unknown) => string;
  setAppName   ?: (appName: string) => void;
  sync         ?: boolean;
  writeOptions ?: LogWriteOptions;
};

export type LogInstance = LoggerFunctions & {
  initialize?: (options?: InitializeOptions) => void;
  transports: {
    console      ?: LogTransport;
    file         ?: FileTransport;
    ipc          ?: LogTransport;
    [key: string] : unknown;
  };
};

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

export type LogWriteOptions = Readonly<{
  encoding?: string;
  flag    ?: string;
  mode    ?: number;
}>;

export type InitializeOptions = Readonly<{
  getSessions          ?: () => object[];
  includeFutureSessions?: boolean;
  preload              ?: string | boolean;
  spyRendererConsole   ?: boolean;
}>;

export type BaseLoggerOptions = Readonly<{
  enabled?: boolean;
  isProduction?: boolean;
  level?: LogLevelOption;
  productionLevel?: LogLevelOption;
}>;

export type TransportOptions = Readonly<{
  enabled  ?: boolean;
  format   ?: unknown;
  level    ?: LogLevelOption;
  useStyles?: boolean;
}>;

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

export type MainLoggerOptions = BaseLoggerOptions & Readonly<{
  console   ?: TransportOptions;
  file      ?: FileOptions;
  initialize?: boolean | InitializeOptions;
  ipc       ?: TransportOptions;
  logger    ?: LogInstance;
}>;

export type RendererLoggerOptions = BaseLoggerOptions & Readonly<{
  console?: TransportOptions;
  logger ?: LogInstance;
  main   ?: TransportOptions;
  targets?: LogTarget[];
}>;

export type BridgeLoggerOptions = BaseLoggerOptions & Readonly<{
  bridge ?: BridgeApi;
  console?: TransportOptions;
  main   ?: TransportOptions;
  targets?: LogTarget[];
}>;

export type MainBridgeOptions = Readonly<{
  channel?: string;
  ipcMain : ElectronIpcMainLike;
  logger  : LoggerFunctions;
}>;

export type PreloadBridgeOptions = Readonly<{
  apiKey       ?: string;
  channel      ?: string;
  contextBridge : ElectronContextBridgeLike;
  ipcRenderer   : ElectronIpcRendererLike;
}>;

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

export type ElectronIpcRendererLike = {
  send: (channel: string, payload: unknown) => void;
};

export type ElectronContextBridgeLike = {
  exposeInMainWorld: (apiKey: string, api: unknown) => void;
};
