import { describe, expect, it } from "vitest";

import {
  PromiseTimeoutError,
  all,
  allObject,
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
    await expect(sleep(-1)).rejects.toThrow(RangeError);
    await expect(withTimeout(() => "ok", {
      timeoutMs: -1
    })).rejects.toThrow(RangeError);
    await expect(retry(() => "ok", {
      retries: 1.5
    })).rejects.toThrow(RangeError);
  });
});
