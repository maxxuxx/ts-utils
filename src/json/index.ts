import { err, ok, type Result } from "../result/index.js";

/** Represents json primitive */
export type JsonPrimitive = string | number | boolean | null;

/** Represents json object */
export type JsonObject = {
  [key: string]: JsonValue;
};

/** Represents json array */
export type JsonArray = JsonValue[];

/** Represents json value */
export type JsonValue =
  | JsonArray
  | JsonObject
  | JsonPrimitive;

/** Result returned by json */
export type JsonResult<TData, TError = unknown> = Result<TData, TError>;

/** Schema contract for json */
export type JsonSchema<TValue> = {
  parse: (value: unknown) => TValue;
};

/** Options for json parse */
export type JsonParseOptions<TFallback = never> = {
  fallback?: TFallback;
};

/** Options for json stringify */
export type JsonStringifyOptions<TFallback = never> = {
  fallback?: TFallback;
  replacer?: (this: unknown, key: string, value: unknown) => unknown;
  space?: number | string;
};

/** Options for json parse with schema */
export type JsonParseWithSchemaOptions<TFallback = never> =
  JsonParseOptions<TFallback>;

/** Error raised for json parse failures */
export class JsonParseError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown, message = "Invalid JSON text") {
    super(message);

    this.name = "JsonParseError";
    this.cause = cause;
  }
}

/** Error raised for json stringify failures */
export class JsonStringifyError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown, message = "Value could not be stringified as JSON") {
    super(message);

    this.name = "JsonStringifyError";
    this.cause = cause;
  }
}

const hasOwnFallback = <TFallback>(
  options: JsonParseOptions<TFallback> | JsonStringifyOptions<TFallback>
): options is { fallback: TFallback } => (
  Object.prototype.hasOwnProperty.call(options, "fallback")
);

const createTextError = (value: unknown): TypeError => (
  new TypeError(`JSON text must be a string, received ${typeof value}`)
);

const readJsonText = (text: string | null | undefined): string => {
  if (typeof text !== "string") {
    throw createTextError(text);
  }

  return text;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

const isJsonValueInternal = (
  value: unknown,
  seen: WeakSet<object>
): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return false;
    }

    seen.add(value);

    return value.every((item) => isJsonValueInternal(item, seen));
  }

  if (!isPlainRecord(value)) {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);

  return Object.values(value).every((item) => isJsonValueInternal(item, seen));
};

/** Checks whether a value is json value */
export const isJsonValue = (value: unknown): value is JsonValue => (
  isJsonValueInternal(value, new WeakSet())
);

/** Safely parses json */
export const safeParseJson = <TValue = unknown>(
  text: string | null | undefined
): JsonResult<TValue, JsonParseError> => {
  try {
    return ok(JSON.parse(readJsonText(text)) as TValue);
  } catch (error) {
    return err(new JsonParseError(error));
  }
};

/** Parses json */
export const parseJson = <TValue = unknown, TFallback = never>(
  text: string | null | undefined,
  options: JsonParseOptions<TFallback> = {}
): TValue | TFallback => {
  const result = safeParseJson<TValue>(text);

  if (result.ok) {
    return result.data;
  }

  if (hasOwnFallback(options)) {
    return options.fallback;
  }

  throw result.error;
};

/** Provides the safe stringify json helper */
export const safeStringifyJson = (
  value: unknown,
  options: Omit<JsonStringifyOptions, "fallback"> = {}
): JsonResult<string, JsonStringifyError> => {
  try {
    const text = JSON.stringify(value, options.replacer, options.space);

    if (typeof text !== "string") {
      return err(new JsonStringifyError(
        new TypeError("JSON.stringify returned undefined")
      ));
    }

    return ok(text);
  } catch (error) {
    return err(new JsonStringifyError(error));
  }
};

/** Provides the stringify json helper */
export const stringifyJson = <TFallback = never>(
  value: unknown,
  options: JsonStringifyOptions<TFallback> = {}
): string | TFallback => {
  const result = safeStringifyJson(value, options);

  if (result.ok) {
    return result.data;
  }

  if (hasOwnFallback(options)) {
    return options.fallback;
  }

  throw result.error;
};

/** Safely parses json with schema */
export const safeParseJsonWithSchema = <TValue>(
  text: string | null | undefined,
  schema: JsonSchema<TValue>
): JsonResult<TValue, unknown> => {
  const result = safeParseJson(text);

  if (!result.ok) {
    return result;
  }

  try {
    return ok(schema.parse(result.data));
  } catch (error) {
    return err(error);
  }
};

/** Parses json with schema */
export const parseJsonWithSchema = <TValue, TFallback = never>(
  text: string | null | undefined,
  schema: JsonSchema<TValue>,
  options: JsonParseWithSchemaOptions<TFallback> = {}
): TValue | TFallback => {
  const result = safeParseJsonWithSchema(text, schema);

  if (result.ok) {
    return result.data;
  }

  if (hasOwnFallback(options)) {
    return options.fallback;
  }

  throw result.error;
};

/** Grouped helpers for the json module */
export const json = Object.freeze({
  isValue: isJsonValue,
  parse: parseJson,
  parseWithSchema: parseJsonWithSchema,
  safeParse: safeParseJson,
  safeParseWithSchema: safeParseJsonWithSchema,
  safeStringify: safeStringifyJson,
  stringify: stringifyJson
});
