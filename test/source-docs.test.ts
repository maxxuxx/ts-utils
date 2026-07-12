import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const packagePath = join(process.cwd(), "package.json");

const packageManifest = (): {
  exports?: Record<string, {
    import?: string;
  }>;
  files?: string[];
  scripts?: Record<string, string>;
} => JSON.parse(readFileSync(packagePath, "utf8"));

const sourceFiles = (): string[] => {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      const stats = statSync(path);

      if (stats.isDirectory()) {
        walk(path);
      } else if (entry.endsWith(".ts")) {
        files.push(path);
      }
    }
  };

  walk(sourceRoot);

  return files.sort();
};

const moduleDirectories = (): string[] => (
  readdirSync(sourceRoot)
    .map((entry) => join(sourceRoot, entry))
    .filter((path) => statSync(path).isDirectory())
    .sort()
);

const hasJsDoc = (node: ts.Node): boolean => {
  const docs = ts.getJSDocCommentsAndTags(node);

  if (docs.length > 0) {
    return true;
  }

  return false;
};

const isExported = (node: ts.Node): boolean => {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node) ?? []
    : [];

  return modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
};

const exportedDeclarationNames = (
  node: ts.Node,
  source: ts.SourceFile
): string[] => {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.map((declaration) => declaration.name.getText(source));
  }

  if (
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node)
  ) {
    return [
      node.name?.getText(source) ?? "<anonymous>"
    ];
  }

  return [];
};

describe("source documentation", () => {
  it("documents every exported declaration for editor hover help", () => {
    const missingDocs: string[] = [];

    for (const file of sourceFiles()) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true
      );

      const visit = (node: ts.Node) => {
        if (isExported(node)) {
          const names = exportedDeclarationNames(node, source);

          if (names.length > 0 && !hasJsDoc(node)) {
            for (const name of names) {
              missingDocs.push(`${relative(process.cwd(), file)}: ${name}`);
            }
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(source);
    }

    expect(missingDocs).toEqual([]);
  });

  it("keeps each module agent guide explicit about public JSDoc", () => {
    const missingRules = moduleDirectories()
      .map((directory) => join(directory, "agent.md"))
      .filter((path) => !readFileSync(path, "utf8").includes("JSDoc"));

    expect(missingRules.map((path) => relative(process.cwd(), path))).toEqual([]);
  });

  it("keeps package export targets backed by source files", () => {
    const packageJson = packageManifest();
    const missingSources = Object.entries(packageJson.exports ?? {})
      .flatMap(([subpath, target]) => {
        if (!target.import) {
          return [];
        }

        const source = target.import
          .replace(/^\.\/dist\//u, "src/")
          .replace(/\.js$/u, ".ts");

        return existsSync(source)
          ? []
          : [`${subpath}: ${source}`];
      });

    expect(missingSources).toEqual([]);
  });

  it("preserves an empty package root without Electron exports", () => {
    const packageJson = packageManifest();
    const electronExports = Object.keys(packageJson.exports ?? {})
      .filter((subpath) => subpath.toLowerCase().includes("electron"));

    expect(readFileSync(join(sourceRoot, "index.ts"), "utf8").trim()).toBe("export {};");
    expect(electronExports).toEqual([]);
    expect(existsSync(join(sourceRoot, "electron-log"))).toBe(false);
    expect(existsSync(join(sourceRoot, "electron-updater"))).toBe(false);
  });

  it("exposes Node-based package verification commands", () => {
    const packageJson = packageManifest();

    expect(packageJson.scripts).toMatchObject({
      "check:publish-version": "node scripts/check-publish-version.mjs",
      "clean"                : "node scripts/clean.mjs",
      "verify:exports": "node scripts/verify-exports.mjs",
      "verify:pack"   : "node scripts/verify-pack.mjs"
    });
    expect(packageJson.files).toEqual(expect.arrayContaining([
      "scripts/*.mjs"
    ]));
    expect(existsSync(join(process.cwd(), "scripts", "check-publish-version.mjs"))).toBe(true);
    expect(existsSync(join(process.cwd(), "scripts", "clean.mjs"))).toBe(true);
    expect(existsSync(join(process.cwd(), "scripts", "npm-runner.mjs"))).toBe(true);
    expect(existsSync(join(process.cwd(), "scripts", "verify-exports.mjs"))).toBe(true);
    expect(existsSync(join(process.cwd(), "scripts", "verify-pack.mjs"))).toBe(true);
  });

  it("runs the release gates in order in CI and publish workflows", () => {
    const expectedCommands = [
      "npm run typecheck",
      "npm test",
      "npm run build",
      "npm run verify:exports",
      "npm run verify:pack",
      "npm audit --omit=dev",
      "npm audit"
    ];
    const workflowFiles = [
      join(process.cwd(), ".github", "workflows", "ci.yml"),
      join(process.cwd(), ".github", "workflows", "publish.yml")
    ];
    const missingOrOutOfOrder = workflowFiles.flatMap((file) => {
      const commands = [...readFileSync(file, "utf8").matchAll(/^\s*run: (.+)$/gmu)]
        .map((match) => match[1]?.trim() ?? "");
      const indexes = expectedCommands.map((command) => commands.indexOf(command));
      const missing = expectedCommands.filter((_command, index) => indexes[index] === -1);
      const ordered = indexes.every((index, position) => (
        index !== -1 && (position === 0 || index > (indexes[position - 1] ?? -1))
      ));

      return missing.length === 0 && ordered
        ? []
        : [`${relative(process.cwd(), file)}: ${missing.join(", ") || "command order"}`];
    });

    expect(missingOrOutOfOrder).toEqual([]);
  });

  it("fails publishing when the exact package version already exists", () => {
    const publishWorkflow = readFileSync(
      join(process.cwd(), ".github", "workflows", "publish.yml"),
      "utf8"
    );

    expect(publishWorkflow).not.toContain("Skip existing version");
    expect(publishWorkflow).toContain("run: npm run check:publish-version");
    expect(publishWorkflow).not.toContain("node --input-type=module");
  });
});
