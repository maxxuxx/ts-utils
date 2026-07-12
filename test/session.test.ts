import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  createApiFetcher,
  type FetchLike
} from "../src/api-fetch/index.js";
import {
  TokenSessionError,
  createTokenSession,
  type TokenSessionData
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

type NestedUser = {
  id: string;
  profile: {
    name: string;
  };
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

  it("rejects schema-invalid core session reads", async () => {
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => undefined,
      read : () => ({
        tokens: {
          accessToken: "valid-token"
        },
        user: {
          id: 123
        } as unknown as TestUser
      }),
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User,
      write: () => undefined
    });

    await expect(session.get(undefined)).rejects.toMatchObject({
      reason: "unauthorized"
    } satisfies Partial<TokenSessionError>);
  });

  it("rejects schema-invalid core session set writes", async () => {
    const write = vi.fn();
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => undefined,
      read : () => ({}),
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User,
      write
    });

    await expect(session.set(undefined, {
      tokens: {
        accessToken: "valid-token"
      },
      user: {
        id: 123
      } as unknown as TestUser
    })).rejects.toMatchObject({
      reason: "unauthorized"
    } satisfies Partial<TokenSessionError>);
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects token-invalid core updateUser writes", async () => {
    const write = vi.fn();
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => undefined,
      read : () => ({
        tokens: {
          accessToken: ""
        },
        user: {
          id: "user-1"
        }
      }),
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User,
      write
    });

    await expect(session.updateUser(undefined, {
      id: "user-2"
    })).rejects.toMatchObject({
      reason: "invalid_token"
    } satisfies Partial<TokenSessionError>);
    expect(write).not.toHaveBeenCalled();
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

  it("does not restore a cleared session after a pending refresh", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "expired-clear-token",
        refreshToken: "clear-refresh-token"
      },
      user: {
        id: "user-1"
      }
    };
    const refreshGate = createDeferred<void>();
    const refreshTokens = vi.fn(async () => {
      await refreshGate.promise;

      return {
        accessToken : "stale-cleared-access-token",
        refreshToken: "stale-cleared-refresh-token"
      };
    });
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });
    const pendingRefresh = session.refresh(undefined);

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    await session.clear(undefined);
    refreshGate.resolve();

    await expect(pendingRefresh).rejects.toMatchObject({
      reason: "invalid_token"
    } satisfies Partial<TokenSessionError>);
    expect(storedSession).toEqual({});
  });

  it("does not overwrite a newer login after a pending refresh", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "expired-login-token",
        refreshToken: "old-login-refresh-token"
      },
      user: {
        id: "old-user"
      }
    };
    const refreshGate = createDeferred<void>();
    const refreshTokens = vi.fn(async () => {
      await refreshGate.promise;

      return {
        accessToken : "stale-login-access-token",
        refreshToken: "stale-login-refresh-token"
      };
    });
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });
    const pendingRefresh = session.refresh(undefined);

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    await session.set(undefined, {
      tokens: {
        accessToken : "new-login-access-token",
        refreshToken: "new-login-refresh-token"
      },
      user: {
        id: "new-user"
      }
    });
    refreshGate.resolve();

    await expect(pendingRefresh).resolves.toBe("new-login-access-token");
    expect(storedSession).toEqual({
      tokens: {
        accessToken : "new-login-access-token",
        refreshToken: "new-login-refresh-token"
      },
      user: {
        id: "new-user"
      }
    });
  });

  it("commits a delayed refresh before a newer login mutation", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "old-delayed-set-access",
        refreshToken: "old-delayed-set-refresh"
      },
      user: {
        id: "old-user"
      }
    };
    const refreshWriteStarted = createDeferred<void>();
    const refreshWriteGate    = createDeferred<void>();
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      refreshTokens: async () => ({
        accessToken : "fresh-delayed-set-access",
        refreshToken: "fresh-delayed-set-refresh"
      }),
      tokenSchema: Tokens,
      userSchema : User,
      write: async (_context, nextSession) => {
        if (nextSession.tokens?.accessToken === "fresh-delayed-set-access") {
          refreshWriteStarted.resolve();
          await refreshWriteGate.promise;
        }

        storedSession = nextSession;
      }
    });
    const pendingRefresh = session.refresh(undefined);

    await refreshWriteStarted.promise;

    const pendingSet = session.set(undefined, {
      tokens: {
        accessToken : "new-delayed-set-access",
        refreshToken: "new-delayed-set-refresh"
      },
      user: {
        id: "new-user"
      }
    });

    refreshWriteGate.resolve();

    await Promise.all([pendingRefresh, pendingSet]);
    expect(storedSession).toEqual({
      tokens: {
        accessToken : "new-delayed-set-access",
        refreshToken: "new-delayed-set-refresh"
      },
      user: {
        id: "new-user"
      }
    });
  });

  it("commits a delayed refresh before a clear mutation", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "old-delayed-clear-access",
        refreshToken: "old-delayed-clear-refresh"
      },
      user: {
        id: "old-user"
      }
    };
    const refreshWriteStarted = createDeferred<void>();
    const refreshWriteGate    = createDeferred<void>();
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      refreshTokens: async () => ({
        accessToken : "fresh-delayed-clear-access",
        refreshToken: "fresh-delayed-clear-refresh"
      }),
      tokenSchema: Tokens,
      userSchema : User,
      write: async (_context, nextSession) => {
        if (nextSession.tokens?.accessToken === "fresh-delayed-clear-access") {
          refreshWriteStarted.resolve();
          await refreshWriteGate.promise;
        }

        storedSession = nextSession;
      }
    });
    const pendingRefresh = session.refresh(undefined);

    await refreshWriteStarted.promise;

    const pendingClear = session.clear(undefined);

    refreshWriteGate.resolve();

    await Promise.all([pendingRefresh, pendingClear]);
    expect(storedSession).toEqual({});
  });

  it("commits a delayed refresh before an updateUser mutation", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "old-delayed-user-access",
        refreshToken: "old-delayed-user-refresh"
      },
      user: {
        id: "old-user"
      }
    };
    const refreshWriteStarted = createDeferred<void>();
    const refreshWriteGate    = createDeferred<void>();
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      refreshTokens: async () => ({
        accessToken : "fresh-delayed-user-access",
        refreshToken: "fresh-delayed-user-refresh"
      }),
      tokenSchema: Tokens,
      userSchema : User,
      write: async (_context, nextSession) => {
        if (nextSession.tokens?.accessToken === "fresh-delayed-user-access") {
          refreshWriteStarted.resolve();
          await refreshWriteGate.promise;
        }

        storedSession = nextSession;
      }
    });
    const pendingRefresh = session.refresh(undefined);

    await refreshWriteStarted.promise;

    const pendingUpdate = session.updateUser(undefined, {
      id: "updated-user"
    });

    refreshWriteGate.resolve();

    await Promise.all([pendingRefresh, pendingUpdate]);
    expect(storedSession).toEqual({
      tokens: {
        accessToken : "fresh-delayed-user-access",
        refreshToken: "fresh-delayed-user-refresh"
      },
      user: {
        id: "updated-user"
      }
    });
  });

  it("does not let delayed updateUser restore stale tokens", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "old-update-access",
        refreshToken: "old-update-refresh"
      },
      user: {
        id: "old-user"
      }
    };
    const updateWriteStarted = createDeferred<void>();
    const updateWriteGate    = createDeferred<void>();
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      tokenSchema: Tokens,
      userSchema : User,
      write: async (_context, nextSession) => {
        if (nextSession.user?.id === "updated-user") {
          updateWriteStarted.resolve();
          await updateWriteGate.promise;
        }

        storedSession = nextSession;
      }
    });
    const pendingUpdate = session.updateUser(undefined, {
      id: "updated-user"
    });

    await updateWriteStarted.promise;

    const pendingSet = session.set(undefined, {
      tokens: {
        accessToken : "new-update-access",
        refreshToken: "new-update-refresh"
      },
      user: {
        id: "new-user"
      }
    });

    updateWriteGate.resolve();

    await Promise.all([pendingUpdate, pendingSet]);
    expect(storedSession).toEqual({
      tokens: {
        accessToken : "new-update-access",
        refreshToken: "new-update-refresh"
      },
      user: {
        id: "new-user"
      }
    });
  });

  it("validates newer session state before accepting it during refresh", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "expired-validation-token",
        refreshToken: "validation-refresh-token"
      },
      user: {
        id: "old-user"
      }
    };
    const refreshGate = createDeferred<void>();
    const refreshTokens = vi.fn(async () => {
      await refreshGate.promise;

      return {
        accessToken : "stale-validation-access-token",
        refreshToken: "stale-validation-refresh-token"
      };
    });
    const write = vi.fn((_context: void, nextSession: TestSession) => {
      storedSession = nextSession;
    });
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write
    });
    const pendingRefresh = session.refresh(undefined);

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    storedSession = {
      tokens: {
        accessToken : "new-invalid-access-token",
        refreshToken: ""
      },
      user: {
        id: "new-user"
      }
    };
    refreshGate.resolve();

    await expect(pendingRefresh).rejects.toMatchObject({
      reason: "invalid_token"
    } satisfies Partial<TokenSessionError>);
    expect(write).not.toHaveBeenCalled();
  });

  it("validates a newer access token with the JWT schema during refresh", async () => {
    const nowSeconds = 1_700_000_000;
    let storedSession: TestSession = {
      tokens: {
        accessToken : createToken({ exp: nowSeconds + 60 }),
        refreshToken: "jwt-validation-refresh-token"
      },
      user: {
        id: "old-user"
      }
    };
    const refreshGate = createDeferred<void>();
    const refreshTokens = vi.fn(async () => {
      await refreshGate.promise;

      return {
        accessToken : createToken({ exp: nowSeconds + 3_600 }),
        refreshToken: "next-jwt-validation-refresh-token"
      };
    });
    const write = vi.fn((_context: void, nextSession: TestSession) => {
      storedSession = nextSession;
    });
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      jwtSchema: Claims,
      now      : () => nowSeconds * 1000,
      read     : () => storedSession,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write
    });
    const pendingRefresh = session.refresh(undefined);

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    storedSession = {
      tokens: {
        accessToken : "not-a-jwt",
        refreshToken: "new-jwt-validation-refresh-token"
      },
      user: {
        id: "new-user"
      }
    };
    refreshGate.resolve();

    await expect(pendingRefresh).rejects.toMatchObject({
      reason: "invalid_token"
    } satisfies Partial<TokenSessionError>);
    expect(write).not.toHaveBeenCalled();
  });

  it("ignores a stale refresh failure after a newer login", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "expired-failure-token",
        refreshToken: "old-failure-refresh-token"
      },
      user: {
        id: "old-user"
      }
    };
    const refreshGate = createDeferred<void>();
    const refreshError = new Error("old refresh failed");
    const refreshTokens = vi.fn(async () => {
      await refreshGate.promise;
      throw refreshError;
    });
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });
    const pendingRefresh = session.refresh(undefined);

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    await session.set(undefined, {
      tokens: {
        accessToken : "new-failure-access-token",
        refreshToken: "new-failure-refresh-token"
      },
      user: {
        id: "new-user"
      }
    });
    refreshGate.resolve();

    await expect(pendingRefresh).resolves.toBe("new-failure-access-token");
    expect(storedSession.user?.id).toBe("new-user");
    expect(storedSession.tokens?.refreshToken).toBe("new-failure-refresh-token");
  });

  it("returns the current user when login changes during ensure refresh", async () => {
    const nowSeconds = 1_700_000_000;
    let storedSession: TestSession = {
      tokens: {
        accessToken : createToken({ exp: nowSeconds - 1 }),
        refreshToken: "old-ensure-refresh-token"
      },
      user: {
        id: "old-user"
      }
    };
    const refreshGate = createDeferred<void>();
    const refreshTokens = vi.fn(async () => {
      await refreshGate.promise;

      return {
        accessToken : createToken({ exp: nowSeconds + 3_600 }),
        refreshToken: "stale-ensure-refresh-token"
      };
    });
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      jwtSchema: Claims,
      now      : () => nowSeconds * 1000,
      read     : () => storedSession,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });
    const pendingEnsure = session.ensure(undefined);

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    await session.set(undefined, {
      tokens: {
        accessToken : createToken({ exp: nowSeconds + 7_200 }),
        refreshToken: "new-ensure-refresh-token"
      },
      user: {
        id: "new-user"
      }
    });
    refreshGate.resolve();

    await expect(pendingEnsure).resolves.toEqual({
      id: "new-user"
    });
    expect(storedSession.user).toEqual({
      id: "new-user"
    });
  });

  it("revalidates required tokens after login changes during ensure refresh", async () => {
    const nowSeconds = 1_700_000_000;
    let storedSession: TestSession = {
      tokens: {
        accessToken : createToken({ exp: nowSeconds - 1 }),
        refreshToken: "old-required-refresh-token"
      },
      user: {
        id: "old-user"
      }
    };
    const refreshGate = createDeferred<void>();
    const refreshTokens = vi.fn(async () => {
      await refreshGate.promise;

      return {
        accessToken : createToken({ exp: nowSeconds + 3_600 }),
        refreshToken: "stale-required-refresh-token"
      };
    });
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      jwtSchema: Claims,
      now      : () => nowSeconds * 1000,
      read     : () => storedSession,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });
    const pendingEnsure = session.ensure(undefined);

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    storedSession = {
      tokens: {
        accessToken: createToken({ exp: nowSeconds + 7_200 })
      },
      user: {
        id: "new-user"
      }
    };
    refreshGate.resolve();

    await expect(pendingEnsure).rejects.toMatchObject({
      reason: "invalid_token"
    } satisfies Partial<TokenSessionError>);
    expect(storedSession.user?.id).toBe("new-user");
  });

  it("preserves the current user when it changes during refresh", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "expired-user-token",
        refreshToken: "user-refresh-token"
      },
      user: {
        id: "old-user"
      }
    };
    const refreshGate = createDeferred<void>();
    const refreshTokens = vi.fn(async () => {
      await refreshGate.promise;

      return {
        accessToken : "fresh-user-token",
        refreshToken: "next-user-refresh-token"
      };
    });
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });
    const pendingRefresh = session.refresh(undefined);

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    await session.updateUser(undefined, {
      id: "current-user"
    });
    refreshGate.resolve();

    await expect(pendingRefresh).resolves.toBe("fresh-user-token");
    expect(storedSession.user).toEqual({
      id: "current-user"
    });
  });

  it("isolates refresh flights when a newer login reuses the refresh token", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "generation-a-access",
        refreshToken: "shared-generation-refresh"
      },
      user: {
        id: "generation-a-user"
      }
    };
    const generationAGate = createDeferred<void>();
    const read            = vi.fn(() => storedSession);
    const refreshTokens   = vi.fn(async (
      _refreshToken: string,
      context: {
        tokens: TestTokens;
      }
    ) => {
      if (context.tokens.accessToken === "generation-a-access") {
        await generationAGate.promise;

        return {
          accessToken : "generation-a-fresh",
          refreshToken: "shared-generation-refresh"
        };
      }

      return {
        accessToken : "generation-b-fresh",
        refreshToken: "shared-generation-refresh"
      };
    });
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      read,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });
    const refreshA = session.refresh(undefined);

    await vi.waitFor(() => {
      expect(refreshTokens).toHaveBeenCalledTimes(1);
    });

    await session.set(undefined, {
      tokens: {
        accessToken : "generation-b-access",
        refreshToken: "shared-generation-refresh"
      },
      user: {
        id: "generation-b-user"
      }
    });

    const refreshB = session.refresh(undefined);

    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledTimes(2);
    });
    await Promise.resolve();
    await Promise.resolve();

    const refreshCallsBeforeRelease = refreshTokens.mock.calls.length;

    generationAGate.resolve();

    await expect(Promise.all([refreshA, refreshB])).resolves.toEqual([
      "generation-b-fresh",
      "generation-b-fresh"
    ]);
    expect(refreshCallsBeforeRelease).toBe(2);
    expect(refreshTokens).toHaveBeenCalledTimes(2);
    expect(storedSession).toEqual({
      tokens: {
        accessToken : "generation-b-fresh",
        refreshToken: "shared-generation-refresh"
      },
      user: {
        id: "generation-b-user"
      }
    });
  });

  it("isolates retained refresh success when a newer login reuses the refresh token", async () => {
    let storedSession: TestSession = {
      tokens: {
        accessToken : "retained-generation-a-access",
        refreshToken: "shared-retained-refresh"
      },
      user: {
        id: "retained-generation-a-user"
      }
    };
    const refreshTokens = vi.fn(async (
      _refreshToken: string,
      context: {
        tokens: TestTokens;
      }
    ) => ({
      accessToken: context.tokens.accessToken === "retained-generation-a-access"
        ? "retained-generation-a-fresh"
        : "retained-generation-b-fresh",
      refreshToken: "shared-retained-refresh"
    }));
    const session = createTokenSession<void, TestUser, TestTokens>({
      clear: () => {
        storedSession = {};
      },
      dedupeRefresh: {
        cacheSuccessMs: 60_000
      },
      read: () => storedSession,
      refreshTokens,
      tokenSchema: Tokens,
      userSchema : User,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });

    await expect(session.refresh(undefined)).resolves.toBe("retained-generation-a-fresh");

    await session.set(undefined, {
      tokens: {
        accessToken : "retained-generation-b-access",
        refreshToken: "shared-retained-refresh"
      },
      user: {
        id: "retained-generation-b-user"
      }
    });

    await expect(session.refresh(undefined)).resolves.toBe("retained-generation-b-fresh");
    expect(refreshTokens).toHaveBeenCalledTimes(2);
    expect(storedSession).toEqual({
      tokens: {
        accessToken : "retained-generation-b-fresh",
        refreshToken: "shared-retained-refresh"
      },
      user: {
        id: "retained-generation-b-user"
      }
    });
  });

  it("applies session schema transforms once per refresh boundary", async () => {
    let userParseCount  = 0;
    let tokenParseCount = 0;
    const TransformUser = z.object({
      id: z.string()
    }).transform((user) => ({
      ...user,
      marker: `user-${++userParseCount}`
    }));
    const TransformTokens = z.object({
      accessToken : z.string(),
      refreshToken: z.string()
    }).transform((tokens) => ({
      ...tokens,
      accessToken: `${tokens.accessToken}-${++tokenParseCount}`
    }));
    type TransformedUser = z.output<typeof TransformUser>;
    type TransformedTokens = z.output<typeof TransformTokens>;
    let storedSession = {
      tokens: {
        accessToken : "expired",
        refreshToken: "refresh"
      },
      user: {
        id: "user"
      }
    } as unknown as TokenSessionData<TransformedUser, TransformedTokens>;
    const refreshTokens = vi.fn(async (
      _refreshToken: string,
      context: {
        tokens: TransformedTokens;
        user: TransformedUser;
      }
    ) => {
      expect(context.tokens.accessToken).toBe("expired-1");
      expect(context.user.marker).toBe("user-1");

      return {
        accessToken : "fresh",
        refreshToken: "next-refresh"
      } as TransformedTokens;
    });
    const session = createTokenSession<void, TransformedUser, TransformedTokens>({
      clear: () => {
        storedSession = {};
      },
      read: () => storedSession,
      refreshTokens,
      tokenSchema: TransformTokens,
      userSchema : TransformUser,
      write: (_context, nextSession) => {
        storedSession = nextSession;
      }
    });

    await expect(session.refresh(undefined)).resolves.toBe("fresh-2");
    expect(storedSession).toEqual({
      tokens: {
        accessToken : "fresh-2",
        refreshToken: "next-refresh"
      },
      user: {
        id    : "user",
        marker: "user-2"
      }
    });
    expect(tokenParseCount).toBe(3);
    expect(userParseCount).toBe(2);
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

  it("keeps refresh single-flight isolated per session controller", async () => {
    const refreshGate = createDeferred<void>();
    const createController = (name: string) => {
      let storedSession: TestSession = {
        tokens: {
          accessToken : `expired-${name}`,
          refreshToken: "controller-isolation-refresh-token"
        },
        user: {
          id: `user-${name}`
        }
      };
      const refreshTokens = vi.fn(async () => {
        await refreshGate.promise;

        return {
          accessToken : `fresh-${name}`,
          refreshToken: `next-${name}`
        };
      });
      const session = createTokenSession<void, TestUser, TestTokens>({
        clear: () => {
          storedSession = {};
        },
        read: () => storedSession,
        refreshTokens,
        tokenSchema: Tokens,
        userSchema : User,
        write: (_context, nextSession) => {
          storedSession = nextSession;
        }
      });

      return {
        getStoredSession: () => storedSession,
        refreshTokens,
        session
      };
    };
    const controllerA = createController("a");
    const controllerB = createController("b");
    const refreshA = controllerA.session.refresh(undefined);
    const refreshB = controllerB.session.refresh(undefined);

    await vi.waitFor(() => {
      const refreshCalls = controllerA.refreshTokens.mock.calls.length
        + controllerB.refreshTokens.mock.calls.length;

      expect(refreshCalls).toBeGreaterThan(0);
    });

    refreshGate.resolve();

    await expect(Promise.all([refreshA, refreshB])).resolves.toEqual([
      "fresh-a",
      "fresh-b"
    ]);
    expect(controllerA.refreshTokens).toHaveBeenCalledTimes(1);
    expect(controllerB.refreshTokens).toHaveBeenCalledTimes(1);
    expect(controllerA.getStoredSession().tokens?.refreshToken).toBe("next-a");
    expect(controllerB.getStoredSession().tokens?.refreshToken).toBe("next-b");
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

  it("does not reapply React transforms when reading a hydrated access token", async () => {
    let tokenParseCount = 0;
    let userParseCount  = 0;
    const TransformTokens = z.object({
      accessToken : z.string(),
      refreshToken: z.string().optional()
    }).transform((tokens) => ({
      ...tokens,
      accessToken: `${tokens.accessToken}|token-${++tokenParseCount}`
    }));
    const TransformUser = z.object({
      id: z.string()
    }).transform((user) => ({
      ...user,
      marker: `user-${++userParseCount}`
    }));
    type TransformedTokens = z.output<typeof TransformTokens>;
    type TransformedUser = z.output<typeof TransformUser>;
    const storage = createMemoryStorage();

    storage.setItem("hydrated-transform-session", JSON.stringify({
      tokens: {
        accessToken: "hydrated-access"
      },
      user: {
        id: "hydrated-user"
      }
    }));

    const session = createReactTokenSession<TransformedUser, TransformedTokens>({
      storage,
      storageKey: "hydrated-transform-session",
      tokenSchema: TransformTokens,
      useRefreshToken: false,
      userSchema : TransformUser
    });

    expect(tokenParseCount).toBe(1);
    expect(userParseCount).toBe(1);
    await expect(session.getAccessToken()).resolves.toBe("hydrated-access|token-1");
    expect(tokenParseCount).toBe(1);
    expect(userParseCount).toBe(1);
  });

  it("does not reapply React token transforms during updateUser", async () => {
    let tokenParseCount = 0;
    let userParseCount  = 0;
    const TransformTokens = z.object({
      accessToken : z.string(),
      refreshToken: z.string().optional()
    }).transform((tokens) => ({
      ...tokens,
      accessToken: `${tokens.accessToken}|token-${++tokenParseCount}`
    }));
    const TransformUser = z.object({
      id: z.string()
    }).transform((user) => ({
      ...user,
      marker: `user-${++userParseCount}`
    }));
    type TransformedTokens = z.output<typeof TransformTokens>;
    type TransformedUser = z.output<typeof TransformUser>;
    const storage = createMemoryStorage();
    const session = createReactTokenSession<TransformedUser, TransformedTokens>({
      storage,
      storageKey: "update-transform-session",
      tokenSchema: TransformTokens,
      useRefreshToken: false,
      userSchema : TransformUser
    });

    await session.set({
      tokens: {
        accessToken: "set-access"
      } as TransformedTokens,
      user: {
        id: "set-user"
      } as TransformedUser
    });
    await session.updateUser({
      id: "updated-user"
    } as TransformedUser);

    expect(tokenParseCount).toBe(1);
    expect(userParseCount).toBe(2);
    expect(session.get()).toEqual({
      tokens: {
        accessToken: "set-access|token-1"
      },
      user: {
        id    : "updated-user",
        marker: "user-2"
      }
    });
    expect(JSON.parse(storage.getItem("update-transform-session") ?? "null")).toEqual(
      session.get()
    );
  });

  it("applies React transforms once across set refresh and clear writes", async () => {
    let tokenParseCount = 0;
    let userParseCount  = 0;
    const TransformTokens = z.object({
      accessToken : z.string(),
      refreshToken: z.string()
    }).transform((tokens) => ({
      ...tokens,
      accessToken: `${tokens.accessToken}|token-${++tokenParseCount}`
    }));
    const TransformUser = z.object({
      id: z.string()
    }).transform((user) => ({
      ...user,
      marker: `user-${++userParseCount}`
    }));
    type TransformedTokens = z.output<typeof TransformTokens>;
    type TransformedUser = z.output<typeof TransformUser>;
    const storage = createMemoryStorage();
    const refreshTokens = vi.fn(async (
      _refreshToken: string,
      context: {
        tokens: TransformedTokens;
        user: TransformedUser;
      }
    ) => {
      expect(context.tokens.accessToken).toBe("set-access|token-1");
      expect(context.user.marker).toBe("user-1");

      return {
        accessToken : "fresh-access",
        refreshToken: "fresh-refresh"
      } as TransformedTokens;
    });
    const session = createReactTokenSession<TransformedUser, TransformedTokens>({
      refreshTokens,
      storage,
      storageKey: "write-transform-session",
      tokenSchema: TransformTokens,
      userSchema : TransformUser
    });

    await session.set({
      tokens: {
        accessToken : "set-access",
        refreshToken: "set-refresh"
      } as TransformedTokens,
      user: {
        id: "set-user"
      } as TransformedUser
    });

    expect(tokenParseCount).toBe(1);
    expect(userParseCount).toBe(1);
    await expect(session.refresh()).resolves.toBe("fresh-access|token-2");
    expect(tokenParseCount).toBe(2);
    expect(userParseCount).toBe(1);
    expect(session.get()).toEqual({
      tokens: {
        accessToken : "fresh-access|token-2",
        refreshToken: "fresh-refresh"
      },
      user: {
        id    : "set-user",
        marker: "user-1"
      }
    });
    expect(JSON.parse(storage.getItem("write-transform-session") ?? "null")).toEqual(
      session.get()
    );

    await session.clear();

    expect(session.get()).toEqual({});
    expect(storage.getItem("write-transform-session")).toBeNull();
    expect(tokenParseCount).toBe(2);
    expect(userParseCount).toBe(1);
  });

  it("uses the React server session only for initial hydration", () => {
    const storage = createMemoryStorage();
    const storageEvents = createStorageEventHarness();

    vi.stubGlobal("addEventListener", storageEvents.addEventListener);
    vi.stubGlobal("removeEventListener", storageEvents.removeEventListener);

    try {
      const session = createReactTokenSession<TestUser, TestTokens>({
        serverSession: {
          tokens: {
            accessToken: "server-token"
          },
          user: {
            id: "server-user"
          }
        },
        storage,
        storageKey: "hydrated-session",
        useRefreshToken: false
      });
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      expect(session.get().user?.id).toBe("server-user");

      storage.removeItem("hydrated-session");
      storageEvents.dispatch({
        key        : "hydrated-session",
        storageArea: storage
      });

      expect(session.get()).toEqual({});

      storage.setItem("hydrated-session", JSON.stringify({
        tokens: {
          accessToken: "tab-token"
        },
        user: {
          id: "tab-user"
        }
      }));
      storageEvents.dispatch({
        key        : "hydrated-session",
        storageArea: storage
      });
      listener.mockClear();
      storage.removeItem("hydrated-session");
      storageEvents.dispatch({
        key        : null,
        storageArea: storage
      });

      expect(session.get()).toEqual({});
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("catches up a React storage deletion on first subscribe", () => {
    const storage = createMemoryStorage();
    const storageEvents = createStorageEventHarness();

    storage.setItem("deleted-before-subscribe", JSON.stringify({
      tokens: {
        accessToken: "stored-token"
      },
      user: {
        id: "stored-user"
      }
    }));
    vi.stubGlobal("addEventListener", storageEvents.addEventListener);
    vi.stubGlobal("removeEventListener", storageEvents.removeEventListener);

    try {
      const session = createReactTokenSession<TestUser, TestTokens>({
        storage,
        storageKey: "deleted-before-subscribe",
        useRefreshToken: false
      });
      const previousSnapshot = session.getSnapshot();

      storage.removeItem("deleted-before-subscribe");

      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      expect(session.get()).toEqual({});
      expect(session.getSnapshot()).not.toBe(previousSnapshot);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("catches up corrupt React storage on first subscribe", () => {
    const storage = createMemoryStorage();
    const storageEvents = createStorageEventHarness();

    storage.setItem("corrupt-before-subscribe", JSON.stringify({
      tokens: {
        accessToken: "stored-token"
      },
      user: {
        id: "stored-user"
      }
    }));
    vi.stubGlobal("addEventListener", storageEvents.addEventListener);
    vi.stubGlobal("removeEventListener", storageEvents.removeEventListener);

    try {
      const session = createReactTokenSession<TestUser, TestTokens>({
        storage,
        storageKey: "corrupt-before-subscribe",
        useRefreshToken: false
      });

      storage.setItem("corrupt-before-subscribe", "{broken");

      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);

      expect(session.get()).toEqual({});
      expect(storage.getItem("corrupt-before-subscribe")).toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("attaches the React storage handler before the first subscribe catch-up read", () => {
    const baseStorage = createMemoryStorage();
    const storageEvents = createStorageEventHarness();
    const order: string[] = [];
    const storage = {
      ...baseStorage,
      getItem: (key: string) => {
        order.push("read");

        return baseStorage.getItem(key);
      }
    };
    const addEventListener = vi.fn((
      type: "storage",
      listener: (event: unknown) => void
    ) => {
      order.push("attach");
      storageEvents.addEventListener(type, listener);
    });

    vi.stubGlobal("addEventListener", addEventListener);
    vi.stubGlobal("removeEventListener", storageEvents.removeEventListener);

    try {
      const session = createReactTokenSession<TestUser, TestTokens>({
        storage,
        storageKey: "ordered-subscribe-catch-up",
        useRefreshToken: false
      });

      order.length = 0;

      const unsubscribe = session.subscribe(vi.fn());

      expect(order).toEqual(["attach", "read"]);

      unsubscribe();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps React set atomic when JSON serialization fails", async () => {
    const storage = createMemoryStorage();
    const session = createReactTokenSession<NestedUser, TestTokens>({
      initialSession: {
        tokens: {
          accessToken: "initial-token"
        },
        user: {
          id: "user-1",
          profile: {
            name: "initial"
          }
        }
      },
      storage,
      storageKey: "cyclic-session",
      useRefreshToken: false
    });
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    const previousSnapshot = session.getSnapshot();
    const profile: NestedUser["profile"] & { self?: unknown } = {
      name: "cyclic"
    };

    profile.self = profile;

    await expect(session.set({
      tokens: {
        accessToken: "next-token"
      },
      user: {
        id: "user-2",
        profile
      }
    })).rejects.toBeInstanceOf(TypeError);
    expect(session.getSnapshot()).toBe(previousSnapshot);
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("keeps React set atomic when persistent storage write fails", async () => {
    const baseStorage = createMemoryStorage();
    const storage = {
      ...baseStorage,
      setItem: vi.fn(() => {
        throw new Error("storage write failed");
      })
    };
    const session = createReactTokenSession<TestUser, TestTokens>({
      initialSession: {
        tokens: {
          accessToken: "initial-token"
        },
        user: {
          id: "initial-user"
        }
      },
      storage,
      storageKey: "failed-write-session",
      useRefreshToken: false
    });
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    const previousSnapshot = session.getSnapshot();

    await expect(session.set({
      tokens: {
        accessToken: "next-token"
      },
      user: {
        id: "next-user"
      }
    })).rejects.toThrow("storage write failed");
    expect(session.getSnapshot()).toBe(previousSnapshot);
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("keeps React clear atomic when persistent storage removal fails", async () => {
    const baseStorage = createMemoryStorage();

    baseStorage.setItem("failed-clear-session", JSON.stringify({
      tokens: {
        accessToken: "stored-token"
      },
      user: {
        id: "stored-user"
      }
    }));

    const storage = {
      ...baseStorage,
      removeItem: vi.fn(() => {
        throw new Error("storage removal failed");
      })
    };
    const session = createReactTokenSession<TestUser, TestTokens>({
      storage,
      storageKey: "failed-clear-session",
      useRefreshToken: false
    });
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    const previousSnapshot = session.getSnapshot();

    await expect(session.clear()).rejects.toThrow("storage removal failed");
    expect(session.getSnapshot()).toBe(previousSnapshot);
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  it("detaches React session state from nested set inputs", async () => {
    const session = createReactTokenSession<NestedUser, TestTokens>({
      storageKey: "detached-input-session",
      useRefreshToken: false
    });
    const input = {
      tokens: {
        accessToken: "input-token"
      },
      user: {
        id: "user-1",
        profile: {
          name: "before"
        }
      }
    };

    await session.set(input);
    input.user.profile.name = "after";

    expect(session.get().user?.profile.name).toBe("before");
  });

  it("exposes immutable React snapshots with stable update identity", async () => {
    const session = createReactTokenSession<NestedUser, TestTokens>({
      storageKey: "immutable-output-session",
      useRefreshToken: false
    });

    await session.set({
      tokens: {
        accessToken: "snapshot-token"
      },
      user: {
        id: "user-1",
        profile: {
          name: "before"
        }
      }
    });

    const snapshot = session.get();

    expect(session.getSnapshot()).toBe(snapshot);
    expect(session.get()).toBe(snapshot);
    expect(() => {
      if (snapshot.user) {
        snapshot.user.profile.name = "after";
      }
    }).toThrow(TypeError);
    expect(session.getSnapshot().user?.profile.name).toBe("before");
    expect(session.getSnapshot()).toBe(snapshot);
  });

  it("rejects React snapshot containers with mutable internal slots", async () => {
    const unsupportedValues: unknown[] = [
      new Date("2026-01-01T00:00:00.000Z"),
      new Map([["key", "value"]]),
      new Set(["value"]),
      new Uint8Array([1, 2, 3])
    ];

    for (const value of unsupportedValues) {
      const session = createReactTokenSession<{
        id: string;
        value: unknown;
      }, TestTokens>({
        storageKey: "unsupported-snapshot-session",
        useRefreshToken: false
      });
      const listener = vi.fn();
      const unsubscribe = session.subscribe(listener);
      const previousSnapshot = session.getSnapshot();

      await expect(session.set({
        tokens: {
          accessToken: "unsupported-value-token"
        },
        user: {
          id: "user-1",
          value
        }
      })).rejects.toThrow(TypeError);
      expect(session.getSnapshot()).toBe(previousSnapshot);
      expect(listener).not.toHaveBeenCalled();

      unsubscribe();
    }
  });

  it("uses one filtered storage event handler per React controller", () => {
    const storage = createMemoryStorage();
    const otherStorage = createMemoryStorage();
    const storageEvents = createStorageEventHarness();

    vi.stubGlobal("addEventListener", storageEvents.addEventListener);
    vi.stubGlobal("removeEventListener", storageEvents.removeEventListener);

    try {
      const session = createReactTokenSession<TestUser, TestTokens>({
        storage,
        storageKey: "shared-listener-session",
        useRefreshToken: false
      });
      const listenerA = vi.fn();
      const listenerB = vi.fn();
      const unsubscribeA = session.subscribe(listenerA);
      const unsubscribeB = session.subscribe(listenerB);

      expect(storageEvents.addEventListener).toHaveBeenCalledTimes(1);

      storageEvents.dispatch({
        key        : "shared-listener-session",
        storageArea: otherStorage
      });
      storageEvents.dispatch({
        key        : "other-session",
        storageArea: storage
      });
      expect(listenerA).not.toHaveBeenCalled();
      expect(listenerB).not.toHaveBeenCalled();

      storage.setItem("shared-listener-session", JSON.stringify({
        tokens: {
          accessToken: "updated-token"
        },
        user: {
          id: "updated-user"
        }
      }));
      storageEvents.dispatch({
        key        : "shared-listener-session",
        storageArea: storage
      });

      expect(listenerA).toHaveBeenCalledTimes(1);
      expect(listenerB).toHaveBeenCalledTimes(1);
      expect(session.get().user?.id).toBe("updated-user");

      unsubscribeA();
      expect(storageEvents.removeEventListener).not.toHaveBeenCalled();
      unsubscribeB();
      expect(storageEvents.removeEventListener).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses memory storage by default and with explicit memory storage", async () => {
    const localStorage = createMemoryStorage();

    vi.stubGlobal("localStorage", localStorage);

    try {
      for (const storage of [undefined, "memory"] as const) {
        const storageKey = `memory-session-${storage ?? "default"}`;
        const session = createReactTokenSession<TestUser, TestTokens>({
          storage,
          storageKey,
          tokenSchema: Tokens,
          useRefreshToken: false,
          userSchema : User
        });

        await session.set({
          tokens: {
            accessToken: "memory-token"
          },
          user: {
            id: "user-1"
          }
        });

        expect(session.get().tokens?.accessToken).toBe("memory-token");
        expect(localStorage.getItem(storageKey)).toBeNull();
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("persists React sessions only with explicit local or session storage", async () => {
    const localStorage   = createMemoryStorage();
    const sessionStorage = createMemoryStorage();

    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("sessionStorage", sessionStorage);

    try {
      const localSession = createReactTokenSession<TestUser, TestTokens>({
        storage   : "local",
        storageKey: "local-session",
        tokenSchema: Tokens,
        useRefreshToken: false,
        userSchema : User
      });
      const browserSession = createReactTokenSession<TestUser, TestTokens>({
        storage   : "session",
        storageKey: "browser-session",
        tokenSchema: Tokens,
        useRefreshToken: false,
        userSchema : User
      });

      await localSession.set({
        tokens: {
          accessToken: "local-token"
        },
        user: {
          id: "local-user"
        }
      });
      await browserSession.set({
        tokens: {
          accessToken: "session-token"
        },
        user: {
          id: "session-user"
        }
      });

      expect(JSON.parse(localStorage.getItem("local-session") ?? "null")).toEqual({
        tokens: {
          accessToken: "local-token"
        },
        user: {
          id: "local-user"
        }
      });
      expect(JSON.parse(sessionStorage.getItem("browser-session") ?? "null")).toEqual({
        tokens: {
          accessToken: "session-token"
        },
        user: {
          id: "session-user"
        }
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("clears corrupt stored React session JSON", () => {
    const storage = createMemoryStorage();

    storage.setItem("corrupt-session", "{broken");

    const session = createReactTokenSession<TestUser, TestTokens>({
      storage,
      storageKey: "corrupt-session",
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User
    });

    expect(session.get()).toEqual({});
    expect(storage.getItem("corrupt-session")).toBeNull();
  });

  it("clears empty stored React session JSON", () => {
    const storage = createMemoryStorage();

    storage.setItem("empty-session", "");

    createReactTokenSession<TestUser, TestTokens>({
      storage,
      storageKey: "empty-session",
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User
    });

    expect(storage.getItem("empty-session")).toBeNull();
  });

  it("clears schema-invalid restored React sessions", () => {
    const storage = createMemoryStorage();

    storage.setItem("invalid-session", JSON.stringify({
      tokens: {
        accessToken: "stored-token"
      },
      user: {
        id: 123
      }
    }));

    const session = createReactTokenSession<TestUser, TestTokens>({
      storage,
      storageKey: "invalid-session",
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User
    });

    expect(session.get()).toEqual({});
    expect(storage.getItem("invalid-session")).toBeNull();
  });

  it("clears schema-invalid array React sessions", () => {
    const storage = createMemoryStorage();

    storage.setItem("array-session", "[]");

    const session = createReactTokenSession<TestUser, TestTokens>({
      storage,
      storageKey: "array-session",
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User
    });

    expect(session.get()).toEqual({});
    expect(storage.getItem("array-session")).toBeNull();
  });

  it("rejects schema-invalid React session set writes", async () => {
    const storage = createMemoryStorage();
    const session = createReactTokenSession<TestUser, TestTokens>({
      storage,
      storageKey: "invalid-set-session",
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User
    });

    await expect(session.set({
      tokens: {
        accessToken: ""
      },
      user: {
        id: "user-1"
      }
    })).rejects.toMatchObject({
      reason: "invalid_token"
    } satisfies Partial<TokenSessionError>);
    expect(session.get()).toEqual({});
    expect(storage.getItem("invalid-set-session")).toBeNull();
  });

  it("rejects schema-invalid React updateUser writes without changing storage", async () => {
    const storage = createMemoryStorage();
    const session = createReactTokenSession<TestUser, TestTokens>({
      storage,
      storageKey: "invalid-user-session",
      tokenSchema: Tokens,
      useRefreshToken: false,
      userSchema : User
    });

    await session.set({
      tokens: {
        accessToken: "valid-token"
      },
      user: {
        id: "user-1"
      }
    });
    const storedSession = storage.getItem("invalid-user-session");

    await expect(session.updateUser({
      id: 123
    } as unknown as TestUser)).rejects.toMatchObject({
      reason: "unauthorized"
    } satisfies Partial<TokenSessionError>);
    expect(session.get().user).toEqual({
      id: "user-1"
    });
    expect(storage.getItem("invalid-user-session")).toBe(storedSession);
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

const createStorageEventHarness = () => {
  const listeners = new Set<(event: unknown) => void>();
  const addEventListener = vi.fn((
    _type: "storage",
    listener: (event: unknown) => void
  ) => {
    listeners.add(listener);
  });
  const removeEventListener = vi.fn((
    _type: "storage",
    listener: (event: unknown) => void
  ) => {
    listeners.delete(listener);
  });

  return {
    addEventListener,
    dispatch: (event: unknown) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
    removeEventListener
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
