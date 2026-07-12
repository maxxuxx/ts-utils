import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { spawnNpmSync } from "./npm-runner.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot     = resolve(scriptDirectory, "..");
const packagePath     = resolve(packageRoot, "package.json");

/** Evaluates one npm view result and allows only an exact JSON E404 */
export const evaluatePublishVersionResult = (result, specifier) => {
  if (result?.error) {
    throw new Error(
      `[publish] registry lookup could not start for ${specifier}`,
      { cause: result.error }
    );
  }

  if (result?.status === 0) {
    throw new Error(`[publish] ${specifier} already exists`);
  }

  if (!Number.isInteger(result?.status)) {
    throw new Error(`[publish] registry lookup failed without an exit code for ${specifier}`);
  }

  if (typeof result.stderr === "string" && result.stderr.trim().length > 0) {
    throw new Error(`[publish] registry lookup returned unexpected stderr for ${specifier}`);
  }

  let payload;

  try {
    payload = JSON.parse(typeof result.stdout === "string" ? result.stdout : "");
  } catch (error) {
    throw new Error(
      `[publish] registry lookup did not return valid JSON for ${specifier}`,
      { cause: error }
    );
  }

  const code = payload && typeof payload === "object" &&
    payload.error && typeof payload.error === "object"
    ? payload.error.code
    : undefined;

  if (code !== "E404") {
    const codeDetails = typeof code === "string" ? ` (${code})` : "";

    throw new Error(`[publish] registry lookup failed for ${specifier}${codeDetails}`);
  }

  return {
    available: true,
    specifier
  };
};

/** Checks whether the current package version is available on npm */
export const checkPublishVersion = async ({
  manifestPath = packagePath,
  runner       = spawnNpmSync
} = {}) => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (typeof manifest.name !== "string" || manifest.name.length === 0) {
    throw new Error("[publish] package.json must contain a non-empty package name");
  }

  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    throw new Error("[publish] package.json must contain a non-empty package version");
  }

  const specifier = `${manifest.name}@${manifest.version}`;
  const result = runner([
    "view",
    specifier,
    "version",
    "--json",
    "--loglevel=silent"
  ], {
    cwd      : packageRoot,
    encoding : "utf8",
    maxBuffer: 1024 * 1024
  });
  const outcome = evaluatePublishVersionResult(result, specifier);

  console.log(`[publish] ${specifier} is available`);

  return outcome;
};

const isMain = process.argv[1] !== undefined && (
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
);

if (isMain) {
  checkPublishVersion().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
