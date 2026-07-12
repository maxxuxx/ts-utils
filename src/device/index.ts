export {
  createBrowserDeviceUuid,
  createCookieDeviceUuidStore,
  getBrowserDeviceUuid
} from "./browser.js";
export {
  DeviceUuidParseError,
  getNodeDeviceUuidCommands,
  normalizeDeviceUuid,
  parseNodeDeviceUuidOutput
} from "./node-shared.js";
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
import type {
  DeviceCommandExecutor,
  DeviceUuidOptions,
  NodeDeviceUuidOptions
} from "./types.js";

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

const loadNodeDeviceModule = async () => import("./node.js");

/** Executes a platform command used to read a Node device UUID */
export const defaultExecuteDeviceCommand: DeviceCommandExecutor = async (
  command
) => {
  const nodeDevice = await loadNodeDeviceModule();

  return nodeDevice.defaultExecuteDeviceCommand(command);
};

/** Reads a stable device UUID from the current or provided Node platform */
export const getNodeDeviceUuid = async (
  options: NodeDeviceUuidOptions = {}
): Promise<string> => {
  const nodeDevice = await loadNodeDeviceModule();

  return nodeDevice.getNodeDeviceUuid(options);
};

/** Chooses the browser or Node device UUID strategy for the current runtime */
export const getDeviceUuid = async (
  options: DeviceUuidOptions = {}
): Promise<string> => {
  if (isBrowserLike()) {
    return getBrowserDeviceUuid(options.browser);
  }

  if (isNodeLike()) {
    const nodeDevice = await loadNodeDeviceModule();

    return nodeDevice.getNodeDeviceUuid(options.node);
  }

  throw new Error("Unable to detect a supported device UUID environment");
};
