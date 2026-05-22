import { describe, expect, it, vi } from "vitest";

import {
  createBridgeLogger,
  resolveLogLevel,
  shouldLogLevel
} from "../src/electron-log/index.js";
import { createBridgeApi } from "../src/electron-log/preload.js";
import { registerMainBridge } from "../src/electron-log/bridge-main.js";
import type { BridgeApi, LoggerFunctions } from "../src/electron-log/index.js";

const createBridge = (): BridgeApi => ({
  send:    vi.fn(),
  error:   vi.fn(),
  warn:    vi.fn(),
  info:    vi.fn(),
  verbose: vi.fn(),
  debug:   vi.fn(),
  silly:   vi.fn(),
  log:     vi.fn()
});

const createLogger = (): LoggerFunctions => ({
  error:   vi.fn(),
  warn:    vi.fn(),
  info:    vi.fn(),
  verbose: vi.fn(),
  debug:   vi.fn(),
  silly:   vi.fn(),
  log:     vi.fn()
});

describe("electron-log module", () => {
  it("resolves development and production levels", () => {
    expect(resolveLogLevel({
      isProduction: false
    })).toBe("debug");

    expect(resolveLogLevel({
      isProduction: true
    })).toBe("info");

    expect(resolveLogLevel({
      isProduction:     true,
      productionLevel: false
    })).toBe(false);
  });

  it("filters levels by minimum level", () => {
    expect(shouldLogLevel("error", "info")).toBe(true);
    expect(shouldLogLevel("info", "info")).toBe(true);
    expect(shouldLogLevel("debug", "info")).toBe(false);
    expect(shouldLogLevel("debug", false)).toBe(false);
  });

  it("creates preload bridge payloads", () => {
    const sent: Array<{
      channel: string;
      payload: unknown;
    }> = [];

    const api = createBridgeApi({
      send: (channel, payload) => {
        sent.push({
          channel,
          payload
        });
      }
    }, "custom-log");

    api.error(new Error("boom"));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.channel).toBe("custom-log");
    expect(sent[0]?.payload).toMatchObject({
      level: "error"
    });
  });

  it("registers main bridge logging", () => {
    let listener: ((event: unknown, payload: unknown) => void) | undefined;
    const logger = createLogger();

    const dispose = registerMainBridge({
      ipcMain: {
        on: (_channel, nextListener) => {
          listener = nextListener;
        },
        removeListener: (_channel, nextListener) => {
          if (listener === nextListener) {
            listener = undefined;
          }
        }
      },
      logger
    });

    listener?.({}, {
      createdAt: new Date().toISOString(),
      data:      ["hello"],
      level:     "info"
    });

    expect(logger.info).toHaveBeenCalledWith("hello");

    dispose();

    expect(listener).toBeUndefined();
  });

  it("ignores invalid main bridge payloads", () => {
    let listener: ((event: unknown, payload: unknown) => void) | undefined;
    const logger = createLogger();

    registerMainBridge({
      ipcMain: {
        on: (_channel, nextListener) => {
          listener = nextListener;
        }
      },
      logger
    });

    expect(() => {
      listener?.({}, {
        createdAt: new Date().toISOString(),
        data:      ["hidden"],
        level:     "unknown"
      });
    }).not.toThrow();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("imports the main logger entry without loading Electron immediately", async () => {
    const module = await import("../src/electron-log/main.js");

    expect(module.configureMainLogger).toBeTypeOf("function");
  });

  it("creates renderer bridge client with production filtering", () => {
    const bridge = createBridge();
    const logger = createBridgeLogger({
      bridge,
      isProduction: true,
      productionLevel: "info",
      targets: [
        "main"
      ]
    });

    logger.debug("hidden");
    logger.info("visible");

    expect(bridge.debug).not.toHaveBeenCalled();
    expect(bridge.info).toHaveBeenCalledWith("visible");
  });
});
