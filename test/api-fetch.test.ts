import { describe, expect, it, vi } from "vitest";

import {
  ApiHttpError,
  ApiTimeoutError,
  ApiValidationError,
  createApiFetcher,
  endpoint,
  formatApiLogEvent,
  responseEnvelopeSchema,
  type FetchLike,
  z
} from "../src/api-fetch/index.js";

const User = z.object({
  id  : z.number(),
  name: z.string()
});

const CreateUser = z.object({
  name: z.string().min(1)
});

describe("api-fetch", () => {
  it("sends JSON requests and parses schema validated responses", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      id  : 1,
      name: "haru"
    }));
    const api = createApiFetcher({
      baseURL: "https://api.example.com",
      headers: {
        "X-App": "test"
      },
      fetch
    });

    const data = await api.post("/users", {
      body          : { name: "haru" },
      bodySchema    : CreateUser,
      query         : { page: 1, empty: null },
      responseSchema: User
    });

    expect(data).toEqual({
      code: 200,
      data: {
        id  : 1,
        name: "haru"
      }
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/users?page=1",
      expect.objectContaining({
        body  : JSON.stringify({ name: "haru" }),
        method: "POST"
      })
    );

    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);

    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-App")).toBe("test");
  });

  it("sends raw request bodies without JSON serialization", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const api = createApiFetcher({ fetch });
    const body = new URLSearchParams({
      name: "haru"
    });

    await api.post("/users", {
      rawBody: body
    });

    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);

    expect(fetch.mock.calls[0]?.[1]?.body).toBe(body);
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("throws validation errors before invalid JSON requests are sent", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const api = createApiFetcher({ fetch });

    await expect(api.post("/users", {
      body      : { name: "" },
      bodySchema: CreateUser
    })).rejects.toBeInstanceOf(ApiValidationError);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("normalizes successful responses with HTTP status, body message, and validated body", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      message: "created",
      user   : {
        id  : 2,
        name: "haru"
      }
    }, 201));
    const api = createApiFetcher({ fetch });

    const data = await api.post("/users", {
      responseSchema: z.object({
        user: User
      })
    });

    expect(data).toEqual({
      code   : 201,
      message: "created",
      data   : {
        user: {
          id  : 2,
          name: "haru"
        }
      }
    });
  });

  it("throws typed HTTP errors with parsed response bodies", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ message: "unauthorized" }, 401));
    const api = createApiFetcher({ fetch });

    await expect(api.get("/me", {
      responseSchema: User
    })).rejects.toMatchObject({
      body  : { message: "unauthorized" },
      status: 401
    } satisfies Partial<ApiHttpError>);
  });

  it("refreshes access tokens once and retries unauthorized requests", async () => {
    let accessToken = "expired";
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const headers = new Headers(init?.headers);

      if (headers.get("Authorization") === "Bearer fresh") {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ message: "expired" }, 401);
    });
    const refresh = vi.fn(async () => {
      accessToken = "fresh";

      return accessToken;
    });
    const api = createApiFetcher({
      fetch,
      auth: {
        getAccessToken: () => accessToken,
        refresh
      }
    });

    const data = await api.get("/me", {
      responseSchema: z.object({
        ok: z.boolean()
      })
    });

    expect(data).toEqual({
      code: 200,
      data: { ok: true }
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("creates reusable endpoints with path params, query, response schema, and select", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      code: 200,
      data: {
        id  : 7,
        name: "haru"
      }
    }));
    const api = createApiFetcher({
      baseURL: "https://api.example.com",
      fetch
    });
    const getUser = endpoint.get("/users/:id", {
      params: z.object({
        id: z.coerce.number().int().positive()
      }),
      query: () => ({
        include: "profile"
      }),
      responseSchema: responseEnvelopeSchema(User),
      select: (response) => response.data
    });

    const user = await api.call(getUser, {
      params: { id: "7" },
      query : { lang: "ko" }
    });

    expect(user).toEqual({
      id  : 7,
      name: "haru"
    });
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.example.com/users/7?include=profile&lang=ko");
  });

  it("creates reusable endpoints with JSON schemas", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      id  : 8,
      name: "haru"
    }));
    const api = createApiFetcher({
      baseURL: "https://api.example.com",
      fetch
    });
    const createUser = endpoint.post("/users", {
      bodySchema    : CreateUser,
      responseSchema: User
    });

    const user = await api.call(createUser, {
      body: { name: "haru" }
    });

    expect(user.data.id).toBe(8);
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.example.com/users");
  });

  it("retries configured GET status failures", async () => {
    const fetch = vi.fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ message: "try again" }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const api = createApiFetcher({ fetch });

    const data = await api.get("/unstable", {
      retry: 1,
      responseSchema: z.object({
        ok: z.boolean()
      })
    });

    expect(data).toEqual({
      code: 200,
      data: { ok: true }
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws timeout errors when requests exceed timeout", async () => {
    const fetch = vi.fn<FetchLike>(async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new Error("aborted"));
      });
    }));
    const api = createApiFetcher({ fetch });

    await expect(api.get("/slow", {
      timeout: 1
    })).rejects.toBeInstanceOf(ApiTimeoutError);
  });

  it("logs API responses with aligned method, status, duration, and endpoint path", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const logger = vi.fn();
    const api = createApiFetcher({
      baseURL: "https://api.example.com",
      fetch,
      logging: {
        logger
      }
    });

    await api.post("/health", {
      body: { ok: true },
      query: {
        verbose: true
      }
    });

    const message = logger.mock.calls[0]?.[0];

    expect(message).toMatch(/^🌐 POST {3}200 \d{1,4} {0,3}ms\s+\/health$/);
  });

  it("left aligns API log durations to a four digit field", () => {
    const event = {
      method: "GET",
      path  : "/health",
      status: 200,
      type  : "response",
      url   : "https://api.example.com/health"
    } as const;

    expect(formatApiLogEvent({
      ...event,
      durationMs: 1000
    })).toBe("🌐 GET    200 1000ms /health");
    expect(formatApiLogEvent({
      ...event,
      durationMs: 213
    })).toBe("🌐 GET    200 213 ms /health");
    expect(formatApiLogEvent({
      ...event,
      durationMs: 21
    })).toBe("🌐 GET    200 21  ms /health");
  });

  it("logs API failures with warning emoji and endpoint path", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ message: "failed" }, 500));
    const logger = vi.fn();
    const api = createApiFetcher({
      fetch,
      logging: {
        logger
      }
    });

    await expect(api.get("/broken")).rejects.toBeInstanceOf(ApiHttpError);

    const message = logger.mock.calls[0]?.[0];

    expect(message).toMatch(/^⚠️ GET {4}500 \d{1,4} {0,3}ms\s+\/broken$/);
  });

  it("logs request failures with error emoji and ERR code", async () => {
    const fetch = vi.fn<FetchLike>(async () => {
      throw new Error("network down");
    });
    const logger = vi.fn();
    const api = createApiFetcher({
      fetch,
      logging: {
        logger
      }
    });

    await expect(api.get("/offline")).rejects.toThrow("network down");

    const message = logger.mock.calls[0]?.[0];

    expect(message).toMatch(/^❌ GET {4}ERR \d{1,4} {0,3}ms\s+\/offline$/);
  });
});

const jsonResponse = (body: unknown, status = 200): Response => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  }
);
