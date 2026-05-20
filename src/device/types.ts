export type DevicePlatform = "darwin" | "linux" | "win32";

export interface DeviceCommand {
  command: string;
  args: string[];
}

export interface DeviceCommandResult {
  stdout: string;
  stderr?: string;
}

export type DeviceCommandExecutor = (
  command: DeviceCommand
) => Promise<DeviceCommandResult | string>;

export interface NodeDeviceUuidOptions {
  executeCommand?: DeviceCommandExecutor;
  platform?: DevicePlatform;
}

export interface BrowserDocumentLike {
  cookie: string;
}

export interface BrowserCryptoLike {
  getRandomValues?: <TArray extends Uint8Array>(array: TArray) => TArray;
  randomUUID?: () => string;
}

export type CookieSameSite = "Lax" | "Strict" | "None";

export interface CookieDeviceUuidStoreOptions {
  cookieName?: string;
  crypto?: BrowserCryptoLike;
  document?: BrowserDocumentLike;
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: CookieSameSite;
  secure?: boolean;
}

export interface CookieDeviceUuidStore {
  getOrCreate: () => string;
  read: () => string | undefined;
  write: (uuid: string) => void;
}

export interface BrowserDeviceUuidOptions extends CookieDeviceUuidStoreOptions {
  store?: CookieDeviceUuidStore;
}

export interface DeviceUuidOptions {
  browser?: BrowserDeviceUuidOptions;
  node?: NodeDeviceUuidOptions;
}
