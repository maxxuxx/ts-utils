import type {
  BrowserCryptoLike,
  BrowserDeviceUuidOptions,
  BrowserDocumentLike,
  CookieDeviceUuidStore,
  CookieDeviceUuidStoreOptions
} from "./types.js";

const DEFAULT_COOKIE_NAME = "device_uuid";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getBrowserDocument = (): BrowserDocumentLike | undefined => {
  const root = globalThis as typeof globalThis & {
    document?: BrowserDocumentLike;
  };

  return root.document;
};

const getBrowserCrypto = (): BrowserCryptoLike | undefined => {
  const root = globalThis as typeof globalThis & {
    crypto?: BrowserCryptoLike;
  };

  return root.crypto;
};

const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

const encodeCookiePart = (value: string): string => encodeURIComponent(value);

const decodeCookiePart = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const findCookie = (
  cookieHeader: string,
  cookieName: string
): string | undefined => {
  const encodedName = `${encodeCookiePart(cookieName)}=`;
  const parts = cookieHeader.split(";");

  for (const part of parts) {
    const cookie = part.trim();

    if (cookie.startsWith(encodedName)) {
      return decodeCookiePart(cookie.slice(encodedName.length));
    }
  }

  return undefined;
};

const randomByte = (crypto: BrowserCryptoLike | undefined): number => {
  if (crypto?.getRandomValues) {
    return crypto.getRandomValues(new Uint8Array(1))[0] ?? 0;
  }

  return Math.floor(Math.random() * 256);
};

export const createBrowserDeviceUuid = (
  crypto: BrowserCryptoLike | undefined = getBrowserCrypto()
): string => {
  const randomUuid = crypto?.randomUUID?.();

  if (randomUuid && isUuid(randomUuid)) {
    return randomUuid.toLowerCase();
  }

  const bytes = new Uint8Array(16);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = randomByte(crypto);
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join("")
  ].join("-");
};

export const createCookieDeviceUuidStore = (
  options: CookieDeviceUuidStoreOptions = {}
): CookieDeviceUuidStore => {
  const document = options.document ?? getBrowserDocument();
  const crypto = options.crypto ?? getBrowserCrypto();
  const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME;
  const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  const path = options.path ?? "/";
  const sameSite = options.sameSite ?? "Lax";
  const secure = options.secure ?? false;

  if (!document) {
    throw new Error("Browser document is not available");
  }

  return {
    getOrCreate: () => {
      const existingUuid = findCookie(document.cookie, cookieName);

      if (existingUuid && isUuid(existingUuid)) {
        return existingUuid.toLowerCase();
      }

      const uuid = createBrowserDeviceUuid(crypto);
      const cookieParts = [
        `${encodeCookiePart(cookieName)}=${encodeCookiePart(uuid)}`,
        `Max-Age=${maxAgeSeconds}`,
        `Path=${path}`,
        `SameSite=${sameSite}`
      ];

      if (secure) {
        cookieParts.push("Secure");
      }

      document.cookie = cookieParts.join("; ");

      return uuid;
    },
    read: () => {
      const existingUuid = findCookie(document.cookie, cookieName);

      if (!existingUuid || !isUuid(existingUuid)) {
        return undefined;
      }

      return existingUuid.toLowerCase();
    },
    write: (uuid) => {
      if (!isUuid(uuid)) {
        throw new Error("Device UUID cookie value must be a UUID");
      }

      const cookieParts = [
        `${encodeCookiePart(cookieName)}=${encodeCookiePart(uuid.toLowerCase())}`,
        `Max-Age=${maxAgeSeconds}`,
        `Path=${path}`,
        `SameSite=${sameSite}`
      ];

      if (secure) {
        cookieParts.push("Secure");
      }

      document.cookie = cookieParts.join("; ");
    }
  };
};

export const getBrowserDeviceUuid = (
  options: BrowserDeviceUuidOptions = {}
): string => {
  const store = options.store ?? createCookieDeviceUuidStore(options);

  return store.getOrCreate();
};
