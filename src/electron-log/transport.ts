import type {
  LogLevelOption,
  LogTransport,
  TransportOptions
} from "./types.js";

// Transport helpers
export const resolveTransportLevel = (
  baseLevel: LogLevelOption,
  options?: TransportOptions
): LogLevelOption => {
  if (options?.enabled === false) {
    return false;
  }

  return options?.level ?? baseLevel;
};

export const configureTransport = (
  transport: LogTransport | undefined,
  baseLevel: LogLevelOption,
  options?: TransportOptions
): void => {
  if (!transport) {
    return;
  }

  transport.level = resolveTransportLevel(baseLevel, options);

  if (options?.format !== undefined) {
    transport.format = options.format;
  }

  if (options?.useStyles !== undefined) {
    transport.useStyles = options.useStyles;
  }
};
