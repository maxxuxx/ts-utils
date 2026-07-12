import { describe, expect, it } from "vitest";

import {
  appendQuery,
  buildUrl,
  ensureLeadingSlash,
  isAbsoluteUrl,
  isExternalUrl,
  joinPath,
  normalizePath,
  splitPath,
  stripLeadingSlash,
  stripTrailingSlash,
  toSearchParams,
  url,
  withTrailingSlash
} from "../src/url/index.js";

describe("url module", () => {
  it("joins URL path segments", () => {
    expect(joinPath("/api/v1", "/users/", 1)).toBe("/api/v1/users/1");
    expect(joinPath("api", "v1", "users")).toBe("api/v1/users");
    expect(joinPath("/", "api", null, undefined, "")).toBe("/api");
    expect(url.join("/api/", "/users")).toBe("/api/users");
  });

  it("normalizes and edits slashes", () => {
    expect(normalizePath("//api//v1/users//")).toBe("/api/v1/users/");
    expect(splitPath("/api/v1/users")).toEqual(["api", "v1", "users"]);
    expect(ensureLeadingSlash("api/v1")).toBe("/api/v1");
    expect(stripLeadingSlash("/api/v1")).toBe("api/v1");
    expect(stripTrailingSlash("/api/v1/")).toBe("/api/v1");
    expect(withTrailingSlash("/api/v1")).toBe("/api/v1/");
  });

  it("creates search params while skipping nullish values", () => {
    const searchParams = toSearchParams({
      active    : false,
      categoryId: null,
      keyword   : "",
      page      : 1,
      tags      : ["a", "b"],
      unused    : undefined
    });

    expect(searchParams.toString()).toBe("active=false&keyword=&page=1&tags=a&tags=b");
  });

  it("appends query strings before hash fragments", () => {
    expect(appendQuery("/users#list", {
      page: 1
    })).toBe("/users?page=1#list");
    expect(appendQuery("/x#one#two", {
      a: 1
    })).toBe("/x?a=1#one#two");
    expect(appendQuery("/users?sort=recent", [
      ["page", 2]
    ])).toBe("/users?sort=recent&page=2");
    expect(url.appendQuery("/users", {
      empty: null
    })).toBe("/users");
  });

  it("builds absolute and relative URLs", () => {
    expect(buildUrl("https://api.example.com/api", "/users", {
      page: 1
    })).toBe("https://api.example.com/api/users?page=1");
    expect(buildUrl("/api", "/users", {
      active: false
    })).toBe("/api/users?active=false");
    expect(buildUrl("https://api.example.com/api?token=1", "users", {
      page: 2
    })).toBe("https://api.example.com/api/users?token=1&page=2");
    expect(url.build("https://other.example.com/users", "", {
      page: 1
    })).toBe("https://other.example.com/users?page=1");
  });

  it("checks absolute and external URLs", () => {
    expect(isAbsoluteUrl("https://example.com")).toBe(true);
    expect(isAbsoluteUrl("/users")).toBe(false);
    expect(isExternalUrl("//example.com/users")).toBe(true);
    expect(url.isExternal("/users")).toBe(false);
  });
});
