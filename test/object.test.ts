import { describe, expect, it } from "vitest";

import {
  compact,
  entries,
  fromEntries,
  mergeDefaults,
  object,
  omit,
  pick,
  removeUndefined
} from "../src/object/index.js";

describe("object module", () => {
  it("picks selected enumerable properties", () => {
    const user = {
      email       : "haru@example.com",
      id          : 1,
      name        : "haru",
      passwordHash: "hidden"
    };

    expect(pick(user, ["id", "name"])).toEqual({
      id  : 1,
      name: "haru"
    });
    expect(object.pick(user, ["email"])).toEqual({
      email: "haru@example.com"
    });
  });

  it("omits selected properties from a shallow copy", () => {
    const user = {
      email       : "haru@example.com",
      id          : 1,
      passwordHash: "hidden"
    };

    const publicUser = omit(user, ["passwordHash"]);

    expect(publicUser).toEqual({
      email: "haru@example.com",
      id   : 1
    });
    expect(user).toHaveProperty("passwordHash");
  });

  it("compacts nullish values while preserving falsy business values", () => {
    expect(compact({
      active    : false,
      categoryId: null,
      keyword   : "",
      locale    : undefined,
      page      : 0
    })).toEqual({
      active : false,
      keyword: "",
      page   : 0
    });
  });

  it("removes undefined values while preserving null", () => {
    expect(removeUndefined({
      imageUrl: null,
      name    : "haru",
      nickname: undefined
    })).toEqual({
      imageUrl: null,
      name    : "haru"
    });
  });

  it("merges defaults with defined values", () => {
    expect(mergeDefaults({
      logging: false,
      retry  : undefined,
      timeout: 5000
    }, {
      logging: true,
      retry  : 1,
      timeout: 10000
    })).toEqual({
      logging: false,
      retry  : 1,
      timeout: 5000
    });
  });

  it("wraps entries and fromEntries", () => {
    const source = {
      id  : 1,
      name: "haru"
    };
    const id = Symbol("id");

    expect(entries(source)).toEqual([
      ["id", 1],
      ["name", "haru"]
    ]);
    expect(fromEntries([
      ["id", 1],
      [id, 2]
    ])).toEqual({
      id: 1,
      [id]: 2
    });
  });
});
