import { useSyncExternalStore } from "react";
import {
  createTokenSession,
  createTokenSessionParsers
} from "./core.js";
import type {
  TokenSessionController,
  TokenSessionData,
  TokenSessionOptions,
  TokenSessionTokens
} from "./types.js";
import type { JwtPayload } from "../jwt/index.js";

// Storage types
/** Represents react session storage name */
export type ReactSessionStorageName = "local" | "memory" | "session";

/** Represents react session storage */
export type ReactSessionStorage = Readonly<{
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}>;

/** Options for react token session */
export type ReactTokenSessionOptions<
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
> = Omit<
  TokenSessionOptions<void, TUser, TTokens, TClaims>,
  "clear" | "read" | "write"
> & Readonly<{
  initialSession?: TokenSessionData<TUser, TTokens>;
  serverSession?: TokenSessionData<TUser, TTokens>;
  storage?: ReactSessionStorage | ReactSessionStorageName;
  storageKey: string;
}>;

/** Represents react token session */
export type ReactTokenSession<
  TUser,
  TTokens extends TokenSessionTokens
> = Omit<
  TokenSessionController<void, TUser, TTokens>,
  | "clear"
  | "ensure"
  | "get"
  | "getAccessToken"
  | "refresh"
  | "set"
  | "updateUser"
> & Readonly<{
  clear: () => Promise<void>;
  ensure: () => Promise<TUser>;
  get: () => TokenSessionData<TUser, TTokens>;
  getAccessToken: () => Promise<string | undefined>;
  getServerSnapshot: () => TokenSessionData<TUser, TTokens>;
  getSnapshot: () => TokenSessionData<TUser, TTokens>;
  refresh: () => Promise<string>;
  set: (session: TokenSessionData<TUser, TTokens>) => Promise<void>;
  subscribe: (listener: () => void) => () => void;
  updateUser: (user: TUser) => Promise<void>;
  useSession: () => TokenSessionData<TUser, TTokens>;
  useSessionUser: () => TUser | undefined;
}>;

// Factory
/** Creates react token session */
export const createReactTokenSession = <
  TUser,
  TTokens extends TokenSessionTokens,
  TClaims extends JwtPayload = JwtPayload
>(
  options: ReactTokenSessionOptions<TUser, TTokens, TClaims>
): ReactTokenSession<TUser, TTokens> => {
  const storage          = resolveStorage(options.storage);
  const { parseSession } = createTokenSessionParsers(options);
  const serverSession    = parseRestoredSession(
    options.serverSession ?? options.initialSession ?? {},
    parseSession
  );
  const listeners        = new Set<() => void>();
  let snapshot            = readStoredSession(
    storage,
    options.storageKey,
    serverSession,
    parseSession
  );

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const writeSnapshot = (session: TokenSessionData<TUser, TTokens>) => {
    snapshot = session;

    if (storage) {
      storage.setItem(options.storageKey, JSON.stringify(session));
    }

    notify();
  };

  const clearSnapshot = () => {
    snapshot = {};
    storage?.removeItem(options.storageKey);
    notify();
  };

  const controller = createTokenSession<void, TUser, TTokens, TClaims>({
    ...options,
    clear: async () => clearSnapshot(),
    read : () => snapshot,
    write: async (_context, session) => writeSnapshot(session)
  });

  const subscribe = (listener: () => void) => {
    listeners.add(listener);

    const removeStorageListener = storage
      ? addStorageListener(options.storageKey, () => {
        snapshot = readStoredSession(
          storage,
          options.storageKey,
          serverSession,
          parseSession
        );
        notify();
      })
      : () => undefined;

    return () => {
      listeners.delete(listener);
      removeStorageListener();
    };
  };

  const getSnapshot = () => snapshot;
  const getServerSnapshot = () => serverSession;
  const useSession = () => useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return Object.freeze({
    clear : () => controller.clear(undefined),
    ensure: () => controller.ensure(undefined),
    get   : getSnapshot,
    getAccessToken: () => controller.getAccessToken(undefined),
    getServerSnapshot,
    getSnapshot,
    parseTokens: controller.parseTokens,
    refresh: () => controller.refresh(undefined),
    set    : (session) => controller.set(undefined, session),
    subscribe,
    updateUser: (user) => controller.updateUser(undefined, user),
    useSession,
    useSessionUser: () => useSession().user
  });
};

// Storage helpers
const readStoredSession = <
  TUser,
  TTokens extends TokenSessionTokens
>(
  storage: ReactSessionStorage | null,
  key: string,
  fallback: TokenSessionData<TUser, TTokens>,
  parseSession: (value: unknown) => TokenSessionData<TUser, TTokens>
): TokenSessionData<TUser, TTokens> => {
  if (!storage) {
    return fallback;
  }

  const value = storage.getItem(key);

  if (value === null) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return parseSession(parsed);
  } catch {
    storage.removeItem(key);

    return fallback;
  }
};

const parseRestoredSession = <
  TUser,
  TTokens extends TokenSessionTokens
>(
  value: unknown,
  parseSession: (value: unknown) => TokenSessionData<TUser, TTokens>
): TokenSessionData<TUser, TTokens> => {
  try {
    return parseSession(value);
  } catch {
    return {};
  }
};

const resolveStorage = (
  storage: ReactTokenSessionOptions<unknown, TokenSessionTokens>["storage"]
): ReactSessionStorage | null => {
  if (storage && typeof storage !== "string") {
    return storage;
  }

  const root = globalThis as typeof globalThis & {
    localStorage?: ReactSessionStorage;
    sessionStorage?: ReactSessionStorage;
  };

  if (storage === "session") {
    return root.sessionStorage ?? null;
  }

  if (storage === "local") {
    return root.localStorage ?? null;
  }

  return null;
};

const addStorageListener = (
  key: string,
  listener: () => void
): (() => void) => {
  const root = globalThis as typeof globalThis & {
    addEventListener?: (type: "storage", listener: (event: unknown) => void) => void;
    removeEventListener?: (type: "storage", listener: (event: unknown) => void) => void;
  };

  if (!root.addEventListener || !root.removeEventListener) {
    return () => undefined;
  }

  const storageListener = (event: unknown) => {
    if (!isStorageEventForKey(event, key)) {
      return;
    }

    listener();
  };

  root.addEventListener("storage", storageListener);

  return () => root.removeEventListener?.("storage", storageListener);
};

const isStorageEventForKey = (
  event: unknown,
  key: string
): boolean => {
  if (!isRecord(event)) {
    return false;
  }

  return event.key === key || event.key === null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);
