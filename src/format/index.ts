import { toDateString, toNumber } from "../normalize/index.js";

/** Options for number format */
export type NumberFormatOptions = Intl.NumberFormatOptions & Readonly<{
  fallback?: string;
  locale?: string | string[];
}>;

/** Options for currency format */
export type CurrencyFormatOptions = Omit<Intl.NumberFormatOptions, "currency" | "style"> & Readonly<{
  fallback?: string;
  locale?: string | string[];
  separator?: string;
  unit?: string;
}>;

/** Options for phone number format */
export type PhoneNumberFormatOptions = Readonly<{
  fallback?: string;
}>;

/** Options for value unit format */
export type ValueUnitFormatOptions = NumberFormatOptions & Readonly<{
  separator?: string;
}>;

// 기본 로케일/통화 단위는 한국(ko-KR, "원")에 맞춰져 있으며 options로 모두 변경 가능
const DEFAULT_LOCALE = "ko-KR";

/** Formats number */
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

/** Formats currency with a Korean default locale and unit; override locale/unit via options */
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

/** Formats date */
export const formatDate = (
  value: unknown,
  format = "yyyy-mm-dd",
  fallback = ""
): string => toDateString(value, format, fallback);

/** Formats a Korean phone number (02/0Xn/010/15XX-19XX); returns fallback for other formats */
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

/** Formats value unit */
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

/** Grouped helpers for the format module */
export const format = Object.freeze({
  currency:    formatCurrency,
  date:        formatDate,
  number:      formatNumber,
  phoneNumber: formatPhoneNumber,
  valueUnit:   formatValueUnit
});
