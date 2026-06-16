import type { QueryParams, QueryValue } from "./types.js";

// Query params
/** Converts a value to query entries */
export const toQueryEntries = (query: QueryParams): Array<[string, QueryValue]> => {
  if (query instanceof URLSearchParams) {
    return Array.from(query.entries());
  }

  if (Array.isArray(query)) {
    return query;
  }

  return Object.entries(query).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      return value.map((item) => [key, item] as [string, QueryValue]);
    }

    return [[key, value] as [string, QueryValue]];
  });
};

/** Appends query */
export const appendQuery = (searchParams: URLSearchParams, query?: QueryParams): void => {
  if (!query) {
    return;
  }

  for (const [key, value] of toQueryEntries(query)) {
    if (value === null || value === undefined) {
      continue;
    }

    searchParams.append(key, String(value));
  }
};

/** Merges query */
export const mergeQuery = (
  ...queries: Array<QueryParams | undefined>
): QueryParams | undefined => {
  const entries = queries.flatMap((query) => query ? toQueryEntries(query) : []);

  return entries.length > 0 ? entries : undefined;
};
