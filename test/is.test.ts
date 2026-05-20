import { describe, expect, it } from "vitest";

import {
  hasOwn,
  is,
  isArray,
  isDefined,
  isEmpty,
  isFiniteNumber,
  isInteger,
  isNil,
  isNonEmptyArray,
  isNonEmptyString,
  isNumber,
  isPlainObject,
  isPrimitive,
  isPromiseLike,
  isRecord,
  isString,
  isValidDate
} from "../src/is/index.js";

describe("is module", () => {
  it("checks primitive values", () => {
    expect(isString("hello")).toBe(true);
    expect(isNonEmptyString(" hello ")).toBe(true);
    expect(isNonEmptyString(" ")).toBe(false);
    expect(isNumber(1)).toBe(true);
    expect(isNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isInteger(1.5)).toBe(false);
    expect(isNil(null)).toBe(true);
    expect(isNil(undefined)).toBe(true);
    expect(isPrimitive(Symbol("key"))).toBe(true);
  });

  it("narrows defined values", () => {
    const values: Array<string | null | undefined> = [
      "a",
      null,
      undefined,
      "b"
    ];

    const filtered = values.filter(isDefined);

    expect(filtered).toEqual(["a", "b"]);
  });

  it("checks object shapes", () => {
    const payload: unknown = {
      id: 1
    };

    expect(isPlainObject(payload)).toBe(true);
    expect(isRecord(payload)).toBe(true);
    expect(hasOwn(payload, "id")).toBe(true);
    expect(isPlainObject([])).toBe(false);
  });

  it("checks collections", () => {
    expect(isArray([1, 2])).toBe(true);
    expect(isNonEmptyArray([1])).toBe(true);
    expect(isNonEmptyArray([])).toBe(false);
    expect(is.map(new Map())).toBe(true);
    expect(is.set(new Set())).toBe(true);
    expect(is.weakMap(new WeakMap())).toBe(true);
    expect(is.weakSet(new WeakSet())).toBe(true);
  });

  it("checks built-in instances", () => {
    expect(isValidDate(new Date("2026-01-01"))).toBe(true);
    expect(isValidDate(new Date("invalid"))).toBe(false);
    expect(is.regExp(/test/)).toBe(true);
    expect(is.error(new Error("boom"))).toBe(true);
    expect(is.url(new URL("https://example.com"))).toBe(true);
  });

  it("checks common value states", () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty("")).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty(new Map())).toBe(true);
    expect(isEmpty({})).toBe(true);
    expect(isEmpty({ id: 1 })).toBe(false);
    expect(is.truthy("value")).toBe(true);
    expect(is.falsy(0)).toBe(true);
  });

  it("checks promise-like values", () => {
    expect(isPromiseLike(Promise.resolve(1))).toBe(true);
    expect(isPromiseLike({
      then: () => undefined
    })).toBe(true);
    expect(isPromiseLike({})).toBe(false);
  });
});
