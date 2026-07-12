import {
  safeDecodeJwtWithSchema,
  type JwtPayload,
  type JwtPayloadWithToken
} from "../jwt/index.js";
import { createSingleFlight } from "../promise/index.js";
import type {
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

/** Error raised for token session failures */
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
/** Creates token session */
export const createTokenSession = <
  TContext,
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
>(
  options: TokenSessionOptions<TContext, TUser, TTokens, TClaims>
): TokenSessionController<TContext, TUser, TTokens> => (
  createTokenSessionController(options, true)
);

/** @internal Creates a token session for framework stores that already validate every stored snapshot */
export const createTokenSessionFromValidatedStore = <
  TContext,
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
>(
  options: TokenSessionOptions<TContext, TUser, TTokens, TClaims>
): TokenSessionController<TContext, TUser, TTokens> => (
  createTokenSessionController(options, false)
);

const createTokenSessionController = <
  TContext,
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
>(
  options: TokenSessionOptions<TContext, TUser, TTokens, TClaims>,
  parseStoreReads: boolean
): TokenSessionController<TContext, TUser, TTokens> => {
  const useRefreshToken = options.useRefreshToken ?? true;
  const {
    parseSession,
    parseTokens,
    parseUser
  } = createTokenSessionParsers(options);
  const mutationQueue = createContextMutationQueue<TContext>();
  const refreshSingleFlight = createSingleFlight<string, TTokens>({
    successTtlMs: resolveRefreshCacheMs(options.dedupeRefresh)
  });
  const writeParsedSession = async (
    context: TContext,
    session: TokenSessionData<TUser, TTokens>
  ): Promise<void> => {
    await options.write(context, session);
  };
  const writeSession = async (
    context: TContext,
    session: TokenSessionData<TUser, TTokens>
  ): Promise<void> => {
    await writeParsedSession(context, parseSession(session));
  };
  const readSession = async (context: TContext) => {
    const storedSession = await options.read(context);

    return {
      session: parseStoreReads
        ? parseSession(storedSession)
        : storedSession,
      storedSession
    };
  };

  const readClaims = (accessToken: string): JwtPayloadWithToken<TClaims> | null => {
    const schema = options.jwtSchema;

    if (!schema) {
      return null;
    }

    const decoded = safeDecodeJwtWithSchema(accessToken, {
      parse: (value) => parseSchema(value, schema, "invalid_token")
    });

    if (!decoded.ok) {
      throw createSessionError("invalid_token", decoded.error);
    }

    return decoded.data;
  };
  const readEnsuredUser = async (context: TContext): Promise<TUser> => {
    const { session }  = await readSession(context);
    const user         = requireUser(session.user);
    const tokens       = requireTokens(session.tokens);
    const accessToken  = readAccessToken(tokens);
    const refreshToken = readRefreshToken(tokens);

    if (!accessToken || (useRefreshToken && !refreshToken)) {
      throw createSessionError("invalid_token");
    }

    const claims = readClaims(accessToken);

    if (claims && isExpired(claims, options.now)) {
      throw createSessionError("expired");
    }

    return user;
  };

  const refresh = async (context: TContext): Promise<string> => {
    const {
      session,
      storedSession
    } = await readSession(context);
    const tokenIdentity  = readTokenIdentity(storedSession);
    const user           = requireUser(session.user);
    const tokens         = requireTokens(session.tokens);
    const accessToken   = readAccessToken(tokens);
    const refreshToken  = readRefreshToken(tokens);
    const refreshTokens = options.refreshTokens;

    if (!useRefreshToken || !accessToken || !refreshToken || !refreshTokens) {
      throw createSessionError("invalid_token");
    }

    const claims = readClaims(accessToken);
    const refreshContext       = {
      claims,
      context,
      refreshToken,
      session,
      tokens,
      user
    };
    const refreshGenerationKey = createRefreshGenerationKey(tokenIdentity);
    const executeRefresh       = async (): Promise<TTokens> => {
      const nextTokens      = parseTokens(await refreshTokens(refreshToken, refreshContext));
      const nextAccessToken = readAccessToken(nextTokens);

      if (!nextAccessToken) {
        throw createSessionError("invalid_token");
      }

      readClaims(nextAccessToken);

      return nextTokens;
    };
    let nextTokens: TTokens;

    try {
      nextTokens = options.dedupeRefresh === false
        ? await executeRefresh()
        : await refreshSingleFlight.run(
          refreshGenerationKey,
          executeRefresh
        );
    } catch (error) {
      return mutationQueue.run(context, async () => {
        const {
          session: currentSession,
          storedSession: currentStoredSession
        } = await readSession(context);
        const currentTokenIdentity = readTokenIdentity(currentStoredSession);

        if (!hasSameTokenIdentity(tokenIdentity, currentTokenIdentity)) {
          const currentAccessToken = readAccessToken(currentSession.tokens);

          if (currentAccessToken) {
            readClaims(currentAccessToken);

            return currentAccessToken;
          }

          throw createSessionError("invalid_token");
        }

        throw error;
      });
    }

    return mutationQueue.run(context, async () => {
      const {
        session: currentSession,
        storedSession: currentStoredSession
      } = await readSession(context);
      const currentTokenIdentity = readTokenIdentity(currentStoredSession);

      if (!hasSameTokenIdentity(
        tokenIdentity,
        currentTokenIdentity
      )) {
        const currentAccessToken = readAccessToken(currentSession.tokens);

        if (currentAccessToken) {
          readClaims(currentAccessToken);

          return currentAccessToken;
        }

        throw createSessionError("invalid_token");
      }

      const currentUser = requireUser(currentSession.user);

      await writeParsedSession(context, {
        ...currentSession,
        tokens: nextTokens,
        user  : currentUser
      });

      return readAccessToken(nextTokens) ?? "";
    });
  };

  const ensure = async (context: TContext): Promise<TUser> => {
    const { session }  = await readSession(context);
    const user         = requireUser(session.user);
    const tokens       = requireTokens(session.tokens);
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

        return readEnsuredUser(context);
      }

      throw createSessionError("expired");
    }

    if (isExpiringSoon(claims, options.refreshThresholdSeconds, options.now)
      && useRefreshToken
      && refreshToken
      && options.refreshTokens) {
      await refresh(context);

      return readEnsuredUser(context);
    }

    return user;
  };

  return Object.freeze({
    clear: async (context) => {
      await mutationQueue.run(context, () => options.clear(context));
    },
    ensure,
    get: async (context) => (await readSession(context)).session,
    getAccessToken: async (context) => {
      const { session } = await readSession(context);

      return readAccessToken(session.tokens);
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
      await mutationQueue.run(context, () => writeSession(context, session));
    },
    updateUser: async (context, user) => {
      await mutationQueue.run(context, async () => {
        const { session } = await readSession(context);
        const nextUser = parseUser(user);

        await writeParsedSession(context, {
          ...session,
          user: nextUser
        });
      });
    }
  });
};

