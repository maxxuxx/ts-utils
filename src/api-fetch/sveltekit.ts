import { createApiFetcher as createCoreApiFetcher } from "./client.js";
import {
  createSingleFlight,
  type SingleFlight
} from "../promise/index.js";
import type {
  ApiAuthOptions,
  ApiFetcher,
  ApiFetcherOptions,
  MaybePromise
} from "./types.js";

const DEFAULT_REFRESH_CACHE_MS = 2_000;
const EMPTY_REFRESH_RESULT = Symbol("empty refresh result");

const namedRefreshFlights = new Map<
  string,
  Map<number, SingleFlight<string, unknown>>
>();

type SvelteKitApiAuthBaseOptions<TCookies> = Readonly<{
  clear               ?: (cookies: TCookies) => MaybePromise<void>;
  formatTokenHeader   ?: ApiAuthOptions["formatTokenHeader"];
  getAccessToken       : (cookies: TCookies) => MaybePromise<string | null | undefined>;
  shouldRefreshOnError?: ApiAuthOptions["shouldRefreshOnError"];
}>;

type SvelteKitApiAuthWithoutRefresh<TCookies> =
  SvelteKitApiAuthBaseOptions<TCookies> & Readonly<{
    applyRefresh?: never;
    getRefreshKey?: never;
    namespace    ?: never;
    refresh      ?: undefined;
  }>;

/** SvelteKit auth callbacks that create and apply a shared refresh result */
export type SvelteKitRefreshAuthOptions<TCookies, TRefresh> =
  SvelteKitApiAuthBaseOptions<TCookies> & Readonly<{
    applyRefresh: (
      cookies: TCookies,
      result: TRefresh
    ) => MaybePromise<string | null | undefined>;
    getRefreshKey?: (
      cookies: TCookies,
      accessToken: string | null | undefined
    ) => MaybePromise<string | null | undefined>;
    namespace?: string;
    refresh: (
      cookies: TCookies,
      error: unknown
    ) => MaybePromise<TRefresh | null | undefined>;
  }>;

/** SvelteKit auth callbacks that return an access token without shared refresh state */
export type SvelteKitDirectRefreshAuthOptions<TCookies> =
  SvelteKitApiAuthBaseOptions<TCookies> & Readonly<{
    applyRefresh?: never;
    getRefreshKey?: never;
    namespace    ?: never;
    refresh: (
      cookies: TCookies,
      error: unknown
    ) => MaybePromise<string | null | undefined>;
  }>;

/** Options for svelte kit api auth */
export type SvelteKitApiAuthOptions<TCookies, TRefresh = string> =
  | SvelteKitApiAuthWithoutRefresh<TCookies>
  | SvelteKitDirectRefreshAuthOptions<TCookies>
  | SvelteKitRefreshAuthOptions<TCookies, TRefresh>;

/** Options for svelte kit refresh dedupe */
export type SvelteKitRefreshDedupeOptions = Readonly<{
  cacheSuccessMs?: number;
}>;

/** Options for svelte kit api fetcher */
export type SvelteKitApiFetcherOptions<TCookies, TRefresh = string> =
  Omit<ApiFetcherOptions, "auth"> & Readonly<{
    cookies: TCookies;
  }> & (
    | Readonly<{
        auth?:
          | SvelteKitApiAuthWithoutRefresh<TCookies>
          | SvelteKitRefreshAuthOptions<TCookies, TRefresh>;
        dedupeRefresh?: true | SvelteKitRefreshDedupeOptions;
      }>
    | Readonly<{
        auth?: SvelteKitApiAuthOptions<TCookies, TRefresh>;
        dedupeRefresh: false;
      }>
  );

/** Creates api fetcher */
export const createApiFetcher = <TCookies, TRefresh = string>(
  options: SvelteKitApiFetcherOptions<TCookies, TRefresh>
): ApiFetcher => {
  const {
    auth,
    cookies,
    dedupeRefresh,
    ...apiOptions
  } = options;

  if (auth?.refresh && dedupeRefresh !== false && !auth.applyRefresh) {
    throw new TypeError("applyRefresh is required when SvelteKit refresh dedupe is enabled");
  }

  const refreshSingleFlight = !auth?.refresh || dedupeRefresh === false
    ? undefined
    : resolveRefreshSingleFlight<TRefresh>(
      "namespace" in auth ? auth.namespace : undefined,
      resolveRefreshCacheMs(dedupeRefresh)
    );

  return createCoreApiFetcher({
    ...apiOptions,
    auth: auth ? {
      clear: auth.clear
        ? () => auth.clear?.(cookies)
        : undefined,
      formatTokenHeader: auth.formatTokenHeader,
      getAccessToken: () => auth.getAccessToken(cookies),
      refresh: auth.refresh
        ? (error) => refreshWithDedupe({
          auth,
          cookies,
          dedupeRefresh,
          error,
          refreshSingleFlight
        })
        : undefined,
      shouldRefreshOnError: auth.shouldRefreshOnError
    } : undefined
  });
};

