import { describe, expect, it } from "vitest";

import { z } from "../src/parser/index.js";
import {
  JsonParseError,
  JsonStringifyError,
  isJsonValue,
  json,
  parseJson,
  parseJsonWithSchema,
  safeParseJson,
  safeParseJsonWithSchema,
  safeStringifyJson,
  stringifyJson
} from "../src/json/index.js";

describe("json module", () => {
  it("parses JSON safely", () => {
    expect(safeParseJson<{ id: number }>("{\"id\":1}")).toEqual({
      data: {
        id: 1
      },
      ok: true
    });

    const result = safeParseJson("{invalid");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(JsonParseError);
    }
  });

  it("uses explicit parse fallbacks", () => {
    expect(parseJson("bad", {
      fallback: {
        theme: "light"
      }
    })).toEqual({
      theme: "light"
    });
    expect(parseJson(null, {
      fallback: "missing"
    })).toBe("missing");
    expect(() => parseJson("bad")).toThrow(JsonParseError);
  });

  it("stringifies JSON safely", () => {
    expect(stringifyJson({
      id: 1,
      name: "haru"
    })).toBe("{\"id\":1,\"name\":\"haru\"}");
    expect(json.stringify({
      id: 1
    }, {
      space: 2
    })).toContain("\n");

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const result = safeStringifyJson(circular);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(JsonStringifyError);
    }
    expect(stringifyJson(circular, {
      fallback: "{}"
    })).toBe("{}");
  });

  it("treats undefined stringify results as failures", () => {
    const result = safeStringifyJson(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(JsonStringifyError);
    }
  });

  it("parses with schema validation", () => {
    const User = z.object({
      id  : z.number(),
      name: z.string()
    });

    expect(parseJsonWithSchema("{\"id\":1,\"name\":\"haru\"}", User)).toEqual({
      id  : 1,
      name: "haru"
    });
    expect(parseJsonWithSchema("{\"id\":\"bad\"}", User, {
      fallback: null
    })).toBeNull();

    const result = safeParseJsonWithSchema("{\"id\":1,\"name\":\"haru\"}", User);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const id: number = result.data.id;

      expect(id).toBe(1);
    }
  });

  it("checks JSON compatible values", () => {
    expect(isJsonValue({
      active: true,
      id    : 1,
      items : [null, "value"]
    })).toBe(true);
    expect(json.isValue(Number.NaN)).toBe(false);
    expect(json.isValue(new Date())).toBe(false);
    expect(json.isValue({
      value: undefined
    })).toBe(false);

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(json.isValue(circular)).toBe(false);
  });
});