// Mutation helpers
const createContextMutationQueue = <TContext>() => {
  const tails = new Map<TContext, Promise<void>>();

  const run = <TValue>(
    context: TContext,
    mutation: () => PromiseLike<TValue> | TValue
  ): Promise<TValue> => {
    const previous = tails.get(context) ?? Promise.resolve();
    const result   = previous.then(mutation);
    const tail     = result.then(
      () => undefined,
      () => undefined
    );

    tails.set(context, tail);
    void tail.then(() => {
      if (tails.get(context) === tail) {
        tails.delete(context);
      }
    });

    return result;
  };

  return { run };
};

// Parsing helpers
type TokenSessionParserOptions<
  TUser,
  TTokens extends TokenSessionTokens
> = Readonly<{
  tokenSchema?: SafeSchema<TTokens>;
  userSchema ?: SafeSchema<TUser>;
}>;

/** Creates the shared schema parser used by core and framework session adapters */
export const createTokenSessionParsers = <
  TUser,
  TTokens extends TokenSessionTokens
>(
  options: TokenSessionParserOptions<TUser, TTokens>
) => {
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

  const parseSession = (
    value: unknown
  ): TokenSessionData<TUser, TTokens> => {
    if (!isRecord(value)) {
      throw createSessionError("invalid");
    }

    return {
      ...(value.tokens === undefined ? {} : {
        tokens: parseTokens(value.tokens)
      }),
      ...(value.user === undefined ? {} : {
        user: parseUser(value.user)
      })
    };
  };

  return {
    parseSession,
    parseTokens,
    parseUser
  };
};

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

const requireUser = <TUser>(user: TUser | undefined): TUser => {
  if (user === null || user === undefined) {
    throw createSessionError("unauthorized");
  }

  return user;
};

const requireTokens = <TTokens extends TokenSessionTokens>(
  tokens: TTokens | undefined
): TTokens => {
  if (!tokens) {
    throw createSessionError("invalid_token");
  }

  return tokens;
};

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
  typeof value === "object" && value !== null && !Array.isArray(value)
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

  const decoded = safeDecodeJwtWithSchema(accessToken, {
    parse: (value) => parseSchema(value, schema, "invalid_token")
  });

  return decoded.ok;
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

type TokenIdentity = Readonly<{
  accessToken : string | undefined;
  refreshToken: string | undefined;
}>;

const readTokenIdentity = (session: unknown): TokenIdentity => {
  const tokens = isRecord(session) && isRecord(session.tokens)
    ? session.tokens
    : undefined;

  return {
    accessToken : readString(tokens?.accessToken),
    refreshToken: readString(tokens?.refreshToken)
  };
};

const hasSameTokenIdentity = (
  first: TokenIdentity,
  second: TokenIdentity
): boolean => (
  first.accessToken === second.accessToken
  && first.refreshToken === second.refreshToken
);

const createRefreshGenerationKey = (
  identity: TokenIdentity
): string => JSON.stringify([
  identity.accessToken,
  identity.refreshToken
]);

const readString = (value: unknown): string | undefined => (
  typeof value === "string" ? value : undefined
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
