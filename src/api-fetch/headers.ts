import type {
  ApiHeadersInit,
  ApiTokenHeaderFormatter
} from "./types.js";

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

const defaultFormatTokenHeader: ApiTokenHeaderFormatter = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`
});

export const buildHeaders = (
  headers: ApiHeadersInit | undefined,
  accessToken: string | undefined,
  isJsonBody: boolean,
  formatTokenHeader: ApiTokenHeaderFormatter = defaultFormatTokenHeader
): Headers => {
  const nextHeaders = new Headers(headers);

  if (isJsonBody && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (accessToken) {
    mergeMissingHeaders(nextHeaders, formatTokenHeader(accessToken) ?? undefined);
  }

  return nextHeaders;
};

const mergeMissingHeaders = (
  target: Headers,
  source: ApiHeadersInit | undefined
): void => {
  if (!source) {
    return;
  }

  new Headers(source).forEach((value, key) => {
    if (!target.has(key)) {
      target.set(key, value);
    }
  });
};
