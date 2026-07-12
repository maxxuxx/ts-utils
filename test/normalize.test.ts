import { describe, expect, it } from "vitest";

import {
  is,
  isNotEmptyString,
  isRecord,
  to,
  toDate,
  toDateString,
  toFlagBoolean,
  toNumber,
  toText
} from "../src/normalize/index.js";

describe("normalize module", () => {
  it("normalizes numbers with fallbacks", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber(" 3.5 ")).toBe(3.5);
    expect(toNumber(true)).toBe(1);
    expect(toNumber(false)).toBe(0);
    expect(toNumber(10n)).toBe(10);
    expect(toNumber("")).toBe(0);
    expect(toNumber("nope", -1)).toBe(-1);
    expect(to.number("7")).toBe(7);
  });

  it("normalizes text values with fallbacks", () => {
    expect(toText("hello")).toBe("hello");
    expect(toText(123)).toBe("123");
    expect(toText(null)).toBe("");
    expect(toText(undefined, "missing")).toBe("missing");
    expect(to.text(false)).toBe("false");
  });

  it("normalizes dates and date strings", () => {
    const source = new Date("2026-05-20T12:34:56.000Z");
    const date = toDate(source);

    expect(date).toEqual(source);
    expect(date).not.toBe(source);
    expect(toDate("not a date")).toBeUndefined();
    expect(toDate(Number.MAX_VALUE)).toBeUndefined();
    const fallback = new Date(0);

    expect(toDate(Number.MAX_VALUE, fallback)).toBe(fallback);
    expect(toDateString(new Date(2026, 4, 20, 12, 34, 56))).toBe("2026-05-20");
    expect(toDateString(new Date(2026, 4, 20, 12, 34, 56), "yyyy.mm.dd HH:MM")).toBe("2026.05.20 12:34");
    expect(toDateString("invalid", "yyyy-mm-dd", "n/a")).toBe("n/a");
    expect(toDateString(Number.MAX_VALUE, "yyyy-mm-dd", "invalid")).toBe("invalid");
    expect(to.dateString(source, "yyyy-mm-dd")).toBe("2026-05-20");
  });

  it("normalizes flag booleans", () => {
    expect(toFlagBoolean(true)).toBe(true);
    expect(toFlagBoolean("SALE", "SALE")).toBe(true);
    expect(toFlagBoolean("yes")).toBe(true);
    expect(toFlagBoolean("ON")).toBe(true);
    expect(toFlagBoolean("0")).toBe(false);
    expect(toFlagBoolean("off")).toBe(false);
    expect(toFlagBoolean("unknown", "Y", true)).toBe(true);
    expect(to.flagBoolean(2)).toBe(true);
  });

  it("checks short is helpers", () => {
    expect(isNotEmptyString(" value ")).toBe(true);
    expect(isNotEmptyString(" ")).toBe(false);
    expect(isRecord({ id: 1 })).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(new Date())).toBe(false);
    expect(is.notEmptyString("x")).toBe(true);
    expect(is.record({ ok: true })).toBe(true);
  });
});
