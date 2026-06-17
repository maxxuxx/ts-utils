# Encoding 모듈

[English](./readme.md)

browser와 Node에서 사용할 수 있는 UTF-8, base64, hex, byte 변환 helper입니다.

## 언제 사용하나

- 큰 encoding package 없이 text와 byte를 변환해야 할 때 사용합니다.
- 문자열과 byte-like 입력을 모두 받는 base64 또는 hex helper가 필요할 때 사용합니다.
- 잘못된 UTF-8 byte sequence를 result 형태로 처리하고 싶을 때 사용합니다.

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

## 주요 export

| Export | 역할 |
|---|---|
| `utf8`, `encodeUtf8`, `decodeUtf8`, `safeDecodeUtf8` | text와 UTF-8 byte 변환 helper입니다. |
| `base64`, `encodeBase64`, `decodeBase64`, `base64ToUint8Array`, `uint8ArrayToBase64` | base64 text와 byte helper입니다. |
| `hex`, `encodeHex`, `decodeHex`, `hexToUint8Array`, `uint8ArrayToHex` | hex text와 byte helper입니다. |
| `toUint8Array` | `ArrayBuffer`, typed array, `DataView`, byte array를 정규화합니다. |
| `EncodingError` | safe UTF-8 decode 실패를 감싸는 error입니다. |

## 기본 예제

```ts
const token = encoding.base64.encode("payload");
const bytes = encoding.base64.toBytes(token);
const text = encoding.utf8.decode(bytes);

const result = utf8.safeDecode([0xff], {
  fatal: true
});
```

## 동작 메모

- 문자열 입력은 base64 또는 hex 변환 전에 UTF-8로 encode됩니다.
- decoded text가 아니라 raw bytes가 필요하면 `toBytes` helper를 사용합니다.
- Node에서는 가능한 경우 `Buffer`를 사용하고 browser-like runtime에서는 base64에 `btoa`, `atob`를 사용합니다.
- `decodeUtf8`은 `fatal`, `ignoreBOM` 같은 `TextDecoder` option을 받습니다.

## 주의할 점

- `toUint8Array`는 0-255 범위를 벗어난 숫자 배열을 거부합니다.
- `base64.toBytes`는 base64가 아닌 문자열을 거부합니다.
- `hex.toBytes`는 짝수 길이 hex 문자열을 요구하고 선택적 `0x` prefix를 허용합니다.
- `safeDecodeUtf8`는 throw 대신 `{ ok: false, error: EncodingError }`를 반환합니다.

## 관련 모듈

- `@maxxuxx/ts-utils/json`은 encoded payload가 JSON text일 때 같이 사용합니다.
- `@maxxuxx/ts-utils/jwt`는 JWT base64url segment decode를 담당합니다.
