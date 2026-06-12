import type {
  JwtPayload,
  JwtPayloadWithToken
} from "../jwt/index.js";

// Shared result types
export type MaybePromise<TValue> = TValue | Promise<TValue>;

export type SafeParseResult<TData> =
  | {
      success: true;
      data: TData;
    }
  | {
      success: false;
      error?: unknown;
    };

export type SafeSchema<TData> = Readonly<{
  safeParse: (value: unknown) => SafeParseResult<TData>;
}>;

// Session data
export type TokenSessionMode = "access-token" | "refresh-token";

export type TokenSessionTokens = Readonly<{
  accessToken?: string | null;
  refreshToken?: string | null;
}>;

export type TokenSessionData<
  TUser,
  TTokens extends TokenSessionTokens
> = {
  tokens?: TTokens;
  user?: TUser;
};

export type TokenSessionReason =
  | "expired"
  | "invalid_token"
  | "unauthorized";

export type TokenSessionStore<
  TContext,
  TUser,
  TTokens extends TokenSessionTokens
> = Readonly<{
  clearSession: (context: TContext) => MaybePromise<void>;
  readSession: (context: TContext) => MaybePromise<TokenSessionData<TUser, TTokens>>;
  writeSession: (
    context: TContext,
    session: TokenSessionData<TUser, TTokens>
  ) => MaybePromise<void>;
}>;

export type TokenRefreshContext<
  TContext,
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload
> = Readonly<{
  claims: JwtPayloadWithToken<TClaims> | null;
  context: TContext;
  refreshToken: string;
  session: TokenSessionData<TUser, TTokens>;
  tokens: TTokens;
  user: TUser;
}>;

export type TokenSessionOptions<
  TContext,
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
> = TokenSessionStore<TContext, TUser, TTokens> & Readonly<{
  jwtSchema?: SafeSchema<TClaims>;
  mode?: TokenSessionMode;
  now?: () => number;
  refreshThresholdSeconds?: number;
  refreshTokens?: (
    refreshToken: string,
    context: TokenRefreshContext<TContext, TUser, TTokens, TClaims>
  ) => MaybePromise<TTokens>;
  tokenSchema?: SafeSchema<TTokens>;
  userSchema?: SafeSchema<TUser>;
}>;

export type TokenSessionController<
  TContext,
  TUser,
  TTokens extends TokenSessionTokens
> = Readonly<{
  clearSession: (context: TContext) => Promise<void>;
  ensureSession: (context: TContext) => Promise<TUser>;
  getAccessToken: (context: TContext) => Promise<string | undefined>;
  getSession: (context: TContext) => Promise<TokenSessionData<TUser, TTokens>>;
  parseTokenData: (tokens: unknown) => Pick<TokenSessionData<TUser, TTokens>, "tokens"> | null;
  refreshSession: (context: TContext) => Promise<string>;
  setSession: (
    context: TContext,
    session: TokenSessionData<TUser, TTokens>
  ) => Promise<void>;
  updateUser: (context: TContext, user: TUser) => Promise<void>;
}>;
