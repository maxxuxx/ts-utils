# Encoding module

[한국어](./readme.kr.md)

Dependency-free UTF-8, base64, hex, and byte conversion helpers for browser and Node runtimes.

## Use this when

- You need to convert text to bytes and back without bringing a larger encoding package.
- You need base64 or hex helpers that accept both strings and byte-like inputs.
- You want result-style UTF-8 decode failures for invalid byte sequences.

## Import

```ts
import {
  encoding,
  utf8,
  base64,
  hex,
  toUint8Array
} from "@maxxuxx/ts-utils/encoding";
```

## Core exports

| Export | Role |
|---|---|
| `utf8`, `encodeUtf8`, `decodeUtf8`, `safeDecodeUtf8` | Text and UTF-8 byte helpers. |
| `base64`, `encodeBase64`, `decodeBase64`, `base64ToUint8Array`, `uint8ArrayToBase64` | Base64 text and byte helpers. |
| `hex`, `encodeHex`, `decodeHex`, `hexToUint8Array`, `uint8ArrayToHex` | Hex text and byte helpers. |
| `toUint8Array` | Normalizes `ArrayBuffer`, typed arrays, `DataView`, and byte arrays. |
| `EncodingError` | Error wrapper used by safe UTF-8 decoding. |

## Basic example

```ts
const token = encoding.base64.encode("payload");
const bytes = encoding.base64.toBytes(token);
const text = encoding.utf8.decode(bytes);

const result = utf8.safeDecode([0xff], {
  fatal: true
});
```

## Behavior notes

- String inputs are encoded as UTF-8 before base64 or hex conversion.
- Use `toBytes` helpers when the caller needs raw bytes instead of decoded text.
- Node uses `Buffer` when available; browser-like runtimes use `btoa` and `atob` for base64.
- `decodeUtf8` accepts standard `TextDecoder` options such as `fatal` and `ignoreBOM`.

## Edge cases

- `toUint8Array` rejects numeric arrays containing values outside 0 through 255.
- `base64.toBytes` rejects non-base64 strings.
- `hex.toBytes` requires an even number of hexadecimal characters and accepts an optional `0x` prefix.
- `safeDecodeUtf8` returns `{ ok: false, error: EncodingError }` instead of throwing.

## Related modules

- `@maxxuxx/ts-utils/json` when encoded payloads contain JSON text.
- `@maxxuxx/ts-utils/jwt` for base64url JWT segment decoding.
