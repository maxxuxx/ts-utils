import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  DeviceUuidParseError,
  getNodeDeviceUuidCommands,
  parseNodeDeviceUuidOutput
} from "./node-shared.js";
import type {
  DeviceCommandExecutor,
  DevicePlatform,
  NodeDeviceUuidOptions
} from "./types.js";

const execFileAsync = promisify(execFile);

export {
  DeviceUuidParseError,
  getNodeDeviceUuidCommands,
  normalizeDeviceUuid,
  parseNodeDeviceUuidOutput
} from "./node-shared.js";

/** Executes a platform command used to read a Node device UUID */
export const defaultExecuteDeviceCommand: DeviceCommandExecutor = async ({
  args,
  command
}) => {
  const { stdout, stderr } = await execFileAsync(command, args, {
    encoding: "utf8",
    windowsHide: true
  });

  return {
    stderr,
    stdout
  };
};

const getCurrentPlatform = (): DevicePlatform | undefined => {
  const platform = process.platform;

  if (platform === "darwin" || platform === "linux" || platform === "win32") {
    return platform;
  }

  return undefined;
};

/** Reads a stable device UUID from the current or provided Node platform */
export const getNodeDeviceUuid = async (
  options: NodeDeviceUuidOptions = {}
): Promise<string> => {
  const platform = options.platform ?? getCurrentPlatform();

  if (!platform) {
    throw new Error(`Unsupported device UUID platform: ${process.platform}`);
  }

  const executeCommand = options.executeCommand ?? defaultExecuteDeviceCommand;
  const errors: unknown[] = [];

  for (const command of getNodeDeviceUuidCommands(platform)) {
    try {
      const result = await executeCommand(command);
      const uuid = parseNodeDeviceUuidOutput(result);

      if (uuid) {
        return uuid;
      }

      errors.push(new DeviceUuidParseError(command, result));
    } catch (error) {
      errors.push(error);
    }
  }

  throw new AggregateError(
    errors,
    `Unable to read device UUID for platform: ${platform}`
  );
};
