import { appendQuery } from "./query.js";
import type { QueryParams } from "./types.js";

// URL helpers
/** Builds api url */
export const buildApiUrl = (
  path: string,
  baseUrl?: string,
  query?: QueryParams
): string => {
  if (isAbsoluteUrl(path) || baseUrl) {
    const url = isAbsoluteUrl(path)
      ? new URL(path)
      : new URL(
        path.startsWith("/") ? path.slice(1) : path,
        baseUrl?.endsWith("/") ? baseUrl : `${baseUrl}/`
      );

    appendQuery(url.searchParams, query);

    return url.toString();
  }

  return appendQueryToPath(path, query);
};

const appendQueryToPath = (path: string, query?: QueryParams): string => {
  if (!query) {
    return path;
  }

  const [pathWithoutHash = "", hash = ""] = path.split("#", 2);
  const searchParams                  = new URLSearchParams();

  appendQuery(searchParams, query);

  const queryString = searchParams.toString();

  if (!queryString) {
    return path;
  }

  const separator = pathWithoutHash.includes("?") ? "&" : "?";
  const hashPart  = hash ? `#${hash}` : "";

  return `${pathWithoutHash}${separator}${queryString}${hashPart}`;
};

const isAbsoluteUrl = (path: string): boolean => /^https?:\/\//.test(path);
