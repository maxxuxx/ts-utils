import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const sourceRoot = join(root, "src");
const rootKoreanReadme = join(root, "docs", "readme.kr.md");
const migrationGuide = join(root, "docs", "migration-0.8.md");
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

const packageManifest = (): {
  exports?: Record<string, unknown>;
  files?: string[];
  name?: string;
  peerDependencies?: Record<string, string>;
  version?: string;
} => JSON.parse(readFileSync(
  join(root, "package.json"),
  "utf8"
));

const readmeFiles = (): string[] => [
  join(root, "README.md"),
  rootKoreanReadme,
  ...moduleDirectories().flatMap((directory) => [
    join(directory, "readme.md"),
    join(directory, "readme.kr.md")
  ])
];

const localMarkdownTargets = (file: string): string[] => (
  [...readFileSync(file, "utf8").matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((target) => (
      target.length > 0 &&
      !target.startsWith("#") &&
      !/^[a-z][a-z\d+.-]*:/iu.test(target)
    ))
    .map((target) => target.replace(/^<|>$/gu, "").split(/[?#]/u, 1)[0] ?? "")
    .filter((target) => target.length > 0)
    .map((target) => resolve(dirname(file), target))
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

  it("includes every Korean README target and the migration guide in the npm package", () => {
    expect(packageManifest().files).toEqual(expect.arrayContaining([
      "docs/readme.kr.md",
      "docs/migration-0.8.md",
      "src/**/readme.kr.md"
    ]));
  });

  it("keeps every local README link resolvable", () => {
    const missingTargets = readmeFiles()
      .flatMap((file) => localMarkdownTargets(file).map((target) => ({
        file,
        target
      })))
      .filter(({ target }) => !existsSync(target))
      .map(({ file, target }) => (
        `${relative(root, file)} -> ${relative(root, target)}`
      ));

    expect(missingTargets).toEqual([]);
  });

  it("documents every public subpath in the root README module table", () => {
    const packageJson = packageManifest();
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

  it("pins the 0.8 release and supported peer major ranges", () => {
    const packageJson = packageManifest();

    expect(packageJson.version).toBe("0.8.0");
    expect(packageJson.peerDependencies).toMatchObject({
      "iron-session": ">=8 <9",
      react        : ">=18 <20"
    });
  });

  it("documents every 0.8 migration surface with before and after examples", () => {
    expect(existsSync(migrationGuide)).toBe(true);

    const migration = existsSync(migrationGuide)
      ? readFileSync(migrationGuide, "utf8")
      : "";
    const requiredMarkers = [
      "@maxxuxx/ts-utils/electron-log/main",
      "@maxxuxx/ts-utils/electron-updater/main",
      "electron-helper/main/log",
      "electron-helper/main/updater",
      "createReactTokenSession",
      "storage: \"local\"",
      "safeParseJsonWithSchema",
      "parseJsonWithSchema",
      "safeDecodeJwtWithSchema",
      "decodeJwtWithSchema",
      "createSvelteKitRefreshNamespace",
      "applyRefresh",
      "cacheSuccessMs",
      "allowedOrigins",
      "ApiAuthError",
      "errorFallback",
      "rawBodyFactory",
      "maxResponseBytes",
      "ApiResponseSizeError",
      "isFalsy",
      "parser.id",
      "formatPhoneNumber",
      "calculateTimeOffset",
      "getEnvNumber",
      "createCookieDeviceUuidStore",
      "unsafe bigint values are rejected before string conversion",
      "17YY` and `19YY` use the configured fallback"
    ];
    const missingMarkers = requiredMarkers.filter((marker) => !migration.includes(marker));
    const beforeExamples = migration.match(/^### Before/uigm) ?? [];
    const afterExamples = migration.match(/^### After/uigm) ?? [];

    expect(missingMarkers).toEqual([]);
    expect(beforeExamples.length).toBeGreaterThanOrEqual(8);
    expect(afterExamples.length).toBeGreaterThanOrEqual(8);
  });
});
