import { decodeBase64UrlText } from "../encoding/base64url.js";
import { err, ok, type Result } from "../result/index.js";

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
export type JwtPayloadWithToken<TPayload extends JwtObject = JwtPayload> =
  Omit<TPayload, "token"> & {
    token: string;
  };

/** Schema contract used to validate decoded jwt values */
export type JwtSchema<TValue extends JwtObject> = Readonly<{
  parse: (value: unknown) => TValue;
}>;

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
export type JwtResult<TData, TError = unknown> = Result<TData, TError>;

/** Error raised for jwt decode failures */
export class JwtDecodeError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown, message = "JWT could not be decoded") {
    super(message);

    this.name  = "JwtDecodeError";
    this.cause = cause;
  }
}

// Decode helpers
/** Decodes jwt */
export const decodeJwt = (
  token: string
): JwtPayloadWithToken | null => {
  const result = safeDecodeJwt(token);

  return result.ok ? result.data : null;
};

/** Safely decodes jwt */
export const safeDecodeJwt = (
  token: string | null | undefined
): JwtResult<JwtPayloadWithToken, JwtDecodeError> => {
  try {
    const payload = decodeJwtSegment(getJwtSegment(token, 1)) as JwtPayload;

    return ok({
      ...payload,
      token: readJwtToken(token)
    });
  } catch (error) {
    return err(new JwtDecodeError(error));
  }
};

/** Decodes and validates jwt payload claims with a schema */
export const decodeJwtWithSchema = <TPayload extends JwtObject>(
  token: string,
  schema: JwtSchema<TPayload>
): JwtPayloadWithToken<TPayload> | null => {
  const result = safeDecodeJwtWithSchema(token, schema);

  return result.ok ? result.data : null;
};

/** Safely decodes and validates jwt payload claims with a schema */
export const safeDecodeJwtWithSchema = <TPayload extends JwtObject>(
  token: string | null | undefined,
  schema: JwtSchema<TPayload>
): JwtResult<JwtPayloadWithToken<TPayload>, JwtDecodeError> => {
  try {
    const payload = readPlainJwtObject(
      schema.parse(decodeJwtSegment(getJwtSegment(token, 1)))
    );

    return ok({
      ...payload,
      token: readJwtToken(token)
    });
  } catch (error) {
    return err(new JwtDecodeError(error));
  }
};

/** Decodes jwt header */
export const decodeJwtHeader = (
  token: string
): JwtHeader | null => {
  const result = safeDecodeJwtHeader(token);

  return result.ok ? result.data : null;
};

/** Safely decodes jwt header */
export const safeDecodeJwtHeader = (
  token: string | null | undefined
): JwtResult<JwtHeader, JwtDecodeError> => {
  try {
    return ok(decodeJwtSegment(getJwtSegment(token, 0)) as JwtHeader);
  } catch (error) {
    return err(new JwtDecodeError(error));
  }
};

/** Decodes and validates a jwt header with a schema */
export const decodeJwtHeaderWithSchema = <THeader extends JwtObject>(
  token: string,
  schema: JwtSchema<THeader>
): THeader | null => {
  const result = safeDecodeJwtHeaderWithSchema(token, schema);

  return result.ok ? result.data : null;
};

/** Safely decodes and validates a jwt header with a schema */
export const safeDecodeJwtHeaderWithSchema = <THeader extends JwtObject>(
  token: string | null | undefined,
  schema: JwtSchema<THeader>
): JwtResult<THeader, JwtDecodeError> => {
  try {
    return ok(readPlainJwtObject(
      schema.parse(decodeJwtSegment(getJwtSegment(token, 0)))
    ));
  } catch (error) {
    return err(new JwtDecodeError(error));
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

const decodeJwtSegment = (segment: string): JwtObject => {
  const value = JSON.parse(decodeBase64UrlText(segment)) as unknown;

  if (!isPlainJwtObject(value)) {
    throw new TypeError("JWT segment must decode to an object");
  }

  return value;
};

const readPlainJwtObject = <TValue extends JwtObject>(value: TValue): TValue => {
  if (!isPlainJwtObject(value)) {
    throw new TypeError("JWT schema must return a plain record");
  }

  return value;
};

const isPlainJwtObject = (value: unknown): value is JwtObject => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;

  return prototype === Object.prototype || prototype === null;
};

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
  decode                : decodeJwt,
  decodeHeader          : decodeJwtHeader,
  decodeHeaderWithSchema: decodeJwtHeaderWithSchema,
  decodeWithSchema      : decodeJwtWithSchema,
  isExpired             : isJwtExpired,
  safeDecode            : safeDecodeJwt,
  safeDecodeWithSchema  : safeDecodeJwtWithSchema,
  safeHeader            : safeDecodeJwtHeader,
  safeHeaderWithSchema  : safeDecodeJwtHeaderWithSchema
});
