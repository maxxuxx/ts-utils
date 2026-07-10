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

const assertBase64Url = (value: string): void => {
  const paddingIndex = value.indexOf("=");
  const rawLength    = paddingIndex < 0 ? value.length : paddingIndex;
  const padding      = value.length - rawLength;

  if (!/^[A-Za-z0-9_-]*={0,2}$/u.test(value)) {
    throw new TypeError("Value must use the base64url alphabet");
  }

  if (rawLength % 4 === 1) {
    throw new TypeError("Base64url value has an impossible length");
  }

  if (padding > 0 && value.length % 4 !== 0) {
    throw new TypeError("Base64url padding must align to four characters");
  }

  if (padding !== 0 && padding !== (4 - rawLength % 4) % 4) {
    throw new TypeError("Base64url padding is not canonical");
  }
};

const normalizeBase64Url = (value: string): string => {
  const rawValue      = value.replace(/=+$/u, "");
  const paddingLength = (4 - rawValue.length % 4) % 4;

  return `${rawValue.replace(/-/gu, "+").replace(/_/gu, "/")}${"=".repeat(paddingLength)}`;
};

/** Encodes UTF-8 text or bytes as unpadded base64url */
export const encodeBase64Url = (value: string | Uint8Array): string => {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value;

  return btoa(bytesToBinary(bytes))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
};

/** Decodes a strict base64url value to bytes */
export const decodeBase64Url = (value: string): Uint8Array => {
  assertBase64Url(value);

  return binaryToBytes(atob(normalizeBase64Url(value)));
};

/** Decodes a strict base64url value to UTF-8 text and rejects invalid sequences */
export const decodeBase64UrlText = (value: string): string => (
  new TextDecoder("utf-8", {
    fatal: true
  }).decode(decodeBase64Url(value))
);

/** Checks whether a value uses valid canonical base64url syntax */
export const isBase64Url = (value: string): boolean => {
  try {
    assertBase64Url(value);

    return true;
  } catch {
    return false;
  }
};

/** Grouped helpers for the base64url module */
export const base64url = Object.freeze({
  decode    : decodeBase64Url,
  decodeText: decodeBase64UrlText,
  encode    : encodeBase64Url,
  is        : isBase64Url
});
