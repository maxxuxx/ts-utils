import type {
  DeviceCommand,
  DeviceCommandResult,
  DevicePlatform
} from "./types.js";

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const MACHINE_ID_PATTERN = /\b[0-9a-f]{32}\b/i;

const invalidUuidValues = new Set([
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff"
]);

/** Error raised for device uuid parse failures */
export class DeviceUuidParseError extends Error {
  readonly command: DeviceCommand;
  readonly stderr: string | undefined;
  readonly stdout: string;

  constructor(command: DeviceCommand, result: DeviceCommandResult | string) {
    const output = normalizeCommandResult(result);
    const summary = summarizeCommandOutput(output);
    const commandText = [command.command, ...command.args].join(" ");

    super(`Unable to parse device UUID from command: ${commandText}${summary ? `, output: ${summary}` : ""}`);

    this.name    = "DeviceUuidParseError";
    this.command = command;
    this.stderr  = output.stderr;
    this.stdout  = output.stdout;
  }
}

/** Normalizes device uuid */
export const normalizeDeviceUuid = (value: string): string | undefined => {
  const trimmed = value.trim();
  const uuidMatch = UUID_PATTERN.exec(trimmed);

  if (uuidMatch) {
    const uuid = uuidMatch[0].toLowerCase();
    return invalidUuidValues.has(uuid) ? undefined : uuid;
  }

  const machineIdMatch = MACHINE_ID_PATTERN.exec(trimmed);

  if (!machineIdMatch) {
    return undefined;
  }

  const machineId = machineIdMatch[0].toLowerCase();
  const uuid = [
    machineId.slice(0, 8),
    machineId.slice(8, 12),
    machineId.slice(12, 16),
    machineId.slice(16, 20),
    machineId.slice(20)
  ].join("-");

  return invalidUuidValues.has(uuid) ? undefined : uuid;
};

/** Parses node device uuid output */
export const parseNodeDeviceUuidOutput = (
  output: DeviceCommandResult | string
): string | undefined => {
  const text = typeof output === "string"
    ? output
    : `${output.stdout}\n${output.stderr ?? ""}`;

  return normalizeDeviceUuid(text);
};

const normalizeCommandResult = (
  result: DeviceCommandResult | string
): DeviceCommandResult => (
  typeof result === "string"
    ? { stdout: result }
    : result
);

const summarizeCommandOutput = (
  result: DeviceCommandResult
): string => {
  const summary = [
    result.stdout,
    result.stderr
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n")
    .trim()
    .replace(/\s+/g, " ");

  return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
};

/** Returns node device uuid commands */
export const getNodeDeviceUuidCommands = (
  platform: DevicePlatform
): DeviceCommand[] => {
  if (platform === "darwin") {
    return [
      {
        args: [
          "-rd1",
          "-c",
          "IOPlatformExpertDevice"
        ],
        command: "ioreg"
      }
    ];
  }

  if (platform === "linux") {
    return [
      {
        args: [
          "/etc/machine-id"
        ],
        command: "cat"
      },
      {
        args: [
          "/var/lib/dbus/machine-id"
        ],
        command: "cat"
      }
    ];
  }

  return [
    {
      args: [
        "csproduct",
        "get",
        "UUID"
      ],
      command: "wmic"
    },
    {
      args: [
        "-NoProfile",
        "-Command",
        "(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID"
      ],
      command: "powershell.exe"
    }
  ];
};
