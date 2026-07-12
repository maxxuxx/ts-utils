import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const distDirectory   = resolve(scriptDirectory, "..", "dist");

/** Removes one build directory recursively without using a shell */
export const cleanDirectory = (directory) => rm(directory, {
  force    : true,
  recursive: true
});

const isMain = process.argv[1] !== undefined && (
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
);

if (isMain) {
  cleanDirectory(distDirectory).catch((error) => {
    console.error(`[clean] could not remove ${distDirectory}`);
    console.error(error);
    process.exitCode = 1;
  });
}
