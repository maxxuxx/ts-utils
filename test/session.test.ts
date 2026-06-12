import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  TokenSessionError,
  createTokenSession
} from "../src/session/index.js";
import { createReactTokenSession } from "../src/session/react.js";
import { createSvelteKitTokenSession } from "../src/session/sveltekit.js";

type TestUser = {
  id: string;
};

type TestTokens = {
  accessToken: string;
  refreshToken?: string;
};

type TestSession = {
  tokens?: TestTokens;
  user?: TestUser;
};

const User = z.object({
  id: z.string()
});

const Tokens = z.object({
  accessToken : z.string().min(1),
  refreshToken: z.string().min(1).optional()
});

const Claims = z.object({
  exp: z.number()
}).passthrough();

describe("session module", () => {
  it("supports access-token-only sessions without refresh tokens", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken: "opaque-access-token"
      },
      user: {
        id: "user-1"
      }
    };
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });

    await expect(session.ensure(undefined)).resolves.toEqual({
      id: "user-1"
    });
    await expect(session.getAccessToken(undefined)).resolves.toBe("opaque-access-token");
  });

  it("requires refresh tokens by default", async () => {
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => undefined,
      read : () => ({
        tokens: {
          accessToken: "opaque-access-token"
        },
        user: {
          id: "user-1"
        }
      }),
      tokenSchema : Tokens,
      userSchema  : User,
      write: () => undefined
    });

    await expect(session.ensure(undefined)).rejects.toMatchObject({
      reason: "invalid_token"
    } satisfies Partial<TokenSessionError>);
  });

  it("refreshes expiring JWT token pairs and stores the next tokens", async () => {
    const nowSeconds = 1_700_000_000;
    let storedSession: TestSession = {
      tokens: {
        accessToken : createToken({ exp: nowSeconds + 60 }),
        refreshToken: "refresh-token"
      },
      user: {
        id: "user-1"
      }
    };
    const refreshTokens = vi.fn(async () => ({
      accessToken : createToken({ exp: nowSeconds + 3600 }),
      refreshToken: "next-refresh-token"
    }));
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      jwtSchema : Claims,
      now       : () => nowSeconds * 1000,
      read: () => storedSession,
      refreshThresholdSeconds: 300,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });

    await expect(session.ensure(undefined)).resolves.toEqual({
      id: "user-1"
    });
    expect(refreshTokens).toHaveBeenCalledWith(
      "refresh-token",
      expect.objectContaining({
        refreshToken: "refresh-token"
      })
    );
    expect(storedSession.tokens?.refreshToken).toBe("next-refresh-token");
  });

  it("throws a session error for expired access-token-only JWT sessions", async () => {
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => undefined,
      jwtSchema   : Claims,
      now         : () => 1_700_000_000_000,
      read : () => ({
        tokens: {
          accessToken: createToken({ exp: 1_699_999_999 })
        },
        user: {
          id: "user-1"
        }
      }),
      tokenSchema : Tokens,
      useRefreshToken: false,
      userSchema  : User,
      write: () => undefined
    });

    await expect(session.ensure(undefined)).rejects.toMatchObject({
      reason: "expired"
    } satisfies Partial<TokenSessionError>);
  });

  it("stores SvelteKit token sessions with iron-session cookies", async () => {
    const cookies = createMemoryCookies();
    const session = createSvelteKitTokenSession<TestUser, TestTokens>({
      getCookies    : () => cookies,
      sessionOptions: {
        cookieName: "app_session",
        password  : "replace-with-at-least-32-characters"
      },
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User
    });

    await session.set({
      tokens: {
        accessToken: "sveltekit-token"
      },
      user: {
        id: "user-1"
      }
    });

    await expect(session.getAccessToken()).resolves.toBe("sveltekit-token");
    await expect(session.ensure()).resolves.toEqual({
      id: "user-1"
    });

    const ironSession = await session.getSession();

    expect(ironSession.user).toEqual({
      id: "user-1"
    });
  });

  it("stores React token sessions in browser storage and notifies subscribers", async () => {
    const storage = createMemoryStorage();
    const session = createReactTokenSession<TestUser, TestTokens>({
      storage,
      storageKey: "auth-session",
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User
    });
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);

    await session.set({
      tokens: {
        accessToken: "react-token"
      },
      user: {
        id: "user-1"
      }
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.get().user).toEqual({
      id: "user-1"
    });
    await expect(session.getAccessToken()).resolves.toBe("react-token");

    const restoredSession = createReactTokenSession<TestUser, TestTokens>({
      storage,
      storageKey: "auth-session",
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User
    });

    expect(restoredSession.get().tokens?.accessToken).toBe("react-token");

    unsubscribe();
  });
});

// Test helpers
const createToken = (payload: unknown, header: unknown = {
  alg: "HS256",
  typ: "JWT"
}): string => (
  `${encodeBase64Url(header)}.${encodeBase64Url(payload)}.signature`
);

const encodeBase64Url = (value: unknown): string => (
  Buffer
    .from(JSON.stringify(value), "utf8")
    .toString("base64url")
);

const createMemoryCookies = () => {
  const values = new Map<string, string>();

  return {
    get: (name: string) => values.get(name),
    set: (name: string, value: string) => {
      values.set(name, value);
    }
  };
};

const createMemoryStorage = () => {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    }
  };
};
