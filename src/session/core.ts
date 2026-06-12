import {
  safeDecodeJwt,
  type JwtPayload,
  type JwtPayloadWithToken
} from "../jwt/index.js";
import type {
  SafeSchema,
  TokenSessionController,
  TokenSessionData,
  TokenSessionOptions,
  TokenSessionReason,
  TokenSessionTokens
} from "./types.js";

// Errors
const DEFAULT_ERROR_MESSAGES: Record<TokenSessionReason, string> = {
  expired      : "Session token expired",
  invalid_token: "Session token is invalid",
  unauthorized : "Session is unauthorized"
};

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
  const createError = (
    reason: TokenSessionReason,
    cause?: unknown
  ): Error => (
    options.createError?.(reason, cause) ?? new TokenSessionError(reason, cause)
  );

  const parseUser = (value: unknown): TUser => {
    if (value === null || value === undefined) {
      throw createError("unauthorized");
    }

    return parseSchema(value, options.userSchema, "unauthorized", createError);
  };

  const parseTokens = (value: unknown): TTokens => {
    if (!isRecord(value)) {
      throw createError("invalid_token");
    }

    const tokens = parseSchema(value, options.tokenSchema, "invalid_token", createError);

    if (!readAccessToken(tokens)) {
      throw createError("invalid_token");
    }

    return tokens;
  };

  const readClaims = (accessToken: string): JwtPayloadWithToken<TClaims> | null => {
    if (!options.jwtSchema) {
      return null;
    }

    const decoded = safeDecodeJwt<TClaims>(accessToken);

    if (!decoded.ok) {
      throw createError("invalid_token", decoded.error);
    }

    const claims = parseSchema(
      decoded.data,
      options.jwtSchema,
      "invalid_token",
      createError
    );

    return {
      ...claims,
      token: accessToken
    };
  };

  const refreshSession = async (context: TContext): Promise<string> => {
    const session      = await options.readSession(context);
    const user         = parseUser(session.user);
    const tokens       = parseTokens(session.tokens);
    const accessToken  = readAccessToken(tokens);
    const refreshToken = readRefreshToken(tokens);

    if (!accessToken || !refreshToken || !options.refreshTokens) {
      throw createError("invalid_token");
    }

    const claims = readClaims(accessToken);
    const nextTokens = parseTokens(await options.refreshTokens(refreshToken, {
      claims,
      context,
      refreshToken,
      session,
      tokens,
      user
    }));

    await options.writeSession(context, {
      ...session,
      tokens: nextTokens,
      user
    });

    return readAccessToken(nextTokens) ?? "";
  };

  const ensureSession = async (context: TContext): Promise<TUser> => {
    const session      = await options.readSession(context);
    const user         = parseUser(session.user);
    const tokens       = parseTokens(session.tokens);
    const accessToken  = readAccessToken(tokens);
    const refreshToken = readRefreshToken(tokens);

    if (!accessToken) {
      throw createError("invalid_token");
    }

    if (requiresRefreshToken(options.mode, options.refreshTokens) && !refreshToken) {
      throw createError("invalid_token");
    }

    const claims = readClaims(accessToken);

    if (!claims) {
      return user;
    }

    if (isExpired(claims, options.now)) {
      if (refreshToken && options.refreshTokens) {
        await refreshSession(context);

        return user;
      }

      throw createError("expired");
    }

    if (isExpiringSoon(claims, options.refreshThresholdSeconds, options.now)
      && refreshToken
      && options.refreshTokens) {
      await refreshSession(context);
    }

    return user;
  };

  return Object.freeze({
    clearSession: async (context) => {
      await options.clearSession(context);
    },
    ensureSession,
    getAccessToken: async (context) => {
      const session = await options.readSession(context);
      const tokens  = parseTokensOrNull(session.tokens, options.tokenSchema);

      return readAccessToken(tokens);
    },
    getSession: async (context) => options.readSession(context),
    parseTokenData: (tokens) => {
      const parsedTokens = parseTokensOrNull(tokens, options.tokenSchema);

      return parsedTokens ? { tokens: parsedTokens } : null;
    },
    refreshSession,
    setSession: async (context, session) => {
      await options.writeSession(context, session);
    },
    updateUser: async (context, user) => {
      const session = await options.readSession(context);

      await options.writeSession(context, {
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
  reason: TokenSessionReason,
  createError: (reason: TokenSessionReason, cause?: unknown) => Error
): TData => {
  if (!schema) {
    return value as TData;
  }

  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw createError(reason, parsed.error);
  }

  return parsed.data;
};

const parseTokensOrNull = <TTokens extends TokenSessionTokens>(
  value: unknown,
  schema: SafeSchema<TTokens> | undefined
): TTokens | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (!schema) {
    return readAccessToken(value) ? value as TTokens : null;
  }

  const parsed = schema.safeParse(value);

  if (!parsed.success || !readAccessToken(parsed.data)) {
    return null;
  }

  return parsed.data;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

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

const requiresRefreshToken = (
  mode: TokenSessionOptions<unknown, unknown, TokenSessionTokens, JwtPayload>["mode"],
  refreshTokens: unknown
): boolean => (
  mode === "refresh-token"
  || (mode === undefined && refreshTokens !== undefined)
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
