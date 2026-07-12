import { describe, expect, it } from "vitest";

import {
  EnvMissingError,
  env,
  envSchema,
  getEnv,
  getEnvBoolean,
  getEnvNumber,
  normalizeEnvSource,
  parseEnv,
  requireEnv,
  safeParseEnv,
  z
} from "../src/env/index.js";

describe("env module", () => {
  it("reads string values with fallbacks", () => {
    const source = {
      API_URL: "https://api.example.com",
      EMPTY  : "",
      ENABLED: true
    };

    expect(getEnv("API_URL", { source })).toBe("https://api.example.com");
    expect(getEnv("ENABLED", { source })).toBe("true");
    expect(getEnv("MISSING", { fallback: "development", source })).toBe("development");
    expect(getEnv("EMPTY", { fallback: "fallback", source })).toBe("");
    expect(env.get("API_URL", { source })).toBe("https://api.example.com");
  });

  it("requires present non-empty values", () => {
    const source = {
      API_URL: "https://api.example.com",
      EMPTY  : ""
    };

    expect(requireEnv("API_URL", { source })).toBe("https://api.example.com");
    expect(requireEnv("EMPTY", { allowEmpty: true, source })).toBe("");
    expect(() => requireEnv("EMPTY", { source })).toThrow(EnvMissingError);
    expect(() => requireEnv("MISSING", { source })).toThrow("Missing required environment variable: MISSING");
    expect(env.require("API_URL", { source })).toBe("https://api.example.com");
  });

  it("reads numbers and booleans", () => {
    const source = {
      DEBUG_FALSE: "false",
      DEBUG_TRUE : "on",
      INVALID    : "nope",
      PORT       : " 4000 ",
      ZERO       : "0"
    };

    expect(getEnvNumber("PORT", { source })).toBe(4000);
    expect(getEnvNumber("INVALID", { fallback: 3000, source })).toBe(3000);
    expect(getEnvBoolean("DEBUG_TRUE", { source })).toBe(true);
    expect(getEnvBoolean("DEBUG_FALSE", { source })).toBe(false);
    expect(getEnvBoolean("ZERO", { fallback: true, source })).toBe(false);
    expect(getEnvBoolean("INVALID", { fallback: false, source })).toBe(false);
    expect(env.number("PORT", { source })).toBe(4000);
    expect(env.boolean("DEBUG_FALSE", { source })).toBe(false);
  });

  it("rejects unsafe injected bigint numbers before string conversion", () => {
    const source = {
      COUNT: 9_007_199_254_740_993n,
      PORT : 4_000n
    };

    expect(getEnvNumber("PORT", { source })).toBe(4_000);
    expect(getEnvNumber("COUNT", { source })).toBeUndefined();
    expect(getEnvNumber("COUNT", { fallback: 3_000, source })).toBe(3_000);
    expect(getEnv("COUNT", { source })).toBe("9007199254740993");
  });

  it("keeps injected raw boolean values aligned with schema parsing", () => {
    const source = {
      BIGINT     : 2n,
      BIGINT_ZERO: 0n,
      NUMBER     : 2,
      RAW_FALSE  : false,
      RAW_TRUE   : true
    };

    expect(getEnvBoolean("NUMBER", { source })).toBe(true);
    expect(getEnvBoolean("BIGINT", { source })).toBe(true);
    expect(getEnvBoolean("BIGINT_ZERO", { source })).toBe(false);
    expect(getEnvBoolean("RAW_TRUE", { source })).toBe(true);
    expect(getEnvBoolean("RAW_FALSE", { source })).toBe(false);
  });

  it("parses typed environment config with schema helpers", () => {
    const Config = z.object({
      API_URL: envSchema.string(),
      DEBUG  : envSchema.boolean().default(false),
      FLAGS  : envSchema.json(z.array(z.string())),
      PORT   : envSchema.number().default(3000)
    });

    const config = parseEnv(Config, {
      API_URL: " https://api.example.com ",
      DEBUG  : "false",
      FLAGS  : "[\"a\",\"b\"]",
      PORT   : "4000"
    });

    expect(config).toEqual({
      API_URL: "https://api.example.com",
      DEBUG  : false,
      FLAGS  : ["a", "b"],
      PORT   : 4000
    });
    expect(env.parse(Config, {
      API_URL: "https://api.example.com",
      FLAGS  : "[]"
    })).toEqual({
      API_URL: "https://api.example.com",
      DEBUG  : false,
      FLAGS  : [],
      PORT   : 3000
    });
  });

  it("returns safe parse results", () => {
    const Config = z.object({
      API_URL: envSchema.string()
    });

    expect(safeParseEnv(Config, {
      API_URL: "https://api.example.com"
    }).success).toBe(true);
    expect(safeParseEnv(Config, {
      API_URL: ""
    }).success).toBe(false);
    expect(env.safeParse(Config, {
      API_URL: "https://api.example.com"
    }).success).toBe(true);
  });

  it("normalizes env sources without undefined values", () => {
    expect(normalizeEnvSource({
      A: "1",
      B: undefined,
      C: null
    })).toEqual({
      A: "1",
      C: null
    });
  });
});