/** Creates svelte kit api fetcher */
export const createSvelteKitApiFetcher = createApiFetcher;

async function refreshWithDedupe<TCookies, TRefresh>({
  auth,
  cookies,
  dedupeRefresh,
  error,
  refreshSingleFlight
}: Readonly<{
  auth               : SvelteKitApiAuthOptions<TCookies, TRefresh>;
  cookies            : TCookies;
  dedupeRefresh      : SvelteKitApiFetcherOptions<TCookies, TRefresh>["dedupeRefresh"];
  error              : unknown;
  refreshSingleFlight: SingleFlight<string, TRefresh> | undefined;
}>): Promise<string | null | undefined> {
  if (!auth.refresh) {
    return null;
  }

  if (dedupeRefresh === false) {
    const result = await auth.refresh(cookies, error);

    if (result === null) {
      return null;
    }

    if (result === undefined) {
      return undefined;
    }

    if (!auth.applyRefresh) {
      if (typeof result !== "string") {
        throw new TypeError("Direct SvelteKit refresh must return an access token");
      }

      return result;
    }

    return auth.applyRefresh(cookies, result as TRefresh);
  }

  const applyRefresh = auth.applyRefresh;

  if (!applyRefresh) {
    throw new TypeError("applyRefresh is required when SvelteKit refresh dedupe is enabled");
  }

  const accessToken = await auth.getAccessToken(cookies);
  const refreshKey = auth.getRefreshKey
    ? await auth.getRefreshKey(cookies, accessToken)
    : accessToken;

  if (!refreshKey || !refreshSingleFlight) {
    const result = await auth.refresh(cookies, error);

    if (result === null) {
      return null;
    }

    if (result === undefined) {
      return undefined;
    }

    return applyRefresh(cookies, result as TRefresh);
  }

  const result = await runRefreshOnce(
    refreshSingleFlight,
    refreshKey,
    () => auth.refresh?.(cookies, error) ?? null
  );

  return result === null
    ? null
    : applyRefresh(cookies, result);
}

function resolveRefreshCacheMs(
  dedupeRefresh: true | SvelteKitRefreshDedupeOptions | undefined
): number {
  if (dedupeRefresh === true || dedupeRefresh === undefined) {
    return DEFAULT_REFRESH_CACHE_MS;
  }

  return dedupeRefresh.cacheSuccessMs ?? DEFAULT_REFRESH_CACHE_MS;
}

function resolveRefreshSingleFlight<TRefresh>(
  namespace: string | undefined,
  cacheSuccessMs: number
): SingleFlight<string, TRefresh> {
  if (namespace === undefined) {
    return createSingleFlight<string, TRefresh>({
      successTtlMs: cacheSuccessMs
    });
  }

  let cacheFlights = namedRefreshFlights.get(namespace);

  if (!cacheFlights) {
    cacheFlights = new Map<number, SingleFlight<string, unknown>>();
    namedRefreshFlights.set(namespace, cacheFlights);
  }

  let refreshSingleFlight = cacheFlights.get(cacheSuccessMs);

  if (!refreshSingleFlight) {
    refreshSingleFlight = createSingleFlight<string, unknown>({
      successTtlMs: cacheSuccessMs
    });
    cacheFlights.set(cacheSuccessMs, refreshSingleFlight);
  }

  return refreshSingleFlight as SingleFlight<string, TRefresh>;
}

async function runRefreshOnce<TRefresh>(
  refreshSingleFlight: SingleFlight<string, TRefresh>,
  key: string,
  refresh: () => MaybePromise<TRefresh | null | undefined>
): Promise<TRefresh | null> {
  try {
    return await refreshSingleFlight.run(key, async () => {
      const result = await refresh();

      if (result === null || result === undefined) {
        throw EMPTY_REFRESH_RESULT;
      }

      return result;
    });
  } catch (error) {
    if (error === EMPTY_REFRESH_RESULT) {
      return null;
    }

    throw error;
  }
}
