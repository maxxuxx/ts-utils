/** Represents jwt object */
export type JwtObject = Record<string, unknown>;

/** Represents jwt header */
export type JwtHeader = JwtObject & {
  alg?: string;
  typ?: string;
  kid?: string;
};

/** Payload shape for jwt */
export type JwtPayload = JwtObject & {
  exp?: number;
  iat?: number;
  jti?: string;
  nbf?: number;
  sub?: string;
};

/** Represents jwt payload with token */
export type JwtPayloadWithToken<TPayload extends JwtPayload = JwtPayload> =
  TPayload & {
    token: string;
  };

/** Represents jwt clock input */
export type JwtClockInput = Date | number;

/** Options for jwt expiration */
export type JwtExpirationOptions = Readonly<{
  now?: JwtClockInput;
  withinSeconds?: number;
}>;

/** Represents jwt expiration input */
export type JwtExpirationInput = JwtExpirationOptions | number;

/** Result returned by jwt */
export type JwtResult<TData, TError = unknown> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: TError;
    };

type BufferLike = {
  toString: (encoding?: string) => string;
};

type BufferConstructorLike = {
  from: (value: string, encoding?: string) => BufferLike;
};

type JwtGlobal = typeof globalThis & {
  Buffer?: BufferConstructorLike;
};

/** Error raised for jwt decode failures */
export class JwtDecodeError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown, message = "JWT could not be decoded") {
    super(message);

    this.name  = "JwtDecodeError";
    this.cause = cause;
  }
}

// Result helpers
const createSuccess = <TData>(data: TData): {
  ok: true;
  data: TData;
} => ({
  data,
  ok: true
});

const createFailure = <TError>(error: TError): {
  ok: false;
  error: TError;
} => ({
  error,
  ok: false
});

// Decode helpers
/** Decodes jwt */
export const decodeJwt = <TPayload extends JwtPayload = JwtPayload>(
  token: string
): JwtPayloadWithToken<TPayload> | null => {
  const result = safeDecodeJwt<TPayload>(token);

  return result.ok ? result.data : null;
};

/** Safely decodes jwt */
export const safeDecodeJwt = <TPayload extends JwtPayload = JwtPayload>(
  token: string | null | undefined
): JwtResult<JwtPayloadWithToken<TPayload>, JwtDecodeError> => {
  try {
    const payload = decodeJwtSegment<TPayload>(getJwtSegment(token, 1));

    return createSuccess({
      ...payload,
      token: readJwtToken(token)
    });
  } catch (error) {
    return createFailure(new JwtDecodeError(error));
  }
};

/** Decodes jwt header */
export const decodeJwtHeader = <THeader extends JwtHeader = JwtHeader>(
  token: string
): THeader | null => {
  const result = safeDecodeJwtHeader<THeader>(token);

  return result.ok ? result.data : null;
};

/** Safely decodes jwt header */
export const safeDecodeJwtHeader = <THeader extends JwtHeader = JwtHeader>(
  token: string | null | undefined
): JwtResult<THeader, JwtDecodeError> => {
  try {
    return createSuccess(decodeJwtSegment<THeader>(getJwtSegment(token, 0)));
  } catch (error) {
    return createFailure(new JwtDecodeError(error));
  }
};

// Expiration helpers
/** Checks whether a value is jwt expired */
export const isJwtExpired = (
  token: string | null | undefined,
  options: JwtExpirationInput = 0
): boolean => {
  const result = safeDecodeJwt(token);
  const expirationOptions = resolveExpirationOptions(options);

  if (!result.ok || !isNumericDate(result.data.exp)) {
    return true;
  }

  return result.data.exp * 1000 <= resolveNowMs(expirationOptions.now) + resolveWithinMs(expirationOptions);
};

// Segment helpers
const readJwtToken = (token: string | null | undefined): string => {
  if (typeof token !== "string" || !token.trim()) {
    throw new TypeError("JWT must be a non-empty string");
  }

  return token;
};

const getJwtSegment = (
  token: string | null | undefined,
  index: number
): string => {
  const value = readJwtToken(token);
  const parts = value.split(".");

  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    throw new TypeError("JWT must contain header, payload, and signature segments");
  }

  return parts[index] ?? "";
};

const decodeJwtSegment = <TValue extends JwtObject>(segment: string): TValue => {
  const value = JSON.parse(decodeBase64Url(segment)) as unknown;

  if (!isJwtObject(value)) {
    throw new TypeError("JWT segment must decode to an object");
  }

  return value as TValue;
};

const decodeBase64Url = (value: string): string => {
  const base64 = normalizeBase64Url(value);
  const buffer = getBuffer();

  if (buffer) {
    return buffer.from(base64, "base64").toString("utf8");
  }

  return decodeURIComponent(
    Array.from(atob(base64), (char) => (
      `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`
    )).join("")
  );
};

const normalizeBase64Url = (value: string): string => {
  const normalized = value
    .replace(/-/gu, "+")
    .replace(/_/gu, "/");
  const paddingLength = (4 - normalized.length % 4) % 4;

  return `${normalized}${"=".repeat(paddingLength)}`;
};

const getBuffer = (): BufferConstructorLike | undefined => (
  (globalThis as JwtGlobal).Buffer
);

const isJwtObject = (value: unknown): value is JwtObject => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const isNumericDate = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value)
);

const resolveNowMs = (now: JwtClockInput | undefined): number => {
  const value = now instanceof Date
    ? now.getTime()
    : typeof now === "number" ? now : Date.now();

  return Number.isFinite(value) ? value : Date.now();
};

const resolveExpirationOptions = (options: JwtExpirationInput): JwtExpirationOptions => (
  typeof options === "number" ? {
    withinSeconds: options
  } : options
);

const resolveWithinMs = (options: JwtExpirationOptions): number => {
  const seconds = options.withinSeconds ?? 0;

  return Number.isFinite(seconds) ? Math.max(0, seconds) * 1000 : 0;
};

/** Grouped helpers for the jwt module */
export const jwt = Object.freeze({
  decode      : decodeJwt,
  decodeHeader: decodeJwtHeader,
  isExpired   : isJwtExpired,
  safeDecode  : safeDecodeJwt,
  safeHeader  : safeDecodeJwtHeader
});
