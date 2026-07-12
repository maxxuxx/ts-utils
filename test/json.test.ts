import { describe, expect, expectTypeOf, it } from "vitest";

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
    const parsed = safeParseJson("{\"id\":1}");

    expect(parsed).toEqual({
      data: {
        id: 1
      },
      ok: true
    });
    if (parsed.ok) {
      expectTypeOf(parsed.data).toEqualTypeOf<unknown>();
    }

    const result = safeParseJson("{invalid");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(JsonParseError);
    }
  });

  it("requires schemas for caller-selected parsed types", () => {
    expectTypeOf(parseJson("{}")).toEqualTypeOf<unknown>();

    if (false) {
      // @ts-expect-error Typed output requires a schema-backed safe parser
      safeParseJson<{ id: number }>("{}");
      // @ts-expect-error Schema-free parsing has no parsed-value generic
      parseJson<{ id: number }, null>("bad", {
        fallback: null
      });
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

      expectTypeOf(result.data).toEqualTypeOf<{
        id: number;
        name: string;
      }>();
      expect(id).toBe(1);
    }
  });

  it("accepts shared object and array references", () => {
    const child = { value: 1 };
    const items = [1, "value"];

    expect.soft(isJsonValue({
      left : child,
      right: child
    })).toBe(true);
    expect.soft(isJsonValue([items, items])).toBe(true);
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
