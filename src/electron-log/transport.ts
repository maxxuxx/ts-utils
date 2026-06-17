import type {
  LogLevelOption,
  LogTransport,
  TransportOptions
} from "./types.js";

// Transport helpers
/** Resolves transport level */
export const resolveTransportLevel = (
  baseLevel: LogLevelOption,
  options?: TransportOptions
): LogLevelOption => {
  // 전역 비활성화(baseLevel === false)는 transport 옵션으로 덮어쓸 수 없음
  if (options?.enabled === false || baseLevel === false) {
    return false;
  }

  return options?.level ?? baseLevel;
};

/** Configures transport */
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
