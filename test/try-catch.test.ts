import { describe, expect, it } from "vitest";

import {
  getErrorMessage,
  normalizeError,
  tryCatch,
  tryCatchAsync,
  type Result
} from "../src/try-catch/index.js";

describe("tryCatch", () => {
  it("returns data for successful sync callbacks", () => {
    const result = tryCatch(() => 42);

    expect(result).toEqual({
      ok  : true,
      data: 42
    });

    if (!result.ok) {
      throw new Error("expected success");
    }

    const value: number = result.data;

    expect(value).toBe(42);
  });

  it("returns the original error for thrown sync callbacks", () => {
    const thrown = new Error("sync failed");
    const result = tryCatch(() => {
      throw thrown;
    });

    expect(result).toEqual({
      ok   : false,
      error: thrown
    });

    if (result.ok) {
      throw new Error("expected failure");
    }

    expect(result.error).toBe(thrown);
  });

  it("supports explicit result error types", () => {
    const thrown = {
      code   : "E_RISKY",
      message: "risky failed"
    };

    const result: Result<number, typeof thrown> = tryCatch(() => {
      throw thrown;
    });

    if (result.ok) {
      throw new Error("expected failure");
    }

    expect(result.error.code).toBe("E_RISKY");
  });

  it("returns data for resolved promises", async () => {
    const result = await tryCatchAsync(async () => "ready");

    expect(result).toEqual({
      ok  : true,
      data: "ready"
    });
  });

  it("returns the original error for rejected promises", async () => {
    const thrown = {
      message: "async failed"
    };

    const result = await tryCatchAsync<string, typeof thrown>(() => Promise.reject(thrown));

    expect(result).toEqual({
      ok   : false,
      error: thrown
    });
  });

  it("catches sync throws before promises are returned", async () => {
    const thrown = new Error("before promise");
    const failBeforePromise = (): Promise<string> => {
      throw thrown;
    };
    const result = await tryCatchAsync(failBeforePromise);

    expect(result).toEqual({
      ok   : false,
      error: thrown
    });
  });

  it("gets messages from unknown error values", () => {
    expect(getErrorMessage(new Error("from error"))).toBe("from error");
    expect(getErrorMessage("from string")).toBe("from string");
    expect(getErrorMessage({ message: "from object" })).toBe("from object");
    expect(getErrorMessage({ code: "E_VALUE" })).toBe("{\"code\":\"E_VALUE\"}");
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("normalizes unknown error values", () => {
    const error = new Error("same error");

    expect(normalizeError(error)).toBe(error);
    expect(normalizeError("string error")).toEqual(new Error("string error"));
  });
});
