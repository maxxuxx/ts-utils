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

// Selection helpers
/** Picks selected values */
export const pick = <
  TObject extends object,
  const TKey extends keyof TObject
>(
  value: TObject,
  keys: readonly TKey[]
): Pick<TObject, TKey> => {
  const result = {} as Pick<TObject, TKey>;

  for (const key of keys) {
    if (Object.prototype.propertyIsEnumerable.call(value, key)) {
      result[key] = value[key];
    }
  }

  return result;
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
/** Removes undefined */
export const removeUndefined = <TObject extends object>(
  value: TObject
): DefinedObject<TObject> => {
  const result = {} as DefinedObject<TObject>;

  for (const [key, item] of entries(value)) {
    if (item !== undefined) {
      result[key] = item as Exclude<TObject[typeof key], undefined>;
    }
  }

  return result;
};

/** Removes null and undefined values from an object */
export const compact = <TObject extends object>(
  value: TObject
): CompactObject<TObject> => {
  const result = {} as CompactObject<TObject>;

  for (const [key, item] of entries(value)) {
    if (item !== undefined && item !== null) {
      result[key] = item as NonNullable<TObject[typeof key]>;
    }
  }

  return result;
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

/** Builds a typed object from entries */
export const fromEntries = <TEntry extends readonly [PropertyKey, unknown]>(
  value: Iterable<TEntry>
): {
  [TItem in TEntry as TItem[0]]: TItem[1]
} => {
  const result: Record<PropertyKey, unknown> = {};

  for (const [key, item] of value) {
    result[key] = item;
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
