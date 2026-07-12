import {
  createSvelteKitRefreshNamespace,
  type SvelteKitRefreshNamespace
} from "../../src/api-fetch/sveltekit.js";

type RefreshResult = Readonly<{
  accessToken: string;
}>;

type ExtendedRefreshResult = RefreshResult & Readonly<{
  refreshToken: string;
}>;

const refreshNamespace         = createSvelteKitRefreshNamespace<RefreshResult>();
const extendedRefreshNamespace = createSvelteKitRefreshNamespace<
  ExtendedRefreshResult
>();

// @ts-expect-error refresh namespaces are invariant for subtype results
const widenedNamespace: SvelteKitRefreshNamespace<RefreshResult> =
  extendedRefreshNamespace;

// @ts-expect-error refresh namespaces are invariant for supertype results
const narrowedNamespace: SvelteKitRefreshNamespace<ExtendedRefreshResult> =
  refreshNamespace;

void widenedNamespace;
void narrowedNamespace;
