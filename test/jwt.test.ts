import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  JwtDecodeError,
  decodeJwt,
  decodeJwtHeader,
  decodeJwtHeaderWithSchema,
  decodeJwtWithSchema,
  isJwtExpired,
  jwt,
  safeDecodeJwt,
  safeDecodeJwtHeader,
  safeDecodeJwtHeaderWithSchema,
  safeDecodeJwtWithSchema,
  type JwtPayloadWithToken,
  type JwtResult,
  type JwtSchema
} from "../src/jwt/index.js";

type TestClaims = {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
};

const readRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("object required");
  }

  return value as Record<string, unknown>;
};

const testClaimsSchema = {
  parse(value: unknown): TestClaims {
    const record = readRecord(value);

    if (
      typeof record.aud !== "string" ||
      typeof record.exp !== "number" ||
      typeof record.iat !== "number" ||
      typeof record.iss !== "string" ||
      typeof record.sub !== "string"
    ) {
      throw new TypeError("claims required");
    }

    return {
      aud: record.aud,
      exp: record.exp,
      iat: record.iat,
      iss: record.iss,
      sub: record.sub
    };
  }
} satisfies JwtSchema<TestClaims>;

const roleSchema = {
  parse(value: unknown) {
    const record = readRecord(value);

    if (typeof record.role !== "string") {
      throw new TypeError("role required");
    }

    return {
      role: record.role
    };
  }
} satisfies JwtSchema<{
  role: string;
}>;

const headerSchema = {
  parse(value: unknown) {
    const record = readRecord(value);

    if (typeof record.alg !== "string") {
      throw new TypeError("alg required");
    }

    return {
      algorithm: record.alg
    };
  }
} satisfies JwtSchema<{
  algorithm: string;
}>;

const encodeBase64Url = (value: unknown): string => (
  Buffer
    .from(JSON.stringify(value), "utf8")
    .toString("base64url")
);

const createToken = (payload: unknown, header: unknown = {
  alg: "HS256",
  typ: "JWT"
}): string => (
  `${encodeBase64Url(header)}.${encodeBase64Url(payload)}.signature`
);

