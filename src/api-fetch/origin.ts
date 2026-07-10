// Origin resolution
/** Returns whether a resolved request URL can receive configured auth headers */
export const isTrustedRequestOrigin = (
  url: string,
  baseURL: string | undefined,
  allowedOrigins: readonly string[] = []
): boolean => {
  const requestOrigin = getRequestOrigin(url);

  if (requestOrigin === undefined) {
    return !url.startsWith("//");
  }

  const trustedOrigins = new Set([
    ...(baseURL ? [new URL(baseURL).origin] : []),
    ...allowedOrigins.map((origin) => new URL(origin).origin)
  ]);

  return trustedOrigins.has(requestOrigin);
};

const getRequestOrigin = (url: string): string | undefined => {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};
