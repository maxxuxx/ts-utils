export type PlainRecord = Record<string, unknown>;

export const isNotEmptyString = (value: unknown): value is string => (
  typeof value === "string" && value.trim().length > 0
);

export const isRecord = (value: unknown): value is PlainRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

export const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "bigint") {
    const numberValue = Number(value);

    return Number.isSafeInteger(numberValue) ? numberValue : fallback;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value instanceof Date) {
    const time = value.getTime();

    return Number.isFinite(time) ? time : fallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return fallback;
    }

    const numberValue = Number(trimmed);

    return Number.isFinite(numberValue) ? numberValue : fallback;
  }

  return fallback;
};

export const toText = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
  }

  try {
    return String(value);
  } catch {
    return fallback;
  }
};

export const toDate = (value: unknown, fallback?: Date): Date | undefined => {
  if (value instanceof Date) {
    const time = value.getTime();

    return Number.isNaN(time) ? fallback : new Date(time);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? fallback : date;
  }

  return fallback;
};

const padDatePart = (value: number): string => String(value).padStart(2, "0");

export const toDateString = (
  value: unknown,
  format = "yyyy-mm-dd",
  fallback = ""
): string => {
  const date = toDate(value);

  if (date === undefined) {
    return fallback;
  }

  const tokens: Record<string, string> = {
    HH  : padDatePart(date.getHours()),
    MM  : padDatePart(date.getMinutes()),
    dd  : padDatePart(date.getDate()),
    mm  : padDatePart(date.getMonth() + 1),
    ss  : padDatePart(date.getSeconds()),
    yyyy: String(date.getFullYear())
  };

  return format.replace(/yyyy|mm|dd|HH|MM|ss/g, (token) => tokens[token] ?? token);
};

export const toFlagBoolean = (
  value: unknown,
  trueValue: unknown = "Y",
  fallback = false
): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value !== 0 : fallback;
  }

  if (typeof value === "bigint") {
    return value !== 0n;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    const normalizedTrueValue = String(trueValue).trim().toLowerCase();

    if (normalized && normalized === normalizedTrueValue) {
      return true;
    }

    if (["1", "true", "t", "yes", "y", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "f", "no", "n", "off", ""].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

export const to = Object.freeze({
  date:        toDate,
  dateString:  toDateString,
  flagBoolean: toFlagBoolean,
  number:      toNumber,
  text:        toText
});

export const is = Object.freeze({
  notEmptyString: isNotEmptyString,
  record:         isRecord
});
