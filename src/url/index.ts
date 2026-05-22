export type UrlPathPart = string | number | null | undefined;
export type UrlQueryValue = string | number | boolean | null | undefined;
export type UrlQueryParams =
  | URLSearchParams
  | ReadonlyArray<readonly [string, UrlQueryValue]>
  | Readonly<Record<string, UrlQueryValue | readonly UrlQueryValue[]>>;

// Path helpers
export const splitPath = (path: string): string[] => (
  path.split("/").filter((part) => part.length > 0)
);

export const stripLeadingSlash = (path: string): string => (
  path.replace(/^\/+/u, "")
);

export const stripTrailingSlash = (path: string): string => (
  path === "/" ? path : path.replace(/\/+$/u, "")
);

export const ensureLeadingSlash = (path: string): string => (
  path.startsWith("/") ? path : `/${path}`
);

export const withTrailingSlash = (path: string): string => (
  path.endsWith("/") ? path : `${path}/`
);

export const normalizePath = (path: string): string => {
  const hasLeadingSlash = path.startsWith("/");
  const hasTrailingSlash = path.endsWith("/") && path !== "/";
  const normalized = splitPath(path).join("/");

  if (!normalized) {
    return hasLeadingSlash ? "/" : "";
  }

  return `${hasLeadingSlash ? "/" : ""}${normalized}${hasTrailingSlash ? "/" : ""}`;
};

export const joinPath = (...parts: UrlPathPart[]): string => {
  const textParts = parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .map(String)
    .filter((part) => part.length > 0);
  const hasLeadingSlash = textParts[0]?.startsWith("/") === true;
  const joined = textParts
    .flatMap(splitPath)
    .join("/");

  if (!joined) {
    return hasLeadingSlash ? "/" : "";
  }

  return `${hasLeadingSlash ? "/" : ""}${joined}`;
};

// Query helpers
export const toQueryEntries = (query: UrlQueryParams): Array<[string, UrlQueryValue]> => {
  if (query instanceof URLSearchParams) {
    return Array.from(query.entries());
  }

  if (Array.isArray(query)) {
    return query.map(([key, value]) => [key, value]);
  }

  return Object.entries(query).flatMap(([key, value]) => {
    if (Array.isArray(value)) {
      return value.map((item) => [key, item] as [string, UrlQueryValue]);
    }

    return [[key, value] as [string, UrlQueryValue]];
  });
};

export const toSearchParams = (query?: UrlQueryParams): URLSearchParams => {
  const searchParams = new URLSearchParams();

  if (!query) {
    return searchParams;
  }

  for (const [key, value] of toQueryEntries(query)) {
    if (value === null || value === undefined) {
      continue;
    }

    searchParams.append(key, String(value));
  }

  return searchParams;
};

export const appendQuery = (
  path: string,
  query?: UrlQueryParams
): string => {
  const searchParams = toSearchParams(query);
  const queryString = searchParams.toString();

  if (!queryString) {
    return path;
  }

  const [pathWithoutHash = "", hash = ""] = path.split("#", 2);
  const separator = pathWithoutHash.includes("?") ? "&" : "?";
  const hashPart = hash ? `#${hash}` : "";

  return `${pathWithoutHash}${separator}${queryString}${hashPart}`;
};

// URL helpers
export const isAbsoluteUrl = (value: string): boolean => (
  /^[a-z][a-z\d+.-]*:\/\//iu.test(value)
);

export const isExternalUrl = (value: string): boolean => (
  isAbsoluteUrl(value) || value.startsWith("//")
);

export const buildUrl = (
  baseUrl: string,
  path = "",
  query?: UrlQueryParams
): string => {
  if (isAbsoluteUrl(path)) {
    return appendQuery(path, query);
  }

  if (!isAbsoluteUrl(baseUrl)) {
    return appendQuery(joinPath(baseUrl, path), query);
  }

  const url = new URL(baseUrl);
  const pathname = joinPath(url.pathname, path);

  url.pathname = pathname ? ensureLeadingSlash(pathname) : url.pathname;

  for (const [key, value] of toSearchParams(query)) {
    url.searchParams.append(key, value);
  }

  return url.toString();
};

export const url = Object.freeze({
  appendQuery,
  build: buildUrl,
  buildUrl,
  ensureLeadingSlash,
  isAbsolute: isAbsoluteUrl,
  isAbsoluteUrl,
  isExternal: isExternalUrl,
  isExternalUrl,
  join: joinPath,
  joinPath,
  normalize: normalizePath,
  normalizePath,
  split: splitPath,
  splitPath,
  stripLeadingSlash,
  stripTrailingSlash,
  toSearchParams,
  withTrailingSlash
});
