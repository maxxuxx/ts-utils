# Device module notes

## Purpose

This module provides a stable device UUID helper for Node main processes and a
temporary cookie-backed UUID helper for browser or renderer contexts.

## Public imports

Expose runtime-specific device utilities through the browser and node subpaths:

- `@maxxuxx/ts-utils/device/browser` for browser and renderer cookie UUIDs.
- `@maxxuxx/ts-utils/device/node` for Node main process machine UUIDs.

Keep `@maxxuxx/ts-utils/device` available as a compatibility and automatic
environment detection entry.

## Internal layout

`node.ts` contains Node-only command execution and should remain the only file
that imports Node runtime modules.

`node-shared.ts` contains platform command selection and output parsing that can
be re-exported without pulling Node runtime modules into the root entry.

`browser.ts` contains cookie storage and browser UUID generation using narrow
`globalThis` typings instead of DOM lib types.

`types.ts` contains exported public option and helper types.

## Design decisions

Node UUID reads are async because they execute platform commands.

Command execution is injectable so tests and Electron apps can avoid direct OS
process calls.

When a platform command succeeds but does not contain a parseable UUID, keep a
parse error in the final `AggregateError` so callers can inspect stdout and
stderr diagnostics.

Linux machine IDs are normalized from 32 hex characters into canonical UUID
format.

Browser UUIDs are temporary application cookies and should not be treated as
hardware identifiers.

Browser cookie stores reject `SameSite=None` unless `secure` is true so callers cannot create a browser-rejected cookie configuration

`DeviceUuidParseError` remains implemented in `node-shared.ts` and is publicly exported by the aggregate and Node entries without pulling Node built-ins into the aggregate graph

Environment detection is conservative: a document means browser path, a Node
process means Node path, and anything else throws.

The root `index.ts` must not statically import `node.ts`; use dynamic import for
Node execution so browser bundles can prefer the browser-only subpath without
dragging Node built-ins into the graph.
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
