import { createApiFetcher as createCoreApiFetcher } from "./client.js";
import type {
  ApiAuthOptions,
  ApiFetcher,
  ApiFetcherOptions,
  MaybePromise
} from "./types.js";

const DEFAULT_REFRESH_CACHE_MS = 2_000;

type RefreshPromise = Promise<string | null | undefined>;

const refreshPromises = new Map<string, RefreshPromise>();

export type SvelteKitApiAuthOptions<TCookies> = Readonly<{
  clear               ?: (cookies: TCookies) => MaybePromise<void>;
  getAccessToken       : (cookies: TCookies) => MaybePromise<string | null | undefined>;
  refresh            ?: (cookies: TCookies, error: unknown) => MaybePromise<string | null | undefined>;
  shouldRefreshOnError?: ApiAuthOptions["shouldRefreshOnError"];
}>;

export type SvelteKitRefreshDedupeOptions = Readonly<{
  cacheSuccessMs?: number;
}>;

export type SvelteKitApiFetcherOptions<TCookies> = Omit<ApiFetcherOptions, "auth"> & Readonly<{
  auth          ?: SvelteKitApiAuthOptions<TCookies>;
  cookies        : TCookies;
  dedupeRefresh ?: boolean | SvelteKitRefreshDedupeOptions;
}>;

export const createApiFetcher = <TCookies>(
  options: SvelteKitApiFetcherOptions<TCookies>
): ApiFetcher => {
  const {
    auth,
    cookies,
    dedupeRefresh,
    ...apiOptions
  } = options;

  return createCoreApiFetcher({
    ...apiOptions,
    auth: auth ? {
      clear: auth.clear
        ? () => auth.clear?.(cookies)
        : undefined,
      getAccessToken: () => auth.getAccessToken(cookies),
      refresh: auth.refresh
        ? (error) => refreshWithDedupe({
          auth,
          cookies,
          dedupeRefresh,
          error
        })
        : undefined,
      shouldRefreshOnError: auth.shouldRefreshOnError
    } : undefined
  });
};

export const createSvelteKitApiFetcher = createApiFetcher;

async function refreshWithDedupe<TCookies>({
  auth,
  cookies,
  dedupeRefresh,
  error
}: Readonly<{
  auth: SvelteKitApiAuthOptions<TCookies>;
  cookies: TCookies;
  dedupeRefresh: SvelteKitApiFetcherOptions<TCookies>["dedupeRefresh"];
  error: unknown;
}>): Promise<string | null | undefined> {
  if (!auth.refresh) {
    return null;
  }

  if (dedupeRefresh === false) {
    return auth.refresh(cookies, error);
  }

  const accessToken = await auth.getAccessToken(cookies);

  if (!accessToken) {
    return auth.refresh(cookies, error);
  }

  return runRefreshOnce(
    accessToken,
    () => auth.refresh?.(cookies, error) ?? null,
    resolveRefreshCacheMs(dedupeRefresh)
  );
}

function resolveRefreshCacheMs(
  dedupeRefresh: SvelteKitApiFetcherOptions<unknown>["dedupeRefresh"]
): number {
  if (dedupeRefresh === true || dedupeRefresh === undefined) {
    return DEFAULT_REFRESH_CACHE_MS;
  }

  if (dedupeRefresh === false) {
    return 0;
  }

  return dedupeRefresh.cacheSuccessMs ?? DEFAULT_REFRESH_CACHE_MS;
}

function runRefreshOnce(
  key: string,
  refresh: () => MaybePromise<string | null | undefined>,
  cacheSuccessMs: number
): RefreshPromise {
  const existing = refreshPromises.get(key);

  if (existing) {
    return existing;
  }

  const promise = Promise.resolve()
    .then(refresh)
    .then((accessToken) => {
      if (accessToken && cacheSuccessMs > 0) {
        setTimeout(() => {
          if (refreshPromises.get(key) === promise) {
            refreshPromises.delete(key);
          }
        }, cacheSuccessMs);
      } else {
        refreshPromises.delete(key);
      }

      return accessToken;
    })
    .catch((error) => {
      refreshPromises.delete(key);
      throw error;
    });

  refreshPromises.set(key, promise);

  return promise;
}
