import { describe, expect, it } from "vitest";

import { createParser, parser, z } from "../src/parser/index.js";

describe("parser", () => {
  it("parses strict numbers", () => {
    expect(parser.number.parse(10)).toBe(10);
    expect(parser.number.safeParse("10").success).toBe(false);
  });

  it("narrows values with is", () => {
    const value: unknown = "hello";

    if (!parser.string.is(value)) {
      throw new Error("expected string");
    }

    const parsed: string = value;

    expect(parsed).toBe("hello");
  });

  it("coerces numbers when requested", () => {
    expect(parser.coerce.number.parse("12")).toBe(12);
    expect(parser.coerce.integer.parse("12")).toBe(12);
    expect(parser.coerce.number.safeParse("").success).toBe(false);
    expect(parser.coerce.integer.safeParse("12.5").success).toBe(false);
  });

  it("coerces boolean-like values explicitly", () => {
    expect(parser.coerce.boolean.parse("true")).toBe(true);
    expect(parser.coerce.boolean.parse("false")).toBe(false);
    expect(parser.coerce.boolean.parse("1")).toBe(true);
    expect(parser.coerce.boolean.parse("0")).toBe(false);
    expect(parser.coerce.boolean.parse("y")).toBe(true);
    expect(parser.coerce.boolean.parse("n")).toBe(false);
    expect(parser.coerce.boolean.parse("t")).toBe(true);
    expect(parser.coerce.boolean.parse("f")).toBe(false);
    expect(parser.coerce.boolean.parse(2)).toBe(true);
    expect(parser.coerce.boolean.safeParse("maybe").success).toBe(false);
  });

  it("builds optional and array parsers", () => {
    expect(parser.number.optional().parse(undefined)).toBeUndefined();
    expect(parser.number.array().parse([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("parses common project values", () => {
    expect(parser.id.parse("10")).toBe(10);
    expect(parser.id.safeParse("0").success).toBe(false);
    expect(parser.page.parse(undefined)).toBe(1);
    expect(parser.page.parse("2")).toBe(2);
    expect(parser.page.parse("")).toBe(1);
    expect(parser.limit.parse(undefined)).toBe(20);
    expect(parser.limit.safeParse("101").success).toBe(false);
    expect(parser.nonEmptyString.parse(" haru ")).toBe("haru");
    expect(parser.email.parse(" HARU@example.com ")).toBe("haru@example.com");
  });

  it("wraps custom zod schemas", () => {
    const User = createParser(z.object({
      id:   z.number(),
      name: z.string()
    }));

    expect(User.parse({ id: 1, name: "haru" })).toEqual({
      id:   1,
      name: "haru"
    });
  });
});
