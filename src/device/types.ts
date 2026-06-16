/** Supported Node platforms for device UUID lookup */
export type DevicePlatform = "darwin" | "linux" | "win32";

/** Shape for device command */
export interface DeviceCommand {
  command: string;
  args: string[];
}

/** Result returned by device command */
export interface DeviceCommandResult {
  stdout: string;
  stderr?: string;
}

/** Function used to execute a device UUID command */
export type DeviceCommandExecutor = (
  command: DeviceCommand
) => Promise<DeviceCommandResult | string>;

/** Options for node device uuid */
export interface NodeDeviceUuidOptions {
  executeCommand?: DeviceCommandExecutor;
  platform?: DevicePlatform;
}

/** Minimal compatible shape for browser document */
export interface BrowserDocumentLike {
  cookie: string;
}

/** Minimal compatible shape for browser crypto */
export interface BrowserCryptoLike {
  getRandomValues?: <TArray extends Uint8Array>(array: TArray) => TArray;
  randomUUID?: () => string;
}

/** SameSite values accepted by the device UUID cookie store */
export type CookieSameSite = "Lax" | "Strict" | "None";

/** Options for cookie device uuid store */
export interface CookieDeviceUuidStoreOptions {
  cookieName?: string;
  crypto?: BrowserCryptoLike;
  document?: BrowserDocumentLike;
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: CookieSameSite;
  secure?: boolean;
}

/** Shape for cookie device uuid store */
export interface CookieDeviceUuidStore {
  getOrCreate: () => string;
  read: () => string | undefined;
  write: (uuid: string) => void;
}

/** Options for browser device uuid */
export interface BrowserDeviceUuidOptions extends CookieDeviceUuidStoreOptions {
  store?: CookieDeviceUuidStore;
}

/** Options for device uuid */
export interface DeviceUuidOptions {
  browser?: BrowserDeviceUuidOptions;
  node?: NodeDeviceUuidOptions;
}
