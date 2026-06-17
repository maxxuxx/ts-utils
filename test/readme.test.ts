import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const sourceRoot = join(root, "src");
const rootKoreanReadme = join(root, "docs", "readme.kr.md");
const englishModuleSections = [
  "## Use this when",
  "## Import",
  "## Core exports",
  "## Basic example",
  "## Behavior notes",
  "## Edge cases",
  "## Related modules"
];
const koreanModuleSections = [
  "## 언제 사용하나",
  "## Import",
  "## 주요 export",
  "## 기본 예제",
  "## 동작 메모",
  "## 주의할 점",
  "## 관련 모듈"
];

const moduleDirectories = (): string[] => (
  readdirSync(sourceRoot)
    .map((entry) => join(sourceRoot, entry))
    .filter((path) => statSync(path).isDirectory())
    .sort()
);

describe("readme documentation", () => {
  it("links every English README to its Korean version", () => {
    const missingLinks = [
      {
        file: join(root, "README.md"),
        link: "[한국어](./docs/readme.kr.md)"
      },
      ...moduleDirectories().map((directory) => ({
        file: join(directory, "readme.md"),
        link: "[한국어](./readme.kr.md)"
      }))
    ]
      .filter(({ file, link }) => !readFileSync(file, "utf8").includes(link))
      .map(({ file }) => relative(root, file));

    expect(missingLinks).toEqual([]);
  });

  it("provides Korean README files with English backlinks", () => {
    const missingFiles = [
      {
        backlink: "[English](../README.md)",
        file    : rootKoreanReadme
      },
      ...moduleDirectories().map((directory) => ({
        backlink: "[English](./readme.md)",
        file    : join(directory, "readme.kr.md")
      }))
    ]
      .filter(({ backlink, file }) => (
        !existsSync(file) || !readFileSync(file, "utf8").includes(backlink)
      ))
      .map(({ file }) => relative(root, file));

    expect(missingFiles).toEqual([]);
  });

  it("keeps every module README on the shared documentation structure", () => {
    const missingSections = moduleDirectories().flatMap((directory) => {
      const readmePath = join(directory, "readme.md");
      const koreanReadmePath = join(directory, "readme.kr.md");
      const readme = readFileSync(readmePath, "utf8");
      const koreanReadme = readFileSync(koreanReadmePath, "utf8");
      const englishMissing = englishModuleSections
        .filter((section) => !readme.includes(section))
        .map((section) => `${relative(root, readmePath)}:${section}`);
      const koreanMissing = koreanModuleSections
        .filter((section) => !koreanReadme.includes(section))
        .map((section) => `${relative(root, koreanReadmePath)}:${section}`);

      return [
        ...englishMissing,
        ...koreanMissing
      ];
    });

    expect(missingSections).toEqual([]);
  });

  it("keeps Korean README files out of the npm package file list", () => {
    const packageJson = JSON.parse(readFileSync(
      join(root, "package.json"),
      "utf8"
    )) as {
      files?: string[];
    };

    expect(packageJson.files).not.toEqual(expect.arrayContaining([
      "README.kr.md"
    ]));
    expect(packageJson.files).not.toEqual(expect.arrayContaining([
      "docs/readme.kr.md"
    ]));
    expect(packageJson.files).not.toEqual(expect.arrayContaining([
      "src/**/readme.kr.md"
    ]));
  });

  it("documents every public subpath in the root README module table", () => {
    const packageJson = JSON.parse(readFileSync(
      join(root, "package.json"),
      "utf8"
    )) as {
      exports?: Record<string, unknown>;
      name?: string;
    };
    const readmes = [
      readFileSync(join(root, "README.md"), "utf8"),
      readFileSync(rootKoreanReadme, "utf8")
    ];
    const missingRows = Object.keys(packageJson.exports ?? {})
      .filter((subpath) => subpath !== ".")
      .flatMap((subpath) => {
        const specifier = `${packageJson.name}${subpath.slice(1)}`;
        const rowLink = "[`" + specifier + "`](";

        return readmes.every((readme) => readme.includes(rowLink))
          ? []
          : [specifier];
      });

    expect(missingRows).toEqual([]);
  });
});
