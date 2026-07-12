import type {
  ApiHeadersInit,
  ApiTokenHeaderFormatter
} from "./types.js";

// Header helpers
/** Merges headers */
export const mergeHeaders = (
  ...sources: Array<ApiHeadersInit | undefined>
): Headers | undefined => {
  const headers = new Headers();
  let hasValue  = false;

  for (const source of sources) {
    if (!source) {
      continue;
    }

    new Headers(source).forEach((value, key) => {
      headers.set(key, value);
      hasValue = true;
    });
  }

  return hasValue ? headers : undefined;
};

const defaultFormatTokenHeader: ApiTokenHeaderFormatter = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`
});

/** Builds headers */
export const buildHeaders = (
  headers: ApiHeadersInit | undefined,
  accessToken: string | undefined,
  isJsonBody: boolean,
  formatTokenHeader: ApiTokenHeaderFormatter = defaultFormatTokenHeader
): Readonly<{
  authApplied: boolean;
  headers    : Headers;
}> => {
  const nextHeaders = new Headers(headers);
  let authApplied    = false;

  if (isJsonBody && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (accessToken) {
    authApplied = mergeMissingHeaders(
      nextHeaders,
      formatTokenHeader(accessToken) ?? undefined
    );
  }

  return {
    authApplied,
    headers: nextHeaders
  };
};

const mergeMissingHeaders = (
  target: Headers,
  source: ApiHeadersInit | undefined
): boolean => {
  if (!source) {
    return false;
  }

  let merged = false;

  new Headers(source).forEach((value, key) => {
    if (!target.has(key)) {
      target.set(key, value);
      merged = true;
    }
  });

  return merged;
};
