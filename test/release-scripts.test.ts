import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

// @ts-expect-error Internal executable scripts intentionally use native ESM JavaScript
import { cleanDirectory } from "../scripts/clean.mjs";
// @ts-expect-error Internal executable scripts intentionally use native ESM JavaScript
import { resolveNpmInvocation, spawnNpmSync } from "../scripts/npm-runner.mjs";
// @ts-expect-error Internal executable scripts intentionally use native ESM JavaScript
import { evaluatePublishVersionResult } from "../scripts/check-publish-version.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("npm runner", () => {
  it("prefers npm_execpath through the current Node executable on Windows", () => {
    expect(resolveNpmInvocation(["run", "build"], {
      env     : { npm_execpath: "C:\\npm\\npm-cli.js" },
      execPath: "C:\\node\\node.exe",
      platform: "win32"
    })).toEqual({
      args   : ["C:\\npm\\npm-cli.js", "run", "build"],
      command: "C:\\node\\node.exe"
    });
  });

  it("uses npm directly only as a non-Windows fallback", () => {
    expect(resolveNpmInvocation(["pack", "--json"], {
      env     : {},
      execPath: "/usr/bin/node",
      platform: "linux"
    })).toEqual({
      args   : ["pack", "--json"],
      command: "npm"
    });
  });

  it("fails actionably on Windows without npm_execpath", () => {
    expect(() => resolveNpmInvocation(["run", "build"], {
      env     : {},
      execPath: "C:\\node\\node.exe",
      platform: "win32"
    })).toThrow(/npm_execpath is required on Windows/u);
  });

  it("spawns fixed npm arguments without a shell", () => {
    const spawnSync = vi.fn(() => ({ status: 0 }));

    spawnNpmSync(["run", "build"], { cwd: "/repo" }, {
      env     : { npm_execpath: "/npm/npm-cli.js" },
      execPath: "/node",
      platform: "linux",
      spawnSync
    });

    expect(spawnSync).toHaveBeenCalledWith(
      "/node",
      ["/npm/npm-cli.js", "run", "build"],
      {
        cwd  : "/repo",
        shell: false
      }
    );
  });
});

describe("clean script", () => {
  it("removes nested build output without shell commands", async () => {
    const directory = mkdtempSync(join(tmpdir(), "ts-utils-clean-"));
    const dist      = join(directory, "dist");

    temporaryDirectories.push(directory);
    mkdirSync(join(dist, "nested"), { recursive: true });
    writeFileSync(join(dist, "nested", "index.js"), "export {};\n");

    await cleanDirectory(dist);

    expect(existsSync(dist)).toBe(false);
  });
});

describe("publish version result", () => {
  const specifier = "@maxxuxx/ts-utils@0.8.0";

  it("rejects an existing exact version", () => {
    expect(() => evaluatePublishVersionResult({
      error : undefined,
      status: 0,
      stderr: "",
      stdout: "\"0.8.0\"\n"
    }, specifier)).toThrow(/already exists/u);
  });

  it("accepts only an exact JSON E404 code as available", () => {
    expect(evaluatePublishVersionResult({
      error : undefined,
      status: 1,
      stderr: "",
      stdout: JSON.stringify({
        error: {
          code: "E404"
        }
      })
    }, specifier)).toEqual({
      available: true,
      specifier
    });
  });

  it("rejects E500 JSON even when its message mentions E404", () => {
    expect(() => evaluatePublishVersionResult({
      error : undefined,
      status: 1,
      stderr: "",
      stdout: JSON.stringify({
        error: {
          code   : "E500",
          summary: "upstream mentioned E404"
        }
      })
    }, specifier)).toThrow(/E500/u);
  });

  it("rejects malformed output even when it mentions E404", () => {
    expect(() => evaluatePublishVersionResult({
      error : undefined,
      status: 1,
      stderr: "",
      stdout: "npm error E404"
    }, specifier)).toThrow(/valid JSON/u);
  });

  it("rejects npm spawn failures", () => {
    expect(() => evaluatePublishVersionResult({
      error : new Error("spawn failed"),
      status: null,
      stderr: "",
      stdout: ""
    }, specifier)).toThrow(/could not start/u);
  });
});
