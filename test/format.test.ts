import { describe, expect, it } from "vitest";

import {
  format,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPhoneNumber,
  formatValueUnit
} from "../src/format/index.js";

describe("format module", () => {
  it("formats numbers", () => {
    expect(formatNumber(1234.5)).toBe("1,234.5");
    expect(formatNumber("1234.5", {
      maximumFractionDigits: 0
    })).toBe("1,235");
    expect(formatNumber("nope", {
      fallback: "n/a"
    })).toBe("n/a");
    expect(format.number(1000)).toBe("1,000");
  });

  it("returns fallback for invalid dates and unsafe bigints", () => {
    expect(formatNumber(new Date("bad"), {
      fallback: "n/a"
    })).toBe("n/a");
    expect(formatNumber(999999999999999999999999999999999999n, {
      fallback: "n/a"
    })).toBe("n/a");
  });

  it("formats currency", () => {
    expect(formatCurrency(12000)).toBe("12,000원");
    expect(formatCurrency("12.5", {
      maximumFractionDigits: 0,
      separator             : " ",
      unit                  : "개"
    })).toBe("13 개");
    expect(format.currency("bad", {
      fallback: "-"
    })).toBe("-");
  });

  it("formats phone numbers", () => {
    expect(formatPhoneNumber("01012345678")).toBe("010-1234-5678");
    expect(formatPhoneNumber("0212345678")).toBe("02-1234-5678");
    expect(formatPhoneNumber("0311234567")).toBe("031-123-4567");
    expect(formatPhoneNumber("15881234")).toBe("1588-1234");
    expect(formatPhoneNumber("99999999999")).toBe("99999999999");
    expect(format.phoneNumber("555", {
      fallback: "invalid"
    })).toBe("invalid");
  });

  it("formats dates", () => {
    expect(formatDate(new Date(2026, 4, 20, 12, 34, 56))).toBe("2026-05-20");
    expect(format.date(new Date(2026, 4, 20, 12, 34, 56), "yyyy.mm.dd HH:MM")).toBe("2026.05.20 12:34");
    expect(format.date("invalid", "yyyy-mm-dd", "n/a")).toBe("n/a");
  });

  it("formats value-unit labels", () => {
    expect(formatValueUnit(12.5, "kg")).toBe("12.5 kg");
    expect(formatValueUnit(12.5, "%", {
      maximumFractionDigits: 0,
      separator             : ""
    })).toBe("13%");
    expect(format.valueUnit("bad", "kg", {
      fallback: "-"
    })).toBe("-");
  });
});
