import { toDate, toNumber } from "../normalize/index.js";

export type NumberFormatOptions = Intl.NumberFormatOptions & Readonly<{
  fallback?: string;
  locale?: string | string[];
}>;

export type CurrencyFormatOptions = Omit<Intl.NumberFormatOptions, "currency" | "style"> & Readonly<{
  fallback?: string;
  locale?: string | string[];
  separator?: string;
  unit?: string;
}>;

export type PhoneNumberFormatOptions = Readonly<{
  fallback?: string;
}>;

export type ValueUnitFormatOptions = NumberFormatOptions & Readonly<{
  separator?: string;
}>;

const DEFAULT_LOCALE = "ko-KR";

export const formatNumber = (
  value: unknown,
  options: NumberFormatOptions = {}
): string => {
  const {
    fallback = "",
    locale = DEFAULT_LOCALE,
    ...intlOptions
  } = options;

  if (!isNumberLike(value)) {
    return fallback;
  }

  return new Intl.NumberFormat(locale, intlOptions).format(toNumber(value));
};

export const formatCurrency = (
  value: unknown,
  options: CurrencyFormatOptions = {}
): string => {
  const {
    fallback = "",
    locale = DEFAULT_LOCALE,
    separator = "",
    unit = "원",
    ...intlOptions
  } = options;

  if (!isNumberLike(value)) {
    return fallback;
  }

  return `${formatNumber(value, {
    ...intlOptions,
    locale
  })}${separator}${unit}`;
};

export const formatDate = (
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

export const formatPhoneNumber = (
  value: unknown,
  options: PhoneNumberFormatOptions = {}
): string => {
  const {
    fallback = ""
  } = options;
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length === 8 && /^1[5-9]/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  if (digits.startsWith("02")) {
    if (digits.length === 9) {
      return `02-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }

    if (digits.length === 10) {
      return `02-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return fallback;
};

export const formatValueUnit = (
  value: unknown,
  unit: string,
  options: ValueUnitFormatOptions = {}
): string => {
  const {
    fallback = "",
    separator = " ",
    ...numberOptions
  } = options;

  if (!isNumberLike(value) || unit.trim().length === 0) {
    return fallback;
  }

  return `${formatNumber(value, numberOptions)}${separator}${unit}`;
};

const padDatePart = (value: number): string => String(value).padStart(2, "0");

const isNumberLike = (value: unknown): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value));
  }

  if (typeof value === "boolean") {
    return true;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime());
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }

  return Number.isFinite(Number(value));
};

export const format = Object.freeze({
  currency:    formatCurrency,
  date:        formatDate,
  number:      formatNumber,
  phoneNumber: formatPhoneNumber,
  valueUnit:   formatValueUnit
});
