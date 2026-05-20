export {
  createBrowserDeviceUuid,
  createCookieDeviceUuidStore,
  getBrowserDeviceUuid
} from "./browser.js";
export {
  defaultExecuteDeviceCommand,
  getNodeDeviceUuid,
  getNodeDeviceUuidCommands,
  normalizeDeviceUuid,
  parseNodeDeviceUuidOutput
} from "./node.js";
export type {
  BrowserCryptoLike,
  BrowserDeviceUuidOptions,
  BrowserDocumentLike,
  CookieDeviceUuidStore,
  CookieDeviceUuidStoreOptions,
  CookieSameSite,
  DeviceCommand,
  DeviceCommandExecutor,
  DeviceCommandResult,
  DevicePlatform,
  DeviceUuidOptions,
  NodeDeviceUuidOptions
} from "./types.js";

import { getBrowserDeviceUuid } from "./browser.js";
import { getNodeDeviceUuid } from "./node.js";
import type { DeviceUuidOptions } from "./types.js";

const isBrowserLike = (): boolean => {
  const root = globalThis as typeof globalThis & {
    document?: unknown;
  };

  return typeof root.document === "object" && root.document !== null;
};

const isNodeLike = (): boolean => {
  const root = globalThis as typeof globalThis & {
    process?: {
      versions?: {
        node?: unknown;
      };
    };
  };

  return typeof root.process?.versions?.node === "string";
};

export const getDeviceUuid = async (
  options: DeviceUuidOptions = {}
): Promise<string> => {
  if (isBrowserLike()) {
    return getBrowserDeviceUuid(options.browser);
  }

  if (isNodeLike()) {
    return getNodeDeviceUuid(options.node);
  }

  throw new Error("Unable to detect a supported device UUID environment");
};
