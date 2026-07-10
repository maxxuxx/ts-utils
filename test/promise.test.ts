import { describe, expect, it } from "vitest";

import {
  PromiseTimeoutError,
  type RetryContext,
  all,
  allObject,
  createSingleFlight,
  promise,
  retry,
  run,
  settle,
  settleObject,
  sleep,
  withTimeout
} from "../src/promise/index.js";

describe("promise module", () => {
  it("runs promise tasks with namespace access", async () => {
    await expect(run(() => "ok")).resolves.toBe("ok");
    await expect(promise.run(async () => 1)).resolves.toBe(1);
  });

  it("retries a task until it succeeds", async () => {
    let calls = 0;

    const result = await retry(() => {
      calls += 1;

      if (calls < 3) {
        throw new Error("not yet");
      }

      return "done";
    }, {
      delayMs: 0,
      retries: 2
    });

    expect(result).toBe("done");
    expect(calls).toBe(3);
  });

  it("uses conservative retry defaults", async () => {
    let calls = 0;

    await expect(retry(() => {
      calls += 1;

      throw new Error("failed");
    })).rejects.toThrow("failed");
    expect(calls).toBe(1);
  });

  it("times out task functions and existing promises", async () => {
    await expect(withTimeout(() => new Promise(() => undefined), {
      timeoutMs: 1
    })).rejects.toBeInstanceOf(PromiseTimeoutError);

    await expect(withTimeout(Promise.resolve("ready"), {
      timeoutMs: 100
    })).resolves.toBe("ready");
  });

  it("applies timeout to each retry attempt", async () => {
    let calls = 0;

    await expect(retry(() => {
      calls += 1;

      return new Promise(() => undefined);
    }, {
      delayMs  : 0,
      retries  : 1,
      timeoutMs: 1
    })).rejects.toBeInstanceOf(PromiseTimeoutError);
    expect(calls).toBe(2);
  });

  it("aborts a timed attempt before the next retry begins", async () => {
    const signals: AbortSignal[] = [];

    await expect(retry((context: RetryContext) => {
      const previousSignal = signals.at(-1);

      if (previousSignal !== undefined) {
        expect(previousSignal.aborted).toBe(true);
      }

      expect(context.attempt).toBe(signals.length + 1);
      signals.push(context.signal);

      return new Promise(() => undefined);
    }, {
      delayMs  : 0,
      retries  : 1,
      timeoutMs: 1
    })).rejects.toBeInstanceOf(PromiseTimeoutError);
    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
  });

  it("rejects timer overflow before scheduling sleep", () => {
    expect(() => sleep(2_147_483_648)).toThrow(RangeError);
  });

  it("rejects timer overflow before scheduling a timeout", async () => {
    await expect(withTimeout(() => "ok", {
      timeoutMs: 2_147_483_648
    })).rejects.toThrow(RangeError);
  });

  it("rejects timer overflow before using a retry delay", async () => {
    await expect(retry(() => "ok", {
      delayMs: 2_147_483_648
    })).rejects.toThrow(RangeError);
  });

  it("aborts a pending sleep", async () => {
    const controller = new AbortController();
    const pending = sleep(10_000, {
      signal: controller.signal
    });

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      name: "AbortError"
    });
  });

  it("runs multiple tasks as a typed tuple", async () => {
    const [user, orders] = await all([
      async () => ({
        id  : 1,
        name: "haru"
      }),
      {
        task: () => ["first", "second"],
        timeoutMs: 100
      }
    ] as const, {
      delayMs: 0,
      retries: 1
    });

    const userId: number = user.id;
    const firstOrder: string | undefined = orders[0];

    expect(userId).toBe(1);
    expect(firstOrder).toBe("first");
  });

  it("runs object tasks with common options and per-task overrides", async () => {
    let orderCalls = 0;

    const result = await allObject({
      notifications: {
        retries: 0,
        task   : () => ["n1"],
        timeoutMs: 100
      },
      orders: {
        delayMs: 0,
        retries: 1,
        task   : () => {
          orderCalls += 1;

          if (orderCalls < 2) {
            throw new Error("temporary");
          }

          return ["o1"];
        }
      },
      user: () => ({
        id: 1
      })
    }, {
      delayMs  : 50,
      retries  : 0,
      timeoutMs: 100
    });

    const userId: number = result.user.id;
    const firstOrder: string | undefined = result.orders[0];
    const firstNotification: string | undefined = result.notifications[0];

    expect(userId).toBe(1);
    expect(firstOrder).toBe("o1");
    expect(firstNotification).toBe("n1");
    expect(result).toEqual({
      notifications: ["n1"],
      orders       : ["o1"],
      user         : {
        id: 1
      }
    });
    expect(orderCalls).toBe(2);
  });

  it("settles tuple tasks without rejecting the whole group", async () => {
    const result = await settle([
      () => "ok",
      () => {
        throw new Error("failed");
      }
    ] as const);

    expect(result[0]).toEqual({
      data: "ok",
      ok  : true
    });
    expect(result[1].ok).toBe(false);
  });

  it("settles object tasks without rejecting the whole group", async () => {
    const result = await settleObject({
      orders: () => {
        throw new Error("orders failed");
      },
      user: () => ({
        id: 1
      })
    });

    expect(result.user).toEqual({
      data: {
        id: 1
      },
      ok: true
    });
    expect(result.orders.ok).toBe(false);
  });

  it("validates timing options", async () => {
    expect(() => sleep(-1)).toThrow(RangeError);
    await expect(withTimeout(() => "ok", {
      timeoutMs: -1
    })).rejects.toThrow(RangeError);
    await expect(retry(() => "ok", {
      retries: 1.5
    })).rejects.toThrow(RangeError);
  });

  describe("single-flight", () => {
    it("exposes the factory through the promise namespace", () => {
      expect(promise.createSingleFlight).toBeTypeOf("function");
    });

    it("shares in-flight work for the same key", async () => {
      const singleFlight = createSingleFlight<string, string>();
      let calls = 0;
      let release = (_value: string): void => {
        throw new Error("task did not start");
      };
      const task = (): Promise<string> => {
        calls += 1;

        return new Promise((resolve) => {
          release = resolve;
        });
      };
      const first = singleFlight.run("user", task);
      const second = singleFlight.run("user", task);

      expect(first).toBe(second);
      await Promise.resolve();
      expect(calls).toBe(1);

      release("ready");

      await expect(Promise.all([first, second])).resolves.toEqual([
        "ready",
        "ready"
      ]);
    });

    it("runs different keys independently", async () => {
      const singleFlight = createSingleFlight<string, string>();
      let calls = 0;
      const first = singleFlight.run("first", async () => {
        calls += 1;

        return "first";
      });
      const second = singleFlight.run("second", async () => {
        calls += 1;

        return "second";
      });

      expect(first).not.toBe(second);
      await expect(Promise.all([first, second])).resolves.toEqual([
        "first",
        "second"
      ]);
      expect(calls).toBe(2);
    });

    it("evicts rejected work", async () => {
      const singleFlight = createSingleFlight<string, string>();
      let calls = 0;

      await expect(singleFlight.run("user", async () => {
        calls += 1;

        throw new Error("failed");
      })).rejects.toThrow("failed");
      await expect(singleFlight.run("user", async () => {
        calls += 1;

        return "ready";
      })).resolves.toBe("ready");
      expect(calls).toBe(2);
    });

    it("evicts successful work when the TTL is zero", async () => {
      const singleFlight = createSingleFlight<string, number>({
        successTtlMs: 0
      });
      let calls = 0;
      const task = async (): Promise<number> => {
        calls += 1;

        return calls;
      };

      await expect(singleFlight.run("user", task)).resolves.toBe(1);
      await expect(singleFlight.run("user", task)).resolves.toBe(2);
      expect(calls).toBe(2);
    });

    it("retains successful work for a positive TTL", async () => {
      const singleFlight = createSingleFlight<string, number>({
        successTtlMs: 50
      });
      let calls = 0;
      const task = async (): Promise<number> => {
        calls += 1;

        return calls;
      };

      await expect(singleFlight.run("user", task)).resolves.toBe(1);
      await expect(singleFlight.run("user", task)).resolves.toBe(1);
      expect(calls).toBe(1);

      await sleep(60);

      await expect(singleFlight.run("user", task)).resolves.toBe(2);
    });

    it("clears one key without removing other keys", async () => {
      const singleFlight = createSingleFlight<string, number>({
        successTtlMs: 10_000
      });
      let calls = 0;
      const task = async (): Promise<number> => {
        calls += 1;

        return calls;
      };

      await expect(singleFlight.run("first", task)).resolves.toBe(1);
      await expect(singleFlight.run("second", task)).resolves.toBe(2);

      singleFlight.clear("first");

      await expect(singleFlight.run("first", task)).resolves.toBe(3);
      await expect(singleFlight.run("second", task)).resolves.toBe(2);
    });

    it("clears every key when no key is provided", async () => {
      const singleFlight = createSingleFlight<string, string>({
        successTtlMs: 10_000
      });

      await singleFlight.run("first", async () => "first");
      await singleFlight.run("second", async () => "second");

      singleFlight.clear();

      expect(singleFlight.size).toBe(0);
    });

    it("reports in-flight and retained entry count", async () => {
      const singleFlight = createSingleFlight<string, string>({
        successTtlMs: 10_000
      });
      let release = (_value: string): void => {
        throw new Error("task did not start");
      };
      const pending = singleFlight.run("user", () => new Promise((resolve) => {
        release = resolve;
      }));

      expect(singleFlight.size).toBe(1);

      await Promise.resolve();
      release("ready");
      await pending;

      expect(singleFlight.size).toBe(1);
    });

    it("rejects a TTL outside the timer range", () => {
      expect(() => createSingleFlight({
        successTtlMs: 2_147_483_648
      })).toThrow(RangeError);
    });
  });
});
