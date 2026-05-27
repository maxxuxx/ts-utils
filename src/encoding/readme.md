# Encoding module

Dependency free helpers for UTF-8 bytes, base64, and hex conversion

## Public API

```ts
import {
  base64,
  decodeUtf8,
  encoding,
  encodeBase64,
  encodeUtf8,
  hex,
  utf8
} from "@maxxuxx/ts-utils/encoding";
```

## UTF-8

```ts
const bytes = utf8.encode("안녕");
const text = utf8.decode(bytes);
const size = utf8.byteLength("안녕");
```

Use fatal decoding when invalid UTF-8 should throw instead of replacing invalid bytes.

```ts
const result = utf8.safeDecode(bytes, {
  fatal: true
});
```

## Base64

```ts
const encoded = base64.encode("안녕");
const decoded = base64.decode(encoded);

const bytes = base64.toBytes(encoded);
const restored = base64.fromBytes(bytes);
```

`base64.encode` accepts either a string or bytes. Strings are encoded as UTF-8 before base64 conversion.

## Hex

```ts
const encoded = hex.encode("안녕");
const decoded = hex.decode(encoded);

const bytes = hex.toBytes(encoded);
const restored = hex.fromBytes(bytes);
```

`hex.decode` converts hex bytes back to UTF-8 text. Use `hex.toBytes` when the caller needs raw bytes instead.

## Namespace helper

```ts
const token = encoding.base64.encode("payload");
const text = encoding.utf8.decode(encoding.base64.toBytes(token));
```

JSON helpers are intentionally separate. Compose `encoding` with `json` when encoded JSON payloads are needed.
