# Encoding module notes

## Purpose

This module provides dependency free helpers for UTF-8 bytes, base64, base64url, and hex conversion

It is intended for small app-level encoding boundaries such as local tokens, payload serialization, byte inspection, and browser/Node shared string conversion

## Public shape

Expose encoding utilities through `src/encoding/index.ts`

Consumers import this module through `@maxxuxx/ts-utils/encoding`

Strict base64url helpers are also exposed through `@maxxuxx/ts-utils/encoding/base64url`

Provide named exports plus grouped namespaces

```ts
encoding.utf8.encode("안녕");
encoding.base64.encode("안녕");
encoding.base64url.decodeText(encodedValue);
encoding.hex.decode(hexValue);
```

## Design decisions

All helpers must be dependency free

Use Web standard `TextEncoder` and `TextDecoder` for UTF-8 conversion

Use `globalThis.Buffer` only as a runtime fallback for base64 in Node-like environments. Do not expose `Buffer` in public types

Base64url uses Web standard `TextEncoder`, fatal `TextDecoder`, `btoa`, and `atob` behavior so Node and browser-compatible paths reject the same input

Base64url encoding is always unpadded. Decoding accepts unpadded input or canonical terminal padding and rejects invalid alphabet characters, misplaced padding, impossible lengths, and invalid UTF-8 text

`base64.encode` and `hex.encode` accept strings or bytes. Strings are converted to UTF-8 bytes first

`base64.decode` and `hex.decode` return UTF-8 text. Provide `toBytes` helpers when callers need raw bytes

`safeDecodeUtf8` catches `TextDecoder` errors, which matters when callers pass `{ fatal: true }`

Keep this module focused on string and byte representation conversion. Do not add JSON parse/stringify behavior here; use the `json` module for JSON payloads

`EncodingResult` aliases the shared `Result` type and safe decode helpers use the shared `ok` and `err` factories

Keep module docs updated whenever encoding behavior, exports, namespace aliases, or runtime assumptions change
## Public documentation

Every exported function, class, constant, interface, and type alias must have concise JSDoc before the declaration so editor hover explains purpose, important behavior, and expected usage
