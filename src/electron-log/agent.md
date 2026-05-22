# Electron log module notes

## Purpose

This module provides Electron logging helpers around `electron-log`

It supports main process file and terminal logging, renderer console logging, renderer to main logging, and a preload bridge for context isolated renderers

## Public imports

Use process specific imports

`@maxxuxx/ts-utils/electron-log/main` is for Electron main process code

`@maxxuxx/ts-utils/electron-log/preload` is for preload scripts

`@maxxuxx/ts-utils/electron-log/renderer` is for renderers that import `electron-log/renderer`

`@maxxuxx/ts-utils/electron-log` is browser safe and exports shared types, constants, level helpers, and the bridge client

Do not re-export main or renderer runtime adapters from the package root

Do not re-export this module from the root package entry because `electron-log` and `electron` must stay module-scoped and optional for consumers

## Internal layout

`main.ts` configures `electron-log/main`

`renderer.ts` configures `electron-log/renderer`

`preload.ts` exposes the IPC bridge API through Electron `contextBridge`

`bridge-main.ts` registers the main process IPC listener

`bridge-client.ts` creates a web renderer logger that can write to console, main process, or both

`levels.ts` contains level filtering rules

`transport.ts` contains transport configuration helpers

`types.ts` contains exported public types and minimal Electron interface types

## Design decisions

Electron itself is not a direct dependency of this package

`electron-log` is a package dependency because this module imports process-specific `electron-log` entrypoints

Electron itself is not a package dependency because this package does not import it directly

Main, preload, and renderer APIs accept minimal Electron-like interfaces from the consuming app

The main adapter statically imports `electron-log/main`, so it must only be imported from Electron main process code

The default main logger loads `electron-log/main` lazily so the main subpath can be imported in tests without Electron installed when an injected logger is used

The renderer adapter statically imports `electron-log/renderer`, so web-only renderer code should prefer `createBridgeLogger`

The bridge uses fire and forget `ipcRenderer.send` because logging should not block UI work

The main bridge must validate `createdAt`, `data`, `level`, and optional `scope` before dispatching renderer payloads to logger methods

Renderer target `terminal` is an alias for sending logs to the main process

Default development level is `debug`

Default production level is `info`

Set `productionLevel` to `false` when production logging should be fully disabled
