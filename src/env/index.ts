import { z } from "zod";

export { z } from "zod";

export type EnvSource = Readonly<Record<string, unknown>>;

export type EnvGetOptions = Readonly<{
  fallback?: string;
  source  ?: EnvSource;
}>;

export type EnvRequireOptions = Readonly<{
  allowEmpty?: boolean;
  source    ?: EnvSource;
}>;

export type EnvNumberOptions = Readonly<{
  fallback?: number;
  source  ?: EnvSource;
}>;

export type EnvBooleanOptions = Readonly<{
  fallback?: boolean;
  source  ?: EnvSource;
}>;

export type EnvStringSchemaOptions = Readonly<{
  allowEmpty?: boolean;
  trim      ?: boolean;
}>;

type GlobalWithProcessEnv = typeof globalThis & {
  process?: {
    env?: Record<string, unknown>;
  };
};

export class EnvMissingError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(`Missing required environment variable: ${key}`);

    this.name = "EnvMissingError";
    this.key = key;
  }
}

export const getDefaultEnvSource = (): EnvSource => {
  const envSource = (globalThis as GlobalWithProcessEnv).process?.env;

  return envSource ?? {};
};

export const normalizeEnvSource = (source: EnvSource = getDefaultEnvSource()): Record<string, unknown> => {
  const entries = Object.entries(source).filter(([, value]) => value !== undefined);

  return Object.fromEntries(entries);
};

const toEnvText = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number"
    || typeof value === "boolean"
    || typeof value === "bigint"
  ) {
    return String(value);
  }

  return undefined;
};

const readEnvValue = (key: string, source?: EnvSource): string | undefined => {
  const envSource = source ?? getDefaultEnvSource();

  return toEnvText(envSource[key]);
};

const parseBooleanValue = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value !== 0 : undefined;
  }

  if (typeof value === "bigint") {
    return value !== 0n;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "t", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "f", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
};

const parseNumberValue = (value: unknown): number | undefined => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "bigint") {
    const numberValue = Number(value);

    return Number.isSafeInteger(numberValue) ? numberValue : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const numberValue = Number(trimmed);

  return Number.isFinite(numberValue) ? numberValue : undefined;
};

export function getEnv(key: string, options: EnvGetOptions & { fallback: string }): string;
export function getEnv(key: string, options?: EnvGetOptions): string | undefined;
export function getEnv(key: string, options: EnvGetOptions = {}): string | undefined {
  const value = readEnvValue(key, options.source);

  return value ?? options.fallback;
}

export const requireEnv = (key: string, options: EnvRequireOptions = {}): string => {
  const value = readEnvValue(key, options.source);

  if (value === undefined || (!options.allowEmpty && value.trim().length === 0)) {
    throw new EnvMissingError(key);
  }

  return value;
};

export function getEnvNumber(key: string, options: EnvNumberOptions & { fallback: number }): number;
export function getEnvNumber(key: string, options?: EnvNumberOptions): number | undefined;
export function getEnvNumber(key: string, options: EnvNumberOptions = {}): number | undefined {
  const numberValue = parseNumberValue(readEnvValue(key, options.source));

  return numberValue ?? options.fallback;
}

export function getEnvBoolean(key: string, options: EnvBooleanOptions & { fallback: boolean }): boolean;
export function getEnvBoolean(key: string, options?: EnvBooleanOptions): boolean | undefined;
export function getEnvBoolean(key: string, options: EnvBooleanOptions = {}): boolean | undefined {
  const booleanValue = parseBooleanValue(readEnvValue(key, options.source));

  return booleanValue ?? options.fallback;
}

export const parseEnv = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  source?: EnvSource
): z.output<TSchema> => schema.parse(normalizeEnvSource(source));

export const safeParseEnv = <TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  source?: EnvSource
): z.ZodSafeParseResult<z.output<TSchema>> => schema.safeParse(normalizeEnvSource(source));

export const envString = (options: EnvStringSchemaOptions = {}) => z.preprocess((value) => {
  const text = toEnvText(value);

  if (text === undefined) {
    return undefined;
  }

  return options.trim === false ? text : text.trim();
}, options.allowEmpty ? z.string() : z.string().min(1));

export const envNumber = () => z.preprocess((value) => (
  parseNumberValue(value) ?? value
), z.number());

export const envBoolean = () => z.preprocess((value) => (
  parseBooleanValue(value) ?? value
), z.boolean());

export const envJson = <TSchema extends z.ZodTypeAny>(schema: TSchema) => z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}, schema);

export const envSchema = Object.freeze({
  boolean: envBoolean,
  json   : envJson,
  number : envNumber,
  string : envString
});

export const env = Object.freeze({
  boolean           : getEnvBoolean,
  get               : getEnv,
  getBoolean        : getEnvBoolean,
  getDefaultSource  : getDefaultEnvSource,
  getNumber         : getEnvNumber,
  normalizeSource   : normalizeEnvSource,
  number            : getEnvNumber,
  parse             : parseEnv,
  require           : requireEnv,
  safeParse         : safeParseEnv,
  schema            : envSchema
});
