import { readFile } from "node:fs/promises";
import { dirname, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { spawnNpmSync } from "./npm-runner.mjs";

// Paths and process helpers
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot     = resolve(scriptDirectory, "..");
const packagePath     = resolve(packageRoot, "package.json");

const fail = (message, details = "") => {
  const suffix = details.length > 0 ? `\n${details}` : "";

  throw new Error(`[verify:pack] ${message}${suffix}`);
};

const normalizePackPath = (path) => (
  path.replaceAll("\\", "/").replace(/^package\//u, "")
);

const runDryPack = () => {
  const result = spawnNpmSync(["pack", "--dry-run", "--json"], {
    cwd      : packageRoot,
    encoding : "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.error) {
    fail("could not start `npm pack --dry-run --json`", result.error.message);
  }

  if (result.status !== 0) {
    fail(
      `npm pack failed with exit code ${result.status ?? "unknown"}`,
      [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    );
  }

  return result.stdout;
};

// Package manifest and pack output helpers
const readManifest = async () => {
  try {
    return JSON.parse(await readFile(packagePath, "utf8"));
  } catch (error) {
    fail(
      `could not read ${packagePath}`,
      error instanceof Error ? error.message : String(error)
    );
  }
};

const parsePackOutput = (output) => {
  const candidates = [output.trim()];

  for (let index = output.indexOf("["); index !== -1; index = output.indexOf("[", index + 1)) {
    candidates.push(output.slice(index).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const packs  = Array.isArray(parsed) ? parsed : [parsed];

      if (packs.length > 0 && packs.every((pack) => Array.isArray(pack?.files))) {
        return packs;
      }
    } catch {
      // Continue until a complete JSON payload is found
    }
  }

  fail("npm pack did not return the expected JSON file list", output.trim());
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

const collectLocalScriptTargets = (scripts) => (
  Object.entries(scripts ?? {}).flatMap(([name, command]) => {
    if (typeof command !== "string") {
      return [];
    }

    const match = /^node (scripts\/[a-z\d-]+\.mjs)$/iu.exec(command.trim());

    return match?.[1]
      ? [{ name, path: normalizePackPath(match[1]) }]
      : [];
  })
);

const readMarkdownTargets = (markdown) => (
  [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)]
    .map((match) => match[1]?.trim() ?? "")
    .map((target) => {
      if (target.startsWith("<")) {
        const end = target.indexOf(">");

        return end === -1 ? target : target.slice(1, end);
      }

      return target.split(/\s+/u, 1)[0] ?? "";
    })
    .filter((target) => (
      target.length > 0 &&
      !target.startsWith("#") &&
      !/^[a-z][a-z\d+.-]*:/iu.test(target)
    ))
    .map((target) => target.split(/[?#]/u, 1)[0] ?? "")
    .filter((target) => target.length > 0)
);

const resolveMarkdownTarget = (readmePath, target) => {
  let decodedTarget;

  try {
    decodedTarget = decodeURIComponent(target);
  } catch {
    fail(`${readmePath} contains an invalid encoded link target ${target}`);
  }

  return posix.normalize(posix.join(posix.dirname(readmePath), decodedTarget));
};

// Pack verification
const verify = async () => {
  const [manifest, packOutput] = await Promise.all([
    readManifest(),
    Promise.resolve(runDryPack())
  ]);
  const packs = parsePackOutput(packOutput);

  if (packs.length !== 1) {
    fail(`expected one packed package but npm reported ${packs.length}`);
  }

  const packedFiles = new Set(
    packs[0].files.map(({ path }) => normalizePackPath(path))
  );
  const electronPaths = [...packedFiles]
    .filter((path) => path.toLowerCase().includes("electron"))
    .sort();

  if (electronPaths.length > 0) {
    fail("Electron paths must not be packed", electronPaths.join("\n"));
  }

  const missingScriptTargets = collectLocalScriptTargets(manifest.scripts)
    .filter(({ path }) => !packedFiles.has(path))
    .map(({ name, path }) => `${name}: ${path}`)
    .sort();

  if (missingScriptTargets.length > 0) {
    fail(
      "package scripts reference files missing from the package",
      missingScriptTargets.join("\n")
    );
  }

  const exportTargets = [...new Set(
    Object.entries(manifest.exports ?? {})
      .flatMap(([subpath, target]) => collectTargets(target).map((path) => ({
        path,
        subpath
      })))
      .filter(({ path }) => path.startsWith("./dist/"))
      .map(({ path }) => normalizePackPath(path.slice(2)))
  )];
  const missingExportTargets = exportTargets
    .filter((target) => !packedFiles.has(target))
    .sort();

  if (missingExportTargets.length > 0) {
    fail("exported dist targets are missing from the package", missingExportTargets.join("\n"));
  }

  const packedReadmes = [...packedFiles]
    .filter((path) => /^readme(?:\.kr)?\.md$/iu.test(posix.basename(path)))
    .sort();
  const missingLinkedDocs = [];

  for (const readmePath of packedReadmes) {
    let markdown;

    try {
      markdown = await readFile(resolve(packageRoot, readmePath), "utf8");
    } catch (error) {
      fail(
        `could not read packed README source ${readmePath}`,
        error instanceof Error ? error.message : String(error)
      );
    }

    for (const target of readMarkdownTargets(markdown)) {
      const resolvedTarget = resolveMarkdownTarget(readmePath, target);

      if (!packedFiles.has(resolvedTarget)) {
        missingLinkedDocs.push(`${readmePath} -> ${resolvedTarget}`);
      }
    }
  }

  if (missingLinkedDocs.length > 0) {
    fail("packed README links resolve to missing files", [...new Set(missingLinkedDocs)].sort().join("\n"));
  }

  console.log(
    `[verify:pack] verified ${packedFiles.size} files, ${exportTargets.length} export targets, and ${packedReadmes.length} README files`
  );
};

verify().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
