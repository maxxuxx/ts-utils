import { describe, expect, it } from "vitest";

import {
  JwtDecodeError,
  decodeJwt,
  decodeJwtHeader,
  isJwtExpired,
  jwt,
  safeDecodeJwt,
  safeDecodeJwtHeader
} from "../src/jwt/index.js";

type TestClaims = {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
};

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
    const claims = decodeJwt<TestClaims>(token);

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
