import { describe, expect, it } from "vitest";

import {
  createCookieDeviceUuidStore,
  getBrowserDeviceUuid,
  getNodeDeviceUuid,
  parseNodeDeviceUuidOutput
} from "../src/device/index.js";
import type {
  BrowserCryptoLike,
  BrowserDocumentLike,
  DeviceCommand
} from "../src/device/index.js";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

const createDocument = (initialCookie = ""): BrowserDocumentLike => {
  let cookie = initialCookie;

  return {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      const [nextCookie] = value.split(";");

      if (nextCookie) {
        cookie = cookie
          ? `${cookie}; ${nextCookie}`
          : nextCookie;
      }
    }
  };
};

const createCrypto = (nextUuid = uuid): BrowserCryptoLike => ({
  randomUUID: () => nextUuid
});

describe("device module", () => {
  it("parses darwin ioreg UUID output", () => {
    expect(parseNodeDeviceUuidOutput(`
      +-o IOPlatformExpertDevice
        "IOPlatformUUID" = "ABCDEF12-3456-7890-ABCD-EF1234567890"
    `)).toBe("abcdef12-3456-7890-abcd-ef1234567890");
  });

  it("parses linux machine-id output as canonical UUID", () => {
    expect(parseNodeDeviceUuidOutput("0123456789abcdef0123456789abcdef\n"))
      .toBe("01234567-89ab-cdef-0123-456789abcdef");
  });

  it("parses windows wmic UUID output", () => {
    expect(parseNodeDeviceUuidOutput(`
      UUID
      4C4C4544-0038-5810-805A-CAC04F563233
    `)).toBe("4c4c4544-0038-5810-805a-cac04f563233");
  });

  it("uses injected node command execution and falls back between commands", async () => {
    const commands: DeviceCommand[] = [];

    const result = await getNodeDeviceUuid({
      executeCommand: async (command) => {
        commands.push(command);

        if (command.args[0] === "/etc/machine-id") {
          throw new Error("missing");
        }

        return "fedcba9876543210fedcba9876543210";
      },
      platform: "linux"
    });

    expect(result).toBe("fedcba98-7654-3210-fedc-ba9876543210");
    expect(commands).toEqual([
      {
        args: [
          "/etc/machine-id"
        ],
        command: "cat"
      },
      {
        args: [
          "/var/lib/dbus/machine-id"
        ],
        command: "cat"
      }
    ]);
  });

  it("keeps parse failure details when node commands do not contain a UUID", async () => {
    try {
      await getNodeDeviceUuid({
        executeCommand: async (command) => ({
          stdout: `not-a-uuid from ${command.command}`,
          stderr: "empty machine id"
        }),
        platform: "linux"
      });

      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toEqual(expect.arrayContaining([
        expect.objectContaining({
          command: expect.objectContaining({
            command: "cat"
          }),
          message: expect.stringContaining("not-a-uuid from cat"),
          name: "DeviceUuidParseError",
          stderr: "empty machine id",
          stdout: "not-a-uuid from cat"
        })
      ]));
    }
  });

  it("reads an existing browser cookie UUID", () => {
    const document = createDocument(`other=value; device_uuid=${uuid}`);
    const store = createCookieDeviceUuidStore({
      document
    });

    expect(store.read()).toBe(uuid);
    expect(getBrowserDeviceUuid({
      store
    })).toBe(uuid);
  });

  it("writes a generated browser UUID when the cookie is missing", () => {
    const document = createDocument();
    const result = getBrowserDeviceUuid({
      crypto: createCrypto(),
      document
    });

    expect(result).toBe(uuid);
    expect(document.cookie).toContain(`device_uuid=${uuid}`);
  });

  it("replaces an invalid browser cookie UUID", () => {
    const document = createDocument("device_uuid=not-a-uuid");
    const result = getBrowserDeviceUuid({
      crypto: createCrypto(),
      document
    });

    expect(result).toBe(uuid);
    expect(document.cookie).toContain(`device_uuid=${uuid}`);
  });
});