describe("jwt module", () => {
  it("decodes JWT payload claims and preserves the original token", () => {
    const token = createToken({
      aud  : "paytech-delivery",
      exp  : 2_000_000_000,
      iat  : 1_700_000_000,
      iss  : "https://auth.example.com",
      sub  : "user-1"
    });
    const claims = decodeJwtWithSchema(token, testClaimsSchema);

    expect(claims).toEqual({
      aud  : "paytech-delivery",
      exp  : 2_000_000_000,
      iat  : 1_700_000_000,
      iss  : "https://auth.example.com",
      sub  : "user-1",
      token
    });
  });

  it("decodes JWT headers", () => {
    const token = createToken({
      sub: "user-1"
    }, {
      alg: "none",
      kid: "key-1",
      typ: "JWT"
    });

    expect(decodeJwtHeader(token)).toEqual({
      alg: "none",
      kid: "key-1",
      typ: "JWT"
    });
  });

  it("requires schemas to return typed custom payload and header values", () => {
    const token = createToken({
      role: "admin"
    }, {
      alg: "HS256",
      typ: "JWT"
    });
    const claims = decodeJwtWithSchema(token, roleSchema);
    const header = decodeJwtHeaderWithSchema(token, headerSchema);

    expect(claims).toEqual({
      role: "admin",
      token
    });
    expect(header).toEqual({
      algorithm: "HS256"
    });
    expect(jwt.decodeWithSchema(token, roleSchema)?.role).toBe("admin");
    expect(jwt.decodeHeaderWithSchema(token, headerSchema)?.algorithm).toBe("HS256");
    expect(jwt.safeDecodeWithSchema(token, roleSchema).ok).toBe(true);
    expect(jwt.safeHeaderWithSchema(token, headerSchema).ok).toBe(true);
    expectTypeOf(claims).toEqualTypeOf<JwtPayloadWithToken<{
      role: string;
    }> | null>();
    expectTypeOf(header).toEqualTypeOf<{
      algorithm: string;
    } | null>();
  });

  it("returns schema validation failures through safe JWT results", () => {
    const token         = createToken({ role: 1 }, { typ: "JWT" });
    const payloadResult = safeDecodeJwtWithSchema(token, roleSchema);
    const headerResult  = safeDecodeJwtHeaderWithSchema(token, headerSchema);

    expect(payloadResult.ok).toBe(false);
    expect(headerResult.ok).toBe(false);
    if (!payloadResult.ok) {
      expect(payloadResult.error).toBeInstanceOf(JwtDecodeError);
    }
    if (!headerResult.ok) {
      expect(headerResult.error).toBeInstanceOf(JwtDecodeError);
    }
  });

  it("keeps schema-free decoders on built-in JWT types", () => {
    const token         = createToken({ role: "admin" });
    const claims        = decodeJwt(token);
    const payloadResult = safeDecodeJwt(token);

    if (false) {
      // @ts-expect-error Custom claims require a schema-backed decoder
      decodeJwt<TestClaims>(token);
    }

    expectTypeOf(claims).toEqualTypeOf<JwtPayloadWithToken | null>();
    expectTypeOf(payloadResult).toEqualTypeOf<JwtResult<
      JwtPayloadWithToken,
      JwtDecodeError
    >>();
  });

  it("rejects invalid base64url identically with and without Node Buffer", () => {
    const token                     = createToken({ role: "admin" });
    const [header, payload]         = token.split(".");
    const invalidPayloadToken       = `${header}.${payload}$.signature`;
    const invalidHeaderToken        = `${header}$.${payload}.signature`;
    const nodePayloadResult         = safeDecodeJwt(invalidPayloadToken);
    const nodeHeaderResult          = safeDecodeJwtHeader(invalidHeaderToken);

    expect(nodePayloadResult.ok).toBe(false);
    expect(nodeHeaderResult.ok).toBe(false);

    vi.stubGlobal("Buffer", undefined);

    try {
      expect(safeDecodeJwt(token).ok).toBe(true);
      expect(safeDecodeJwt(invalidPayloadToken).ok).toBe(false);
      expect(safeDecodeJwtHeader(invalidHeaderToken).ok).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwt("bad-token")).toBeNull();
    expect(decodeJwt(createToken([]))).toBeNull();
    expect(decodeJwtHeader(createToken({
      sub: "user-1"
    }, []))).toBeNull();
  });

  it("returns safe decode errors", () => {
    const result = safeDecodeJwt("bad-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(JwtDecodeError);
    }

    const headerResult = safeDecodeJwtHeader("bad-token");

    expect(headerResult.ok).toBe(false);
    if (!headerResult.ok) {
      expect(headerResult.error).toBeInstanceOf(JwtDecodeError);
    }
  });

  it("checks JWT expiration using the exp claim", () => {
    const nowSeconds = 1_700_000_000;
    const nowMs      = nowSeconds * 1000;

    expect(isJwtExpired(createToken({
      exp: nowSeconds - 1
    }), {
      now: nowMs
    })).toBe(true);

    expect(isJwtExpired(createToken({
      exp: nowSeconds
    }), {
      now: nowMs
    })).toBe(true);

    expect(isJwtExpired(createToken({
      exp: nowSeconds + 1
    }), {
      now: nowMs
    })).toBe(false);
  });

  it("supports a future expiration window when checking JWT expiration", () => {
    const nowSeconds = 1_700_000_000;

    expect(isJwtExpired(createToken({
      exp: nowSeconds + 5
    }), {
      now          : new Date(nowSeconds * 1000),
      withinSeconds: 10
    })).toBe(true);

    expect(isJwtExpired(createToken({
      exp: nowSeconds + 15
    }), {
      now          : new Date(nowSeconds * 1000),
      withinSeconds: 10
    })).toBe(false);

    expect(isJwtExpired(createToken({
      exp: Math.floor(Date.now() / 1000) + 5
    }), 10)).toBe(true);
  });

  it("treats malformed tokens and missing exp claims as expired", () => {
    expect(isJwtExpired("bad-token")).toBe(true);
    expect(isJwtExpired(createToken({
      sub: "user-1"
    }))).toBe(true);
    expect(isJwtExpired(createToken({
      exp: Number.NaN
    }))).toBe(true);
  });

  it("provides grouped namespace helpers", () => {
    const token = createToken({
      exp: 2_000_000_000,
      sub: "user-1"
    });

    expect(jwt.decode(token)?.sub).toBe("user-1");
    expect(jwt.decodeHeader(token)?.typ).toBe("JWT");
    expect(jwt.isExpired(token, {
      now          : 1_700_000_000_000,
      withinSeconds: 30
    })).toBe(false);
    expect(jwt.safeDecode(token).ok).toBe(true);
    expect(jwt.safeHeader(token).ok).toBe(true);
  });
});
