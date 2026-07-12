/** Function shape accepted by type guard helpers */
export type AnyFunction = (...args: unknown[]) => unknown;

/** JavaScript primitive value union */
export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

/** Object record with arbitrary property keys */
export type PlainObject = Record<PropertyKey, unknown>;

// Primitive guards
/** Checks whether a value is string */
export const isString = (value: unknown): value is string => (
  typeof value === "string"
);

/** Checks whether a value is non empty string */
export const isNonEmptyString = (value: unknown): value is string => (
  isString(value) && value.trim().length > 0
);

/** Checks whether a value is number */
export const isNumber = (value: unknown): value is number => (
  typeof value === "number" && !Number.isNaN(value)
);

/** Checks whether a value is finite number */
export const isFiniteNumber = (value: unknown): value is number => (
  isNumber(value) && Number.isFinite(value)
);

/** Checks whether a value is integer */
export const isInteger = (value: unknown): value is number => (
  isNumber(value) && Number.isInteger(value)
);

/** Checks whether a value is safe integer */
export const isSafeInteger = (value: unknown): value is number => (
  isNumber(value) && Number.isSafeInteger(value)
);

/** Checks whether a value is boolean */
export const isBoolean = (value: unknown): value is boolean => (
  typeof value === "boolean"
);

/** Checks whether a value is big int */
export const isBigInt = (value: unknown): value is bigint => (
  typeof value === "bigint"
);

/** Checks whether a value is symbol */
export const isSymbol = (value: unknown): value is symbol => (
  typeof value === "symbol"
);

/** Checks whether a value is undefined */
export const isUndefined = (value: unknown): value is undefined => (
  value === undefined
);

/** Checks whether a value is null */
export const isNull = (value: unknown): value is null => (
  value === null
);

/** Checks whether a value is nil */
export const isNil = (value: unknown): value is null | undefined => (
  value === null || value === undefined
);

/** Checks whether a value is defined */
export const isDefined = <TValue>(value: TValue): value is NonNullable<TValue> => (
  !isNil(value)
);

/** Checks whether a value is a JavaScript primitive, including NaN */
export const isPrimitive = (value: unknown): value is Primitive => (
  isNil(value)
  || isString(value)
  || typeof value === "number"
  || isBoolean(value)
  || isBigInt(value)
  || isSymbol(value)
);

// Object guards
/** Checks whether a value is object */
export const isObject = (value: unknown): value is object => (
  typeof value === "object" && value !== null
);

/** Checks whether a value is plain object */
export const isPlainObject = (value: unknown): value is PlainObject => {
  if (!isObject(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

/** Checks whether a value is record */
export const isRecord = (value: unknown): value is Record<string, unknown> => (
  isPlainObject(value)
);

/** Checks whether a value has own */
export const hasOwn = <TKey extends PropertyKey>(
  value: unknown,
  key: TKey
): value is Record<TKey, unknown> => (
  isObject(value) && Object.hasOwn(value, key)
);

/** Checks whether a value is function */
export const isFunction = <TFunction extends AnyFunction = AnyFunction>(
  value: unknown
): value is TFunction => (
  typeof value === "function"
);

/** Checks whether a value is promise like */
export const isPromiseLike = <TValue = unknown>(
  value: unknown
): value is PromiseLike<TValue> => (
  isObject(value) && isFunction((value as { then?: unknown }).then)
);

// Collection guards
/** Checks whether a value is array */
export const isArray = <TValue = unknown>(value: unknown): value is TValue[] => (
  Array.isArray(value)
);

/** Checks whether a value is non empty array */
export const isNonEmptyArray = <TValue = unknown>(
  value: unknown
): value is [TValue, ...TValue[]] => (
  isArray<TValue>(value) && value.length > 0
);

/** Checks whether a value is map */
export const isMap = <TKey = unknown, TValue = unknown>(
  value: unknown
): value is Map<TKey, TValue> => (
  value instanceof Map
);

/** Checks whether a value is set */
export const isSet = <TValue = unknown>(value: unknown): value is Set<TValue> => (
  value instanceof Set
);

/** Checks whether a value is weak map */
export const isWeakMap = <TKey extends object = object, TValue = unknown>(
  value: unknown
): value is WeakMap<TKey, TValue> => (
  value instanceof WeakMap
);

/** Checks whether a value is weak set */
export const isWeakSet = <TValue extends object = object>(
  value: unknown
): value is WeakSet<TValue> => (
  value instanceof WeakSet
);

// Built-in instance guards
/** Checks whether a value is date */
export const isDate = (value: unknown): value is Date => (
  value instanceof Date
);

/** Checks whether a value is valid date */
export const isValidDate = (value: unknown): value is Date => (
  isDate(value) && !Number.isNaN(value.getTime())
);

/** Checks whether a value is reg exp */
export const isRegExp = (value: unknown): value is RegExp => (
  value instanceof RegExp
);

/** Checks whether a value is error */
export const isError = (value: unknown): value is Error => (
  value instanceof Error
);

/** Checks whether a value is url */
export const isURL = (value: unknown): value is URL => (
  value instanceof URL
);

// Common value guards
/** Checks whether a value is empty */
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

/** Checks whether a value is truthy under JavaScript semantics */
export const isTruthy = <TValue>(value: TValue): value is Exclude<TValue, false | 0 | 0n | "" | null | undefined> => (
  Boolean(value)
);

/** Checks JavaScript falsiness without applying an unsound type narrowing for NaN */
export const isFalsy = (value: unknown): boolean => (
  !value
);

// Namespace export
/** Grouped helpers for the is module */
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
