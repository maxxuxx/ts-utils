/** Represents object entry */
export type ObjectEntry<TObject extends object> = {
  [TKey in Extract<keyof TObject, string>]-?: [TKey, TObject[TKey]]
}[Extract<keyof TObject, string>];

/** Represents defined object */
export type DefinedObject<TObject extends object> = Partial<{
  [TKey in keyof TObject]: Exclude<TObject[TKey], undefined>
}>;

/** Represents compact object */
export type CompactObject<TObject extends object> = Partial<{
  [TKey in keyof TObject]: NonNullable<TObject[TKey]>
}>;

// Property helpers
const setOwn = (
  target: Record<PropertyKey, unknown>,
  key: PropertyKey,
  value: unknown
): void => {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable  : true,
    value,
    writable    : true
  });
};

// Selection helpers
/** Picks selected values into own data properties, including __proto__ */
export const pick = <
  TObject extends object,
  const TKey extends keyof TObject
>(
  value: TObject,
  keys: readonly TKey[]
): Pick<TObject, TKey> => {
  const result: Record<PropertyKey, unknown> = {};

  for (const key of keys) {
    if (Object.prototype.propertyIsEnumerable.call(value, key)) {
      setOwn(result, key, value[key]);
    }
  }

  return result as Pick<TObject, TKey>;
};

/** Omits selected values */
export const omit = <
  TObject extends object,
  const TKey extends keyof TObject
>(
  value: TObject,
  keys: readonly TKey[]
): Omit<TObject, TKey> => {
  const result = { ...value } as TObject;

  for (const key of keys) {
    delete result[key];
  }

  return result as Omit<TObject, TKey>;
};

// Cleanup helpers
/** Removes undefined while preserving keys as own data properties */
export const removeUndefined = <TObject extends object>(
  value: TObject
): DefinedObject<TObject> => {
  const result: Record<PropertyKey, unknown> = {};

  for (const [key, item] of entries(value)) {
    if (item !== undefined) {
      setOwn(result, key, item);
    }
  }

  return result as DefinedObject<TObject>;
};

/** Removes null and undefined while preserving keys as own data properties */
export const compact = <TObject extends object>(
  value: TObject
): CompactObject<TObject> => {
  const result: Record<PropertyKey, unknown> = {};

  for (const [key, item] of entries(value)) {
    if (item !== undefined && item !== null) {
      setOwn(result, key, item);
    }
  }

  return result as CompactObject<TObject>;
};

/** Merges defaults */
export const mergeDefaults = <
  TObject extends object,
  TDefaults extends object
>(
  value: TObject,
  defaults: TDefaults
): TDefaults & DefinedObject<TObject> => ({
  ...defaults,
  ...removeUndefined(value)
});

// Entry helpers
/** Returns typed object entries */
export const entries = <TObject extends object>(
  value: TObject
): Array<ObjectEntry<TObject>> => (
  Object.entries(value) as Array<ObjectEntry<TObject>>
);

/** Builds a typed object with own data properties from entries */
export const fromEntries = <TEntry extends readonly [PropertyKey, unknown]>(
  value: Iterable<TEntry>
): {
  [TItem in TEntry as TItem[0]]: TItem[1]
} => {
  const result: Record<PropertyKey, unknown> = {};

  for (const [key, item] of value) {
    setOwn(result, key, item);
  }

  return result as {
    [TItem in TEntry as TItem[0]]: TItem[1]
  };
};

/** Grouped helpers for the object module */
export const object = Object.freeze({
  compact,
  entries,
  fromEntries,
  mergeDefaults,
  omit,
  pick,
  removeUndefined
});
