export type EncodingBytes = ArrayBufferLike | ArrayBufferView | readonly number[];

export type EncodingResult<TData, TError = unknown> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: TError;
    };

export type Utf8DecodeOptions = {
  fatal?: boolean;
  ignoreBOM?: boolean;
};

type BufferLike = {
  toString: (encoding?: string) => string;
};

type BufferConstructorLike = {
  from: (value: string | ArrayBuffer | ArrayLike<number>, encoding?: string) => BufferLike;
};

type EncodingGlobal = typeof globalThis & {
  Buffer?: BufferConstructorLike;
};

export class EncodingError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown, message = "Encoding operation failed") {
    super(message);

    this.name = "EncodingError";
    this.cause = cause;
  }
}

const createSuccess = <TData>(data: TData): {
  ok: true;
  data: TData;
} => ({
  data,
  ok: true
});

const createFailure = <TError>(error: TError): {
  ok: false;
  error: TError;
} => ({
  error,
  ok: false
});

const getBuffer = (): BufferConstructorLike | undefined => (
  (globalThis as EncodingGlobal).Buffer
);

const assertByte = (value: number, index: number): number => {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(`Byte at index ${index} must be an integer between 0 and 255`);
  }

  return value;
};

const isSharedArrayBuffer = (value: unknown): value is SharedArrayBuffer => (
  typeof SharedArrayBuffer !== "undefined" && value instanceof SharedArrayBuffer
);

export const toUint8Array = (bytes: EncodingBytes): Uint8Array => {
  if (bytes instanceof Uint8Array) {
    return bytes;
  }

  if (bytes instanceof ArrayBuffer) {
    return new Uint8Array(bytes);
  }

  if (isSharedArrayBuffer(bytes)) {
    return new Uint8Array(bytes);
  }

  if (ArrayBuffer.isView(bytes)) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  const result = new Uint8Array(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    result[index] = assertByte(bytes[index] ?? 0, index);
  }

  return result;
};

const bytesToBinary = (bytes: Uint8Array): string => {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return binary;
};

const binaryToBytes = (binary: string): Uint8Array => {
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  const buffer = getBuffer();

  if (buffer) {
    return buffer.from(bytes).toString("base64");
  }

  return btoa(bytesToBinary(bytes));
};

const base64ToBytes = (value: string): Uint8Array => {
  const normalized = value.trim();

  if (normalized && !isBase64(normalized)) {
    throw new RangeError("Base64 value is invalid");
  }

  const buffer = getBuffer();

  if (buffer) {
    return toUint8Array(buffer.from(normalized, "base64") as unknown as EncodingBytes);
  }

  return binaryToBytes(atob(normalized));
};

const normalizeHex = (value: string): string => (
  value.trim().replace(/^0x/iu, "")
);

export const encodeUtf8 = (text: string): Uint8Array => (
  new TextEncoder().encode(text)
);

export const decodeUtf8 = (
  bytes: EncodingBytes,
  options: Utf8DecodeOptions = {}
): string => (
  new TextDecoder("utf-8", options).decode(toUint8Array(bytes))
);

export const safeDecodeUtf8 = (
  bytes: EncodingBytes,
  options: Utf8DecodeOptions = {}
): EncodingResult<string, EncodingError> => {
  try {
    return createSuccess(decodeUtf8(bytes, options));
  } catch (error) {
    return createFailure(new EncodingError(error, "UTF-8 decode failed"));
  }
};

export const getUtf8ByteLength = (text: string): number => (
  encodeUtf8(text).byteLength
);

export const encodeBase64 = (value: string | EncodingBytes): string => (
  bytesToBase64(typeof value === "string" ? encodeUtf8(value) : toUint8Array(value))
);

export const decodeBase64 = (
  value: string,
  options: Utf8DecodeOptions = {}
): string => (
  decodeUtf8(base64ToBytes(value), options)
);

export const base64ToUint8Array = (value: string): Uint8Array => (
  base64ToBytes(value)
);

export const uint8ArrayToBase64 = (bytes: EncodingBytes): string => (
  bytesToBase64(toUint8Array(bytes))
);

export const isBase64 = (value: string): boolean => {
  const normalized = value.trim();

  if (!normalized || normalized.length % 4 !== 0) {
    return false;
  }

  return /^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/u.test(normalized);
};

export const encodeHex = (value: string | EncodingBytes): string => {
  const bytes = typeof value === "string" ? encodeUtf8(value) : toUint8Array(value);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const hexToUint8Array = (value: string): Uint8Array => {
  const hex = normalizeHex(value);

  if (hex.length % 2 !== 0 || !/^[\da-f]*$/iu.test(hex)) {
    throw new RangeError("Hex value must contain an even number of hexadecimal characters");
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
};

export const decodeHex = (
  value: string,
  options: Utf8DecodeOptions = {}
): string => (
  decodeUtf8(hexToUint8Array(value), options)
);

export const uint8ArrayToHex = (bytes: EncodingBytes): string => (
  encodeHex(bytes)
);

export const isHex = (value: string): boolean => {
  const hex = normalizeHex(value);

  return hex.length > 0 && hex.length % 2 === 0 && /^[\da-f]*$/iu.test(hex);
};

export const utf8 = Object.freeze({
  byteLength: getUtf8ByteLength,
  decode: decodeUtf8,
  encode: encodeUtf8,
  safeDecode: safeDecodeUtf8,
  toBytes: encodeUtf8
});

export const base64 = Object.freeze({
  decode: decodeBase64,
  encode: encodeBase64,
  fromBytes: uint8ArrayToBase64,
  is: isBase64,
  toBytes: base64ToUint8Array
});

export const hex = Object.freeze({
  decode: decodeHex,
  encode: encodeHex,
  fromBytes: uint8ArrayToHex,
  is: isHex,
  toBytes: hexToUint8Array
});

export const encoding = Object.freeze({
  base64,
  hex,
  toBytes: toUint8Array,
  utf8
});
