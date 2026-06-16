# Electron updater module notes

## Purpose

This module provides reusable Electron update state, IPC bridge, and electron-builder publish helpers for apps using `electron-updater`.

It is designed for S3 or generic public update feeds, with optional GitHub publish config generation for release artifacts.

## Public shape

Consumers import shared schemas and types through `@maxxuxx/ts-utils/electron-updater`.

Main process helpers are exposed through `@maxxuxx/ts-utils/electron-updater/main`.

Preload bridge helpers are exposed through `@maxxuxx/ts-utils/electron-updater/preload`.

electron-builder publish helpers are exposed through `@maxxuxx/ts-utils/electron-updater/builder`.

## Dependency policy

Do not import `electron` or `electron-updater` directly from this module.

Electron apps pass `app`, `ipcMain`, `ipcRenderer`, and `autoUpdater` in as structural dependencies.

`electron` and `electron-updater` are optional peer dependencies because Electron apps should own their exact runtime versions and non-Electron consumers should not install Electron binaries.

`zod` remains a direct package dependency because this module imports and re-exports schemas.

## Internal layout

`schemas.ts` contains the update state status, reason, and state schema.

`types.ts` contains the structural Electron/updater contracts and public helper types.

`main.ts` contains the stateful updater service and main process IPC registration.

`preload.ts` contains the renderer bridge API creation and contextBridge exposure helper.

`builder.ts` contains S3, GitHub, generic publish config helpers, AWS credential env mapping, publish path normalization, and `app-update.yml` cache dir patching.

## Design decisions

The default updater IPC channels match the existing app convention: `updater:check`, `updater:start`, `updater:install`, `updater:state:get`, and `updater:state:changed`.

The service uses the Boss app state model as the public base: `idle`, `disabled`, `checking`, `available`, `not-available`, `downloading`, `downloaded`, `installing`, `cancelled`, and `error`.

`check()` temporarily disables auto-download so renderers can ask whether an update exists without starting a download.

`start()` downloads when an update is available and installs when an update is already downloaded.

Automatic install after download is opt-in through `autoInstallOnDownloaded` because apps differ between splash-screen forced updates and user-confirmed updates.

`feedUrl` is optional. When omitted, apps can rely on `electron-builder` generated `app-update.yml`. When provided, the service calls `setFeedURL({ provider: "generic", url })` for public S3 or CloudFront style feeds.

Builder helpers are plain object helpers and do not import `electron-builder`, so they can be used without pulling builder into runtime code.
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
