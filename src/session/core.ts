import {
  safeDecodeJwt,
  type JwtPayload,
  type JwtPayloadWithToken
} from "../jwt/index.js";
import type {
  MaybePromise,
  SafeSchema,
  TokenSessionController,
  TokenSessionData,
  TokenSessionOptions,
  TokenSessionReason,
  TokenSessionRefreshDedupeOptions,
  TokenSessionTokens
} from "./types.js";

// Errors
const DEFAULT_REFRESH_CACHE_MS = 2_000;

const DEFAULT_ERROR_MESSAGES: Record<TokenSessionReason, string> = {
  expired      : "Session token expired",
  invalid      : "Session is invalid",
  invalid_token: "Session token is invalid",
  unauthorized : "Session is unauthorized"
};

type RefreshPromise = Promise<TokenSessionTokens>;

const refreshPromises = new Map<string, RefreshPromise>();

export class TokenSessionError extends Error {
  readonly cause: unknown;
  readonly reason: TokenSessionReason;

  constructor(reason: TokenSessionReason, cause?: unknown) {
    super(DEFAULT_ERROR_MESSAGES[reason]);

    this.name   = "TokenSessionError";
    this.cause  = cause;
    this.reason = reason;
  }
}

// Factory
export const createTokenSession = <
  TContext,
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
>(
  options: TokenSessionOptions<TContext, TUser, TTokens, TClaims>
): TokenSessionController<TContext, TUser, TTokens> => {
  const useRefreshToken = options.useRefreshToken ?? true;

  const parseUser = (value: unknown): TUser => {
    if (value === null || value === undefined) {
      throw createSessionError("unauthorized");
    }

    return parseSchema(value, options.userSchema, "unauthorized");
  };

  const parseTokens = (value: unknown): TTokens => {
    if (!isRecord(value)) {
      throw createSessionError("invalid_token");
    }

    const tokens = parseSchema(value, options.tokenSchema, "invalid_token");

    if (!readAccessToken(tokens)) {
      throw createSessionError("invalid_token");
    }

    return tokens;
  };

  const readClaims = (accessToken: string): JwtPayloadWithToken<TClaims> | null => {
    if (!options.jwtSchema) {
      return null;
    }

    const decoded = safeDecodeJwt<TClaims>(accessToken);

    if (!decoded.ok) {
      throw createSessionError("invalid_token", decoded.error);
    }

    const claims = parseSchema(
      decoded.data,
      options.jwtSchema,
      "invalid_token"
    );

    return {
      ...claims,
      token: accessToken
    };
  };

  const refresh = async (context: TContext): Promise<string> => {
    const session      = await options.read(context);
    const user         = parseUser(session.user);
    const tokens       = parseTokens(session.tokens);
    const accessToken  = readAccessToken(tokens);
    const refreshToken = readRefreshToken(tokens);
    const refreshTokens = options.refreshTokens;

    if (!useRefreshToken || !accessToken || !refreshToken || !refreshTokens) {
      throw createSessionError("invalid_token");
    }

    const claims = readClaims(accessToken);
    const refreshContext = {
      claims,
      context,
      refreshToken,
      session,
      tokens,
      user
    };
    const executeRefresh = async (): Promise<TTokens> => parseTokens(
      await refreshTokens(refreshToken, refreshContext)
    );
    const nextTokens = options.dedupeRefresh === false
      ? await executeRefresh()
      : await runRefreshOnce(
        refreshToken,
        executeRefresh,
        resolveRefreshCacheMs(options.dedupeRefresh)
      );

    await options.write(context, {
      ...session,
      tokens: nextTokens,
      user
    });

    return readAccessToken(nextTokens) ?? "";
  };

  const ensure = async (context: TContext): Promise<TUser> => {
    const session      = await options.read(context);
    const user         = parseUser(session.user);
    const tokens       = parseTokens(session.tokens);
    const accessToken  = readAccessToken(tokens);
    const refreshToken = readRefreshToken(tokens);

    if (!accessToken) {
      throw createSessionError("invalid_token");
    }

    if (useRefreshToken && !refreshToken) {
      throw createSessionError("invalid_token");
    }

    const claims = readClaims(accessToken);

    if (!claims) {
      return user;
    }

    if (isExpired(claims, options.now)) {
      if (useRefreshToken && refreshToken && options.refreshTokens) {
        await refresh(context);

        return user;
      }

      throw createSessionError("expired");
    }

    if (isExpiringSoon(claims, options.refreshThresholdSeconds, options.now)
      && useRefreshToken
      && refreshToken
      && options.refreshTokens) {
      await refresh(context);
    }

    return user;
  };

  return Object.freeze({
    clear: async (context) => {
      await options.clear(context);
    },
    ensure,
    get: async (context) => options.read(context),
    getAccessToken: async (context) => {
      const session = await options.read(context);
      const tokens  = parseTokensOrNull(session.tokens, {
        tokenSchema: options.tokenSchema
      });

      return readAccessToken(tokens);
    },
    parseTokens: (tokens) => {
      const parsedTokens = parseTokensOrNull(tokens, {
        jwtSchema          : options.jwtSchema,
        requireRefreshToken: useRefreshToken,
        tokenSchema        : options.tokenSchema
      });

      return parsedTokens ? { tokens: parsedTokens } : null;
    },
    refresh,
    set: async (context, session) => {
      await options.write(context, session);
    },
    updateUser: async (context, user) => {
      const session = await options.read(context);

      await options.write(context, {
        ...session,
        user
      });
    }
  });
};

