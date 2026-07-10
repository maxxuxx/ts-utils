import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  createApiFetcher,
  type FetchLike
} from "../src/api-fetch/index.js";
import {
  TokenSessionError,
  createTokenSession
} from "../src/session/index.js";
import { createReactTokenSession } from "../src/session/react.js";
import { createSession } from "../src/session/sveltekit.js";

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

type TestClaims = z.infer<typeof Claims>;

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

  it("parses token pairs with configured token and JWT schemas", () => {
    const accessToken = createToken({
      exp: 1_700_003_600
    });
    const session = createTokenSession<void, TestUser, TestTokens, TestClaims>({
      clear: () => undefined,
      jwtSchema: Claims,
      read: () => ({}),
      tokenSchema: Tokens,
      userSchema : User,
      write: () => undefined
    });

    expect(session.parseTokens({
      accessToken,
      refreshToken: "refresh-token"
    })).toEqual({
      tokens: {
        accessToken,
        refreshToken: "refresh-token"
      }
    });
  });

  it("rejects invalid JWTs when parsing tokens with a JWT schema", () => {
    const session = createTokenSession<void, TestUser, TestTokens, TestClaims>({
      clear: () => undefined,
      jwtSchema: Claims,
      read: () => ({}),
      tokenSchema: Tokens,
      userSchema : User,
      write: () => undefined
    });

    expect(session.parseTokens({
      accessToken : "not-a-jwt",
      refreshToken: "refresh-token"
    })).toBeNull();
  });

  it("rejects non-base64url JWT segments before applying the JWT schema", () => {
    const accessToken       = createToken({ exp: 1_700_003_600 });
    const [header, payload] = accessToken.split(".");
    const session = createTokenSession<void, TestUser, TestTokens, TestClaims>({
      clear: () => undefined,
      jwtSchema: Claims,
      read: () => ({}),
      tokenSchema: Tokens,
      userSchema : User,
      write: () => undefined
    });

    expect(session.parseTokens({
      accessToken : `${header}.${payload}$.signature`,
      refreshToken: "refresh-token"
    })).toBeNull();
  });

  it("requires refresh tokens when parsing tokens by default", () => {
    const session = createTokenSession<void, TestUser, TestTokens, TestClaims>({
      clear: () => undefined,
      jwtSchema: Claims,
      read: () => ({}),
      tokenSchema: Tokens,
      userSchema : User,
      write: () => undefined
    });

    expect(session.parseTokens({
      accessToken: createToken({
        exp: 1_700_003_600
      })
    })).toBeNull();
  });

  it("parses access-token-only tokens when refresh tokens are disabled", () => {
    const accessToken = createToken({
      exp: 1_700_003_600
    });
    const session = createTokenSession<void, TestUser, TestTokens, TestClaims>({
      clear: () => undefined,
      jwtSchema: Claims,
      read: () => ({}),
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User,
      write: () => undefined
    });

    expect(session.parseTokens({
      accessToken
    })).toEqual({
      tokens: {
        accessToken
      }
    });
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

  it("rejects refreshed JWT tokens that do not match the configured JWT schema", async () => {
    const nowSeconds = 1_700_000_000;
    const currentTokens = {
      accessToken : createToken({ exp: nowSeconds + 60 }),
      refreshToken: "invalid-refresh-token"
    };
    let storedSession: TestSession = {
      tokens: currentTokens,
      user: {
        id: "user-1"
      }
    };
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      jwtSchema : Claims,
      now       : () => nowSeconds * 1000,
      read: () => storedSession,
      refreshThresholdSeconds: 300,
      refreshTokens: async () => ({
        accessToken : "not-a-jwt",
        refreshToken: "next-refresh-token"
      }),
      tokenSchema: Tokens,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });

    await expect(session.ensure(undefined)).rejects.toMatchObject({
      reason: "invalid_token"
    } satisfies Partial<TokenSessionError>);
    expect(storedSession.tokens).toBe(currentTokens);
  });

  it("dedupes concurrent refresh token rotation and writes next tokens to every request context", async () => {
    const nowSeconds = 1_700_000_000;
    const expiringAccessToken = createToken({
      exp: nowSeconds + 60
    });
    const nextAccessToken = createToken({
      exp    : nowSeconds + 3600,
      version: "next"
    });
    type RequestContext = {
      endpoint: string;
      session: TestSession;
    };
    const createRequestContext = (endpoint: string): RequestContext => ({
      endpoint,
      session: {
        tokens: {
          accessToken : expiringAccessToken,
          refreshToken: "concurrent-refresh-token"
        },
        user: {
          id: "user-1"
        }
      }
    });
    const contexts = [
      createRequestContext("/me"),
      createRequestContext("/threads"),
      createRequestContext("/notifications")
    ];
    const refreshGate = createDeferred<void>();
    const rotatedRefreshTokens = new Set<string>();
    const refreshTokens = vi.fn(async (refreshToken: string) => {
      if (rotatedRefreshTokens.has(refreshToken)) {
        throw new Error("refresh token already rotated");
      }

      rotatedRefreshTokens.add(refreshToken);
      await refreshGate.promise;

      return {
        accessToken : nextAccessToken,
        refreshToken: "next-refresh-token"
      };
    });
    const session = createTokenSession<RequestContext, TestUser, TestTokens>({
      clear: (context) => {
        context.session = {};
      },
      jwtSchema: Claims,
      now      : () => nowSeconds * 1000,
      read     : (context) => context.session,
      refreshThresholdSeconds: 300,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (context, nextSession) => {
        context.session = nextSession;
      }
    });
    const callProtectedApi = async (context: RequestContext) => {
      await session.ensure(context);

      return {
        authorization: `Bearer ${await session.getAccessToken(context)}`,
        endpoint     : context.endpoint,
        refreshToken : context.session.tokens?.refreshToken
      };
    };

    const requests = contexts.map(callProtectedApi);

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    refreshGate.resolve();

    await expect(Promise.all(requests)).resolves.toEqual([
      {
        authorization: `Bearer ${nextAccessToken}`,
        endpoint     : "/me",
        refreshToken : "next-refresh-token"
      },
      {
        authorization: `Bearer ${nextAccessToken}`,
        endpoint     : "/threads",
        refreshToken : "next-refresh-token"
      },
      {
        authorization: `Bearer ${nextAccessToken}`,
        endpoint     : "/notifications",
        refreshToken : "next-refresh-token"
      }
    ]);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(contexts.map((context) => context.session.tokens)).toEqual([
      {
        accessToken : nextAccessToken,
        refreshToken: "next-refresh-token"
      },
      {
        accessToken : nextAccessToken,
        refreshToken: "next-refresh-token"
      },
      {
        accessToken : nextAccessToken,
        refreshToken: "next-refresh-token"
      }
    ]);
  });

  it("shares rotated session tokens across concurrent retried API requests", async () => {
    const nowSeconds = 1_700_000_000;
    const expiringAccessToken = createToken({
      exp: nowSeconds + 60
    });
    const nextAccessToken = createToken({
      exp    : nowSeconds + 3600,
      version: "api-retry"
    });
    type RequestContext = {
      endpoint: string;
      session: TestSession;
    };
    const createRequestContext = (endpoint: string): RequestContext => ({
      endpoint,
      session: {
        tokens: {
          accessToken : expiringAccessToken,
          refreshToken: "api-retry-refresh-token"
        },
        user: {
          id: "user-1"
        }
      }
    });
    const contexts = [
      createRequestContext("/me"),
      createRequestContext("/threads"),
      createRequestContext("/notifications")
    ];
    const refreshGate = createDeferred<void>();
    const rotatedRefreshTokens = new Set<string>();
    const refreshTokens = vi.fn(async (refreshToken: string) => {
      if (rotatedRefreshTokens.has(refreshToken)) {
        throw new Error("refresh token already rotated");
      }

      rotatedRefreshTokens.add(refreshToken);
      await refreshGate.promise;

      return {
        accessToken : nextAccessToken,
        refreshToken: "api-retry-next-refresh-token"
      };
    });
    const session = createTokenSession<RequestContext, TestUser, TestTokens>({
      clear: (context) => {
        context.session = {};
      },
      jwtSchema: Claims,
      now      : () => nowSeconds * 1000,
      read     : (context) => context.session,
      refreshThresholdSeconds: 300,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (context, nextSession) => {
        context.session = nextSession;
      }
    });
    const fetch = vi.fn<FetchLike>(async (input, init) => {
      const headers = new Headers(init?.headers);
      const authorization = headers.get("Authorization");
      const path = String(input).replace("https://api.example.com", "");

      if (authorization === `Bearer ${nextAccessToken}`) {
        return jsonResponse({
          ok: true,
          path
        });
      }

      return jsonResponse({
        message: "expired"
      }, 401);
    });
    const createApi = (context: RequestContext) => createApiFetcher({
      baseURL: "https://api.example.com",
      fetch,
      auth: {
        getAccessToken: () => session.getAccessToken(context),
        refresh       : () => session.refresh(context)
      }
    });
    const requests = contexts.map((context) => (
      createApi(context).get(context.endpoint, {
        responseSchema: z.object({
          ok  : z.boolean(),
          path: z.string()
        })
      })
    ));

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    refreshGate.resolve();

    await expect(Promise.all(requests)).resolves.toEqual([
      {
        code    : 200,
        response: {
          ok  : true,
          path: "/me"
        }
      },
      {
        code    : 200,
        response: {
          ok  : true,
          path: "/threads"
        }
      },
      {
        code    : 200,
        response: {
          ok  : true,
          path: "/notifications"
        }
      }
    ]);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(fetch.mock.calls.map(([, init]) => (
      new Headers(init?.headers).get("Authorization")
    ))).toEqual([
      `Bearer ${expiringAccessToken}`,
      `Bearer ${expiringAccessToken}`,
      `Bearer ${expiringAccessToken}`,
      `Bearer ${nextAccessToken}`,
      `Bearer ${nextAccessToken}`,
      `Bearer ${nextAccessToken}`
    ]);
    expect(contexts.map((context) => context.session.tokens)).toEqual([
      {
        accessToken : nextAccessToken,
        refreshToken: "api-retry-next-refresh-token"
      },
      {
        accessToken : nextAccessToken,
        refreshToken: "api-retry-next-refresh-token"
      },
      {
        accessToken : nextAccessToken,
        refreshToken: "api-retry-next-refresh-token"
      }
    ]);
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
    const session = createSession<TestUser, TestTokens>({
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

const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  }
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

function createDeferred<TValue>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: TValue | PromiseLike<TValue>) => void;
  const promise = new Promise<TValue>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject  = promiseReject;
  });

  return {
    promise,
    reject,
    resolve
  };
}
