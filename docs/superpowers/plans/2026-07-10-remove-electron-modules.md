# Electron Modules Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Electron-owned source, public exports, dependencies, tests, and documentation from `@maxxuxx/ts-utils`, then review the remaining package for focused improvements and additions

**Architecture:** Preserve the package root and every non-Electron subpath unchanged while deleting the three isolated Electron module trees. Regenerate package metadata, clean stale build output, and audit only the remaining source after the removal has passed package-level verification

**Tech Stack:** TypeScript 5, NodeNext ESM, npm, Vitest, Zod

## Global Constraints

- Remove only `electron`, `electron-log`, and `electron-updater` responsibility from this package
- Preserve all unrelated working-tree content and all non-Electron public subpaths
- Do not publish, commit, push, or modify consumer repositories in this task
- Treat removal of the eight currently published Electron subpaths as a breaking package change

---

### Task 1: Remove Electron source and tests

**Files:**
- Delete: `src/electron/`
- Delete: `src/electron-log/`
- Delete: `src/electron-updater/`
- Delete: `test/electron-log.test.ts`
- Delete: `test/electron-updater.test.ts`
- Delete: `test/electron-short-imports.test.ts`

**Interfaces:**
- Consumes: Existing isolated Electron module trees and their dedicated tests
- Produces: A source tree containing only runtime-neutral, browser, Node, React, and SvelteKit utility modules

- [x] **Step 1: Confirm all three source trees and tests are Electron-owned**

Run: `rg -n "electron|electron-log|electron-updater" src/electron src/electron-log src/electron-updater test/electron*.test.ts`

Expected: Matches stay inside the removal scope

- [x] **Step 2: Delete the scoped files with a targeted patch**

Expected: No `src/electron*` directory and no `test/electron*.test.ts` file remains

- [x] **Step 3: Verify no remaining source imports a removed relative module**

Run: `rg -n "electron-log|electron-updater|\.\./electron" src test`

Expected: No import or package-path matches remain outside documentation text selected for cleanup

### Task 2: Remove package and documentation coupling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `README.md`
- Modify: `docs/readme.kr.md`
- Modify: `src/device/readme.md`
- Modify: `src/device/readme.kr.md`
- Review: `src/env/agent.md`
- Review: `src/env/readme.md`
- Review: `src/env/readme.kr.md`
- Review: `src/device/agent.md`

**Interfaces:**
- Consumes: The source deletion from Task 1
- Produces: An export map and install graph with no Electron dependency or advertised Electron module

- [x] **Step 1: Remove eight published Electron export keys and discard eight uncommitted aggregate export keys**

Expected: `package.json` keeps the root and 22 non-Electron subpaths only

- [x] **Step 2: Remove Electron dependency metadata**

Expected: `electron-log` is absent from dependencies and `electron` plus `electron-updater` are absent from peer dependencies and peer metadata

- [x] **Step 3: Regenerate the npm lockfile and installed dependency tree**

Run: `npm install --ignore-scripts`

Expected: `package-lock.json` and `node_modules` no longer contain package-owned Electron dependency entries

- [x] **Step 4: Remove module-map rows, runtime claims, and stale cross-links**

Expected: Root documentation lists only remaining public subpaths and device documentation does not link to the deleted logger

### Task 3: Verify the reduced package

**Files:**
- Rebuild: `dist/`
- Inspect: npm package dry-run output

**Interfaces:**
- Consumes: Tasks 1 and 2
- Produces: Evidence that source, build output, package exports, dependency graph, and tests contain no removed surface

- [x] **Step 1: Run the compiler and full test suite**

Run: `npm run typecheck && npm test`

Expected: Both commands exit with code 0

- [x] **Step 2: Clean and rebuild**

Run: `npm run clean && npm run build`

Expected: Build exits with code 0 and `dist/electron*` does not exist

- [x] **Step 3: Verify package contents and dependency removal**

Run: `npm pack --dry-run --json`

Expected: Package dry run exits with code 0 and contains no Electron paths

Run: `npm ls electron electron-log electron-updater --all`

Expected: No installed dependency is required by this package

### Task 4: Audit remaining modules

**Files:**
- Review: `src/*/*.ts`
- Review: `test/*.test.ts`
- Review: `package.json`
- Review: `.github/workflows/*.yml`
- Review: module `agent.md` and `readme*.md` files

**Interfaces:**
- Consumes: The verified non-Electron package from Task 3
- Produces: A ranked report of concrete improvements, consolidation candidates, missing tests, and useful new modules without applying speculative changes

- [x] **Step 1: Map remaining public APIs, dependencies, file sizes, and test coverage**

Run: `rg --files src test | sort`

Expected: Complete inventory of the reduced package

- [x] **Step 2: Inspect correctness, ergonomics, packaging, and documentation independently**

Expected: Every proposed change names an exact source location, current limitation, benefit, and implementation risk

- [x] **Step 3: Rank findings**

Expected: Findings are split into immediate fixes, worthwhile refinements, and optional new modules with no generic wishlist items
