import { describe, expect, it } from "vitest";

import {
  EncodingError,
  base64,
  base64ToUint8Array,
  decodeBase64,
  decodeHex,
  decodeUtf8,
  encodeBase64,
  encodeHex,
  encodeUtf8,
  encoding,
  getUtf8ByteLength,
  hex,
  hexToUint8Array,
  safeDecodeUtf8,
  toUint8Array,
  utf8
} from "../src/encoding/index.js";

describe("encoding module", () => {
  it("encodes and decodes UTF-8 text", () => {
    const bytes = encodeUtf8("안녕");

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(decodeUtf8(bytes)).toBe("안녕");
    expect(utf8.decode(utf8.encode("hello"))).toBe("hello");
    expect(getUtf8ByteLength("안녕")).toBe(6);
  });

  it("normalizes byte inputs", () => {
    const bytes = toUint8Array([65, 66, 67]);
    const view = new DataView(bytes.buffer);

    expect(decodeUtf8(bytes)).toBe("ABC");
    expect(decodeUtf8(bytes.buffer)).toBe("ABC");
    expect(decodeUtf8(view)).toBe("ABC");
    expect(() => toUint8Array([256])).toThrow(RangeError);
  });

  it("returns safe UTF-8 decode failures", () => {
    const result = safeDecodeUtf8([0xff], {
      fatal: true
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(EncodingError);
    }
  });

  it("converts text and bytes with base64", () => {
    const encoded = encodeBase64("안녕");

    expect(encoded).toBe("7JWI64WV");
    expect(decodeBase64(encoded)).toBe("안녕");
    expect(base64.decode(base64.encode("hello"))).toBe("hello");
    expect(base64.fromBytes(base64.toBytes(encoded))).toBe(encoded);
    expect(base64ToUint8Array(encoded)).toBeInstanceOf(Uint8Array);
    expect(base64.is(encoded)).toBe(true);
    expect(base64.is("not base64")).toBe(false);
    expect(() => base64.toBytes("not base64")).toThrow(RangeError);
  });

  it("converts text and bytes with hex", () => {
    const encoded = encodeHex("안녕");

    expect(encoded).toBe("ec9588eb8595");
    expect(decodeHex(encoded)).toBe("안녕");
    expect(hex.decode(hex.encode("hello"))).toBe("hello");
    expect(hex.fromBytes(hex.toBytes(encoded))).toBe(encoded);
    expect(hexToUint8Array(encoded)).toBeInstanceOf(Uint8Array);
    expect(hex.is(encoded)).toBe(true);
    expect(hex.is("abc")).toBe(false);
    expect(() => hex.toBytes("abc")).toThrow(RangeError);
  });

  it("provides grouped namespace helpers", () => {
    const token = encoding.base64.encode("payload");
    const bytes = encoding.base64.toBytes(token);

    expect(encoding.utf8.decode(bytes)).toBe("payload");
    expect(encoding.hex.decode(encoding.hex.encode("payload"))).toBe("payload");
  });
});
