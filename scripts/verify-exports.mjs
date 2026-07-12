import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { spawnNpmSync } from "./npm-runner.mjs";

// Paths and process helpers
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot     = resolve(scriptDirectory, "..");
const packagePath     = resolve(packageRoot, "package.json");

const fail = (message, cause) => {
  const details = cause instanceof Error
    ? `\n${cause.stack ?? cause.message}`
    : cause === undefined
      ? ""
      : `\n${String(cause)}`;

  throw new Error(`[verify:exports] ${message}${details}`);
};

const runBuild = () => {
  const result = spawnNpmSync(["run", "build"], {
    cwd  : packageRoot,
    stdio: "inherit"
  });

  if (result.error) {
    fail("could not start `npm run build`", result.error);
  }

  if (result.status !== 0) {
    fail(`build failed with exit code ${result.status ?? "unknown"}`);
  }
};

// Package manifest helpers
const readManifest = async () => {
  try {
    return JSON.parse(await readFile(packagePath, "utf8"));
  } catch (error) {
    fail(`could not read ${packagePath}`, error);
  }
};

const collectTargets = (target) => {
  if (typeof target === "string") {
    return [target];
  }

  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return [];
  }

  return Object.values(target).flatMap(collectTargets);
};

const toSpecifier = (packageName, subpath) => (
  subpath === "." ? packageName : `${packageName}${subpath.slice(1)}`
);

const assertTargetExists = async (subpath, target) => {
  if (!target.startsWith("./")) {
    fail(`export ${subpath} uses unsupported non-relative target ${target}`);
  }

  const targetPath = resolve(packageRoot, target);

  try {
    await access(targetPath);
  } catch (error) {
    fail(`export ${subpath} target ${target} was not built`, error);
  }
};

// Export verification
const verify = async () => {
  const manifest = await readManifest();

  if (typeof manifest.name !== "string" || manifest.name.length === 0) {
    fail("package.json must contain a non-empty package name");
  }

  if (!manifest.exports || typeof manifest.exports !== "object") {
    fail("package.json must contain an exports object");
  }

  runBuild();

  const entries = Object.entries(manifest.exports);

  for (const [subpath, exportTarget] of entries) {
    const targets = [...new Set(collectTargets(exportTarget))];

    if (targets.length === 0) {
      fail(`export ${subpath} has no file targets`);
    }

    for (const target of targets) {
      await assertTargetExists(subpath, target);
    }

    const specifier = toSpecifier(manifest.name, subpath);
    let module;

    try {
      module = await import(specifier);
    } catch (error) {
      fail(`could not import ${specifier} through package self-reference`, error);
    }

    if (subpath === "." && Object.keys(module).length !== 0) {
      fail(`package root must stay empty but exported ${Object.keys(module).join(", ")}`);
    }
  }

  console.log(`[verify:exports] verified ${entries.length} package export specifiers`);
};

verify().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
