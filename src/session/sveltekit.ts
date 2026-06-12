import {
  getIronSession,
  type IronSession,
  type SessionOptions
} from "iron-session";
import { createTokenSession } from "./core.js";
import type {
  TokenSessionController,
  TokenSessionData,
  TokenSessionOptions,
  TokenSessionTokens
} from "./types.js";
import type { JwtPayload } from "../jwt/index.js";

// SvelteKit cookie bridge
export type SvelteKitCookies = Readonly<{
  get: (name: string) => string | undefined;
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
}>;

export type SvelteKitTokenSessionOptions<
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
> = Omit<
  TokenSessionOptions<SvelteKitCookies, TUser, TTokens, TClaims>,
  "clearSession" | "readSession" | "writeSession"
> & Readonly<{
  sessionOptions: SessionOptions;
}>;

export type SvelteKitTokenSession<
  TUser,
  TTokens extends TokenSessionTokens
> = Omit<
  TokenSessionController<SvelteKitCookies, TUser, TTokens>,
  "getSession"
> & Readonly<{
  getSession: (
    cookies: SvelteKitCookies
  ) => Promise<IronSession<TokenSessionData<TUser, TTokens>>>;
  getSessionData: (
    cookies: SvelteKitCookies
  ) => Promise<TokenSessionData<TUser, TTokens>>;
}>;

export const createSvelteKitTokenSession = <
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
>(
  options: SvelteKitTokenSessionOptions<TUser, TTokens, TClaims>
): SvelteKitTokenSession<TUser, TTokens> => {
  const getSession = (cookies: SvelteKitCookies) => getIronSession<
    TokenSessionData<TUser, TTokens>
  >(
    createCookieStore(cookies) as never,
    options.sessionOptions
  );

  const controller = createTokenSession<SvelteKitCookies, TUser, TTokens, TClaims>({
    ...options,
    clearSession: async (cookies) => {
      const session = await getSession(cookies);

      session.destroy();
    },
    readSession: async (cookies) => {
      const session = await getSession(cookies);

      return {
        tokens: session.tokens,
        user  : session.user
      };
    },
    writeSession: async (cookies, data) => {
      const session = await getSession(cookies);

      session.tokens = data.tokens;
      session.user   = data.user;

      await session.save();
    }
  });

  return Object.freeze({
    ...controller,
    getSession,
    getSessionData: controller.getSession
  });
};

export const createIronTokenSession = createSvelteKitTokenSession;

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
