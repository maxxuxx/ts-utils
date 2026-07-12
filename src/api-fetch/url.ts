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
    const normalizedPath = path.trimStart();
    const url = isAbsoluteUrl(path)
      ? new URL(path)
      : isNetworkPath(normalizedPath)
        ? new URL(normalizedPath, baseUrl)
        : new URL(
          path.startsWith("/") ? path.slice(1) : path,
          baseUrl?.endsWith("/") ? baseUrl : `${baseUrl}/`
        );

    appendQuery(url.searchParams, query);

    return url.toString();
  }

  return appendQueryToPath(path, query);
};

/** Removes query and fragment data from an API URL used in public contexts */
export const redactApiUrl = (url: string): string => {
  const absoluteUrl = redactAbsoluteUrl(url);

  if (absoluteUrl !== undefined) {
    return absoluteUrl;
  }

  const queryIndex    = url.indexOf("?");
  const fragmentIndex = url.indexOf("#");
  const indexes       = [queryIndex, fragmentIndex].filter((index) => index >= 0);

  return indexes.length === 0 ? url : url.slice(0, Math.min(...indexes));
};

const redactAbsoluteUrl = (value: string): string | undefined => {
  const normalized = value.trimStart();
  const isAbsolute = /^https?:\/\//i.test(normalized);
  const isNetwork  = /^[\\/]{2}/.test(normalized);

  if (!isAbsolute && !isNetwork) {
    return undefined;
  }

  try {
    const url = new URL(
      isNetwork ? normalized.replaceAll("\\", "/") : normalized,
      isNetwork ? "https://redaction.invalid" : undefined
    );

    url.username = "";
    url.password = "";
    url.search   = "";
    url.hash     = "";

    return isNetwork
      ? `//${url.host}${url.pathname}`
      : url.toString();
  } catch {
    return undefined;
  }
};

const appendQueryToPath = (path: string, query?: QueryParams): string => {
  if (!query) {
    return path;
  }

  const hashIndex       = path.indexOf("#");
  const pathWithoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const hashPart        = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const searchParams    = new URLSearchParams();

  appendQuery(searchParams, query);

  const queryString = searchParams.toString();

  if (!queryString) {
    return path;
  }

  const separator = pathWithoutHash.includes("?") ? "&" : "?";
  return `${pathWithoutHash}${separator}${queryString}${hashPart}`;
};

const isAbsoluteUrl = (path: string): boolean => /^https?:\/\//.test(path);

const isNetworkPath = (path: string): boolean => /^[\\/]{2}/.test(path);
