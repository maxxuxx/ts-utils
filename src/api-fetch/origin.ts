// Origin resolution
const RELATIVE_BASE_URL_A = "https://relative-a.invalid";
const RELATIVE_BASE_URL_B = "https://relative-b.invalid";
const RELATIVE_ORIGIN_A   = new URL(RELATIVE_BASE_URL_A).origin;
const RELATIVE_ORIGIN_B   = new URL(RELATIVE_BASE_URL_B).origin;

type ResolvedRequestOrigin = Readonly<{
  origin  : string;
  relative: boolean;
}>;

/** Returns whether a resolved request URL can receive configured auth headers */
export const isTrustedRequestOrigin = (
  url: string,
  baseURL: string | undefined,
  allowedOrigins: readonly string[] = []
): boolean => {
  const requestOrigin = resolveRequestOrigin(url);

  if (requestOrigin === undefined) {
    return false;
  }

  if (requestOrigin.relative) {
    return true;
  }

  const trustedOrigins = new Set([
    ...(baseURL ? [new URL(baseURL).origin] : []),
    ...allowedOrigins.map((origin) => new URL(origin).origin)
  ]);

  return trustedOrigins.has(requestOrigin.origin);
};

const resolveRequestOrigin = (url: string): ResolvedRequestOrigin | undefined => {
  try {
    return {
      origin  : new URL(url).origin,
      relative: false
    };
  } catch {
    try {
      const originA = new URL(url, RELATIVE_BASE_URL_A).origin;
      const originB = new URL(url, RELATIVE_BASE_URL_B).origin;

      return {
        origin  : originA,
        relative: originA === RELATIVE_ORIGIN_A && originB === RELATIVE_ORIGIN_B
      };
    } catch {
      return undefined;
    }
  }
};
