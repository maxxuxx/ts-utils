import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");

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
    const packageJson = JSON.parse(readFileSync(
      join(process.cwd(), "package.json"),
      "utf8"
    )) as {
      exports?: Record<string, {
        import?: string;
      }>;
    };
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
});
