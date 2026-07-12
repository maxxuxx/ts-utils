import type {
  JwtPayload,
  JwtPayloadWithToken
} from "../jwt/index.js";

// Shared result types
/** Allows a value or a promise of that value */
export type MaybePromise<TValue> = TValue | Promise<TValue>;

/** Result returned by safe parse */
export type SafeParseResult<TData> =
  | {
      success: true;
      data: TData;
    }
  | {
      success: false;
      error?: unknown;
    };

/** Schema contract for safe */
export type SafeSchema<TData> = Readonly<{
  safeParse: (value: unknown) => SafeParseResult<TData>;
}>;

// Session data
/** Allowed values for token session reason */
export const TokenSessionReason = {
  EXPIRED      : "expired",
  INVALID      : "invalid",
  INVALID_TOKEN: "invalid_token",
  UNAUTHORIZED : "unauthorized"
} as const;

/** Access and refresh token values stored in a token session */
export type TokenSessionTokens = Readonly<{
  accessToken?: string | null;
  refreshToken?: string | null;
}>;

/** User and token payload stored by a token session */
export type TokenSessionData<
  TUser,
  TTokens extends TokenSessionTokens
> = {
  tokens?: TTokens;
  user?: TUser;
};

/** Allowed reason value for token session */
export type TokenSessionReason =
  (typeof TokenSessionReason)[keyof typeof TokenSessionReason];

/** Storage adapter used by a token session controller */
export type TokenSessionStore<
  TContext,
  TUser,
  TTokens extends TokenSessionTokens
> = Readonly<{
  clear: (context: TContext) => MaybePromise<void>;
  read: (context: TContext) => MaybePromise<TokenSessionData<TUser, TTokens>>;
  write: (
    context: TContext,
    session: TokenSessionData<TUser, TTokens>
  ) => MaybePromise<void>;
}>;

/** Context passed to token refresh */
export type TokenRefreshContext<
  TContext,
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends object
> = Readonly<{
  claims: JwtPayloadWithToken<TClaims> | null;
  context: TContext;
  refreshToken: string;
  session: TokenSessionData<TUser, TTokens>;
  tokens: TTokens;
  user: TUser;
}>;

/** Options for token session refresh dedupe */
export type TokenSessionRefreshDedupeOptions = Readonly<{
  cacheSuccessMs?: number;
}>;

/** Options for token session */
export type TokenSessionOptions<
  TContext,
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends object = JwtPayload
> = TokenSessionStore<TContext, TUser, TTokens> & Readonly<{
  dedupeRefresh?: boolean | TokenSessionRefreshDedupeOptions;
  jwtSchema?: SafeSchema<TClaims>;
  now?: () => number;
  refreshThresholdSeconds?: number;
  refreshTokens?: (
    refreshToken: string,
    context: TokenRefreshContext<TContext, TUser, TTokens, TClaims>
  ) => MaybePromise<TTokens>;
  tokenSchema?: SafeSchema<TTokens>;
  useRefreshToken?: boolean;
  userSchema?: SafeSchema<TUser>;
}>;

/** Controller returned by createTokenSession */
export type TokenSessionController<
  TContext,
  TUser,
  TTokens extends TokenSessionTokens
> = Readonly<{
  clear: (context: TContext) => Promise<void>;
  ensure: (context: TContext) => Promise<TUser>;
  get: (context: TContext) => Promise<TokenSessionData<TUser, TTokens>>;
  getAccessToken: (context: TContext) => Promise<string | undefined>;
  parseTokens: (tokens: unknown) => Pick<TokenSessionData<TUser, TTokens>, "tokens"> | null;
  refresh: (context: TContext) => Promise<string>;
  set: (
    context: TContext,
    session: TokenSessionData<TUser, TTokens>
  ) => Promise<void>;
  updateUser: (context: TContext, user: TUser) => Promise<void>;
}>;