// Parsing helpers
const parseSchema = <TData>(
  value: unknown,
  schema: SafeSchema<TData> | undefined,
  reason: TokenSessionReason
): TData => {
  if (!schema) {
    return value as TData;
  }

  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw createSessionError(reason, parsed.error);
  }

  return parsed.data;
};

const createSessionError = (
  reason: TokenSessionReason,
  cause?: unknown
): TokenSessionError => (
  new TokenSessionError(reason, cause)
);

const resolveRefreshCacheMs = (
  dedupeRefresh: boolean | TokenSessionRefreshDedupeOptions | undefined
): number => {
  if (dedupeRefresh === true || dedupeRefresh === undefined) {
    return DEFAULT_REFRESH_CACHE_MS;
  }

  if (dedupeRefresh === false) {
    return 0;
  }

  return dedupeRefresh.cacheSuccessMs ?? DEFAULT_REFRESH_CACHE_MS;
};

const runRefreshOnce = <TTokens extends TokenSessionTokens>(
  key: string,
  refresh: () => MaybePromise<TTokens>,
  cacheSuccessMs: number
): Promise<TTokens> => {
  const existing = refreshPromises.get(key);

  if (existing) {
    return existing as Promise<TTokens>;
  }

  const promise = Promise.resolve()
    .then(refresh)
    .then((tokens) => {
      if (cacheSuccessMs > 0) {
        setTimeout(() => {
          if (refreshPromises.get(key) === promise) {
            refreshPromises.delete(key);
          }
        }, cacheSuccessMs);
      } else {
        refreshPromises.delete(key);
      }

      return tokens;
    })
    .catch((error) => {
      refreshPromises.delete(key);
      throw error;
    });

  refreshPromises.set(key, promise);

  return promise;
};

const parseTokensOrNull = <
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload
>(
  value: unknown,
  options: Readonly<{
    jwtSchema?: SafeSchema<TClaims>;
    requireRefreshToken?: boolean;
    tokenSchema?: SafeSchema<TTokens>;
  }>
): TTokens | null => {
  if (!isRecord(value)) {
    return null;
  }

  const tokens = parseSchemaOrNull(value, options.tokenSchema);
  const accessToken = readAccessToken(tokens);

  if (!accessToken) {
    return null;
  }

  if (options.requireRefreshToken && !readRefreshToken(tokens)) {
    return null;
  }

  if (!hasValidClaims(accessToken, options.jwtSchema)) {
    return null;
  }

  return tokens;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const parseSchemaOrNull = <TData>(
  value: unknown,
  schema: SafeSchema<TData> | undefined
): TData | null => {
  if (!schema) {
    return value as TData;
  }

  const parsed = schema.safeParse(value);

  return parsed.success ? parsed.data : null;
};

const hasValidClaims = <TClaims extends JwtPayload>(
  accessToken: string,
  schema: SafeSchema<TClaims> | undefined
): boolean => {
  if (!schema) {
    return true;
  }

  const decoded = safeDecodeJwt<TClaims>(accessToken);

  if (!decoded.ok) {
    return false;
  }

  return schema.safeParse(decoded.data).success;
};

// Token helpers
const readAccessToken = (
  tokens: TokenSessionTokens | null | undefined
): string | undefined => (
  typeof tokens?.accessToken === "string" && tokens.accessToken.trim()
    ? tokens.accessToken
    : undefined
);

const readRefreshToken = (
  tokens: TokenSessionTokens | null | undefined
): string | undefined => (
  typeof tokens?.refreshToken === "string" && tokens.refreshToken.trim()
    ? tokens.refreshToken
    : undefined
);

// Expiration helpers
const isExpired = (
  claims: JwtPayload,
  now: (() => number) | undefined
): boolean => {
  if (!isNumericDate(claims.exp)) {
    return false;
  }

  return claims.exp * 1000 <= resolveNowMs(now);
};

const isExpiringSoon = (
  claims: JwtPayload,
  thresholdSeconds: number | undefined,
  now: (() => number) | undefined
): boolean => {
  if (!thresholdSeconds || !isNumericDate(claims.exp)) {
    return false;
  }

  return claims.exp * 1000 <= resolveNowMs(now) + Math.max(0, thresholdSeconds) * 1000;
};

const isNumericDate = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value)
);

const resolveNowMs = (now: (() => number) | undefined): number => {
  const value = now?.() ?? Date.now();

  return Number.isFinite(value) ? value : Date.now();
};
