import type { ApiHeadersInit } from "./types.js";

// Header helpers
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

export const buildHeaders = (
  headers: ApiHeadersInit | undefined,
  accessToken: string | undefined,
  isJsonBody: boolean
): Headers => {
  const nextHeaders = new Headers(headers);

  if (isJsonBody && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (accessToken && !nextHeaders.has("Authorization")) {
    nextHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  return nextHeaders;
};
