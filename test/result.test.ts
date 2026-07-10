import { expect, it } from "vitest";

import { err, map, mapError, ok } from "@maxxuxx/ts-utils/result";

it("maps successful data without changing failures", () => {
  expect(map(ok(2), (value) => value * 3)).toEqual({
    data: 6,
    ok  : true
  });

  const failure = err("bad");

  expect(map(failure, (value: number) => value * 3)).toBe(failure);
});

it("maps errors without changing successful data", () => {
  expect(mapError(err("bad"), (value) => new Error(value))).toMatchObject({
    error: expect.any(Error),
    ok   : false
  });

  const success = ok(2);

  expect(mapError(success, (value: string) => new Error(value))).toBe(success);
});
