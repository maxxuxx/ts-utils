# Device module notes

## Purpose

This module provides a stable device UUID helper for Node main processes and a
temporary cookie-backed UUID helper for browser or renderer contexts.

## Public imports

Expose device utilities through `src/device/index.ts`.

Consumers should import this module through `@maxxuxx/ts-utils/device` when the
package export is available.

## Internal layout

`node.ts` contains platform command selection, command execution, and output
parsing.

`browser.ts` contains cookie storage and browser UUID generation using narrow
`globalThis` typings instead of DOM lib types.

`types.ts` contains exported public option and helper types.

## Design decisions

Node UUID reads are async because they execute platform commands.

Command execution is injectable so tests and Electron apps can avoid direct OS
process calls.

Linux machine IDs are normalized from 32 hex characters into canonical UUID
format.

Browser UUIDs are temporary application cookies and should not be treated as
hardware identifiers.

Environment detection is conservative: a document means browser path, a Node
process means Node path, and anything else throws.
