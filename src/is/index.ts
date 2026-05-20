export type AnyFunction = (...args: unknown[]) => unknown;
export type Primitive = string | number | boolean | bigint | symbol | null | undefined;
export type PlainObject = Record<PropertyKey, unknown>;

// Primitive guards
export const isString = (value: unknown): value is string => (
  typeof value === "string"
);

export const isNonEmptyString = (value: unknown): value is string => (
  isString(value) && value.trim().length > 0
);

export const isNumber = (value: unknown): value is number => (
  typeof value === "number" && !Number.isNaN(value)
);

export const isFiniteNumber = (value: unknown): value is number => (
  isNumber(value) && Number.isFinite(value)
);

export const isInteger = (value: unknown): value is number => (
  isNumber(value) && Number.isInteger(value)
);

export const isSafeInteger = (value: unknown): value is number => (
  isNumber(value) && Number.isSafeInteger(value)
);

export const isBoolean = (value: unknown): value is boolean => (
  typeof value === "boolean"
);

export const isBigInt = (value: unknown): value is bigint => (
  typeof value === "bigint"
);

export const isSymbol = (value: unknown): value is symbol => (
  typeof value === "symbol"
);

export const isUndefined = (value: unknown): value is undefined => (
  value === undefined
);

export const isNull = (value: unknown): value is null => (
  value === null
);

export const isNil = (value: unknown): value is null | undefined => (
  value === null || value === undefined
);

export const isDefined = <TValue>(value: TValue): value is NonNullable<TValue> => (
  !isNil(value)
);

export const isPrimitive = (value: unknown): value is Primitive => (
  isNil(value)
  || isString(value)
  || isNumber(value)
  || isBoolean(value)
  || isBigInt(value)
  || isSymbol(value)
);

// Object guards
export const isObject = (value: unknown): value is object => (
  typeof value === "object" && value !== null
);

export const isPlainObject = (value: unknown): value is PlainObject => {
  if (!isObject(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  isPlainObject(value)
);

export const hasOwn = <TKey extends PropertyKey>(
  value: unknown,
  key: TKey
): value is Record<TKey, unknown> => (
  isObject(value) && Object.hasOwn(value, key)
);

export const isFunction = <TFunction extends AnyFunction = AnyFunction>(
  value: unknown
): value is TFunction => (
  typeof value === "function"
);

export const isPromiseLike = <TValue = unknown>(
  value: unknown
): value is PromiseLike<TValue> => (
  isObject(value) && isFunction((value as { then?: unknown }).then)
);

// Collection guards
export const isArray = <TValue = unknown>(value: unknown): value is TValue[] => (
  Array.isArray(value)
);

export const isNonEmptyArray = <TValue = unknown>(
  value: unknown
): value is [TValue, ...TValue[]] => (
  isArray<TValue>(value) && value.length > 0
);

export const isMap = <TKey = unknown, TValue = unknown>(
  value: unknown
): value is Map<TKey, TValue> => (
  value instanceof Map
);

export const isSet = <TValue = unknown>(value: unknown): value is Set<TValue> => (
  value instanceof Set
);

export const isWeakMap = <TKey extends object = object, TValue = unknown>(
  value: unknown
): value is WeakMap<TKey, TValue> => (
  value instanceof WeakMap
);

export const isWeakSet = <TValue extends object = object>(
  value: unknown
): value is WeakSet<TValue> => (
  value instanceof WeakSet
);

// Built-in instance guards
export const isDate = (value: unknown): value is Date => (
  value instanceof Date
);

export const isValidDate = (value: unknown): value is Date => (
  isDate(value) && !Number.isNaN(value.getTime())
);

export const isRegExp = (value: unknown): value is RegExp => (
  value instanceof RegExp
);

export const isError = (value: unknown): value is Error => (
  value instanceof Error
);

export const isURL = (value: unknown): value is URL => (
  value instanceof URL
);

// Common value guards
export const isEmpty = (value: unknown): boolean => {
  if (isNil(value)) {
    return true;
  }

  if (isString(value) || isArray(value)) {
    return value.length === 0;
  }

  if (isMap(value) || isSet(value)) {
    return value.size === 0;
  }

  if (isPlainObject(value)) {
    return Object.keys(value).length === 0;
  }

  return false;
};

export const isTruthy = <TValue>(value: TValue): value is Exclude<TValue, false | 0 | "" | null | undefined> => (
  Boolean(value)
);

export const isFalsy = (value: unknown): value is false | 0 | "" | null | undefined => (
  !value
);

// Namespace export
export const is = Object.freeze({
  array:          isArray,
  bigInt:         isBigInt,
  boolean:        isBoolean,
  date:           isDate,
  defined:        isDefined,
  empty:          isEmpty,
  error:          isError,
  falsy:          isFalsy,
  finiteNumber:   isFiniteNumber,
  function:       isFunction,
  hasOwn:         hasOwn,
  integer:        isInteger,
  map:            isMap,
  nil:            isNil,
  nonEmptyArray:  isNonEmptyArray,
  nonEmptyString: isNonEmptyString,
  null:           isNull,
  number:         isNumber,
  object:         isObject,
  plainObject:    isPlainObject,
  primitive:      isPrimitive,
  promiseLike:    isPromiseLike,
  record:         isRecord,
  regExp:         isRegExp,
  safeInteger:    isSafeInteger,
  set:            isSet,
  string:         isString,
  symbol:         isSymbol,
  truthy:         isTruthy,
  undefined:      isUndefined,
  url:            isURL,
  validDate:      isValidDate,
  weakMap:        isWeakMap,
  weakSet:        isWeakSet
});
