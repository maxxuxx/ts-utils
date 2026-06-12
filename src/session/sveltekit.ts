import {
  getIronSession,
  type IronSession,
  type SessionOptions
} from "iron-session";
import {
  TokenSessionError,
  createTokenSession
} from "./core.js";
import {
  TokenSessionReason
} from "./types.js";
import type {
  MaybePromise,
  TokenSessionData,
  TokenSessionOptions,
  TokenSessionTokens
} from "./types.js";
import type { JwtPayload } from "../jwt/index.js";

// SvelteKit cookie bridge
export type SvelteKitCookies = Readonly<{
  get: (name: string) => string | undefined;
  set: (name: string, value: string, options: any) => void;
}>;

export type SvelteKitTokenSessionOptions<
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
> = Omit<
  TokenSessionOptions<SvelteKitCookies, TUser, TTokens, TClaims>,
  "clear" | "read" | "write"
> & Readonly<{
  getCookies?: () => MaybePromise<SvelteKitCookies>;
  sessionOptions: SessionOptions;
}>;

export type SvelteKitTokenSession<
  TUser,
  TTokens extends TokenSessionTokens
> = Readonly<{
  clear: (cookies?: SvelteKitCookies) => Promise<void>;
  ensure: (cookies?: SvelteKitCookies) => Promise<TUser>;
  getAccessToken: (cookies?: SvelteKitCookies) => Promise<string | undefined>;
  getSession: (cookies?: SvelteKitCookies) => Promise<IronSession<TokenSessionData<TUser, TTokens>>>;
  getData: (cookies?: SvelteKitCookies) => Promise<TokenSessionData<TUser, TTokens>>;
  parseTokens: (tokens: unknown) => Pick<TokenSessionData<TUser, TTokens>, "tokens"> | null;
  refresh: (cookies?: SvelteKitCookies) => Promise<string>;
  set: (
    session: TokenSessionData<TUser, TTokens>,
    cookies?: SvelteKitCookies
  ) => Promise<void>;
  updateUser: (user: TUser, cookies?: SvelteKitCookies) => Promise<void>;
}>;

export const createSession = <
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
>(
  options: SvelteKitTokenSessionOptions<TUser, TTokens, TClaims>
): SvelteKitTokenSession<TUser, TTokens> => {
  const getSession = async (cookies?: SvelteKitCookies) => getIronSession<
    TokenSessionData<TUser, TTokens>
  >(
    createCookieStore(await resolveCookies(cookies, options.getCookies)) as never,
    options.sessionOptions
  );

  const controller = createTokenSession<SvelteKitCookies, TUser, TTokens, TClaims>({
    ...options,
    clear: async (cookies) => {
      const session = await getSession(cookies);

      session.destroy();
    },
    read: async (cookies) => {
      const session = await getSession(cookies);

      return {
        tokens: session.tokens,
        user  : session.user
      };
    },
    write: async (cookies, data) => {
      const session = await getSession(cookies);

      session.tokens = data.tokens;
      session.user   = data.user;

      await session.save();
    }
  });

  return Object.freeze({
    clear: async (cookies) => {
      await controller.clear(await resolveCookies(cookies, options.getCookies));
    },
    ensure: async (cookies) => (
      controller.ensure(await resolveCookies(cookies, options.getCookies))
    ),
    getAccessToken: async (cookies) => (
      controller.getAccessToken(await resolveCookies(cookies, options.getCookies))
    ),
    getSession,
    getData: async (cookies) => (
      controller.get(await resolveCookies(cookies, options.getCookies))
    ),
    parseTokens: controller.parseTokens,
    refresh: async (cookies) => (
      controller.refresh(await resolveCookies(cookies, options.getCookies))
    ),
    set: async (session, cookies) => {
      await controller.set(
        await resolveCookies(cookies, options.getCookies),
        session
      );
    },
    updateUser: async (user, cookies) => {
      await controller.updateUser(
        await resolveCookies(cookies, options.getCookies),
        user
      );
    }
  });
};

const resolveCookies = async (
  cookies: SvelteKitCookies | undefined,
  getCookies: (() => MaybePromise<SvelteKitCookies>) | undefined
): Promise<SvelteKitCookies> => {
  const resolved = cookies ?? await getCookies?.();

  if (!resolved) {
    throw new TokenSessionError(TokenSessionReason.INVALID);
  }

  return resolved;
};

const createCookieStore = (cookies: SvelteKitCookies) => ({
  get: (name: string) => {
    const value = cookies.get(name);

    return value ? { name, value } : undefined;
  },
  set: (name: string, value: string, options: Record<string, unknown> = {}) => {
    cookies.set(name, value, {
      path: "/",
      ...options
    });
  }
});
