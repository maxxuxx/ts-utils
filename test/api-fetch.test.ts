import { describe, expect, it, vi } from "vitest";

import {
  ApiAuthError,
  ApiHttpError,
  ApiParseError,
  ApiTimeoutError,
  ApiValidationError,
  createApiFetcher,
  endpoint,
  formatApiLogEvent,
  getApiErrorCode,
  getApiMessage,
  handleApiRoute,
  responseEnvelopeSchema,
  toApiRouteErrorResponse,
  type FetchLike,
  z
} from "../src/api-fetch/index.js";
import {
  createApiFetcher as createSvelteKitApiFetcher
} from "../src/api-fetch/sveltekit.js";
import {
  createServerClock
} from "../src/time/index.js";

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
      code    : 200,
      response: {
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
      response: {
        user: {
          id  : 2,
          name: "haru"
        }
      }
    });
  });

  it("unwraps successful response envelopes without select", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      code   : 2000,
      message: "created",
      data   : {
        id  : 3,
        name: "haru"
      }
    }));
    const api = createApiFetcher({ fetch });
    const responseSchema = z.object({
      code   : z.number(),
      message: z.string(),
      data   : User
    });

    const { code, message, response } = await api.post("/users", {
      responseSchema
    });

    expect(code).toBe(200);
    expect(message).toBe("created");
    expect(response.id).toBe(3);
    expect(response).toEqual({
      id  : 3,
      name: "haru"
    });
  });

  it("keeps non-envelope data bodies under the response key", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      data: {
        list: [
          {
            id  : 4,
            name: "haru"
          }
        ]
      }
    }));
    const api = createApiFetcher({ fetch });

    const result = await api.get("/users", {
      responseSchema: z.object({
        data: z.object({
          list: z.array(User)
        })
      })
    });

    expect(result).toEqual({
      code    : 200,
      response: {
        data: {
          list: [
            {
              id  : 4,
              name: "haru"
            }
          ]
        }
      }
    });
    expect(result.response.data.list[0]?.id).toBe(4);
  });

  it("updates server time clocks from response Date headers without changing results", async () => {
    const times = [1_000, 1_100];
    const clock = createServerClock({
      now: () => 3_000
    });
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      ok: true
    }, 200, {
      Date: new Date(2_000).toUTCString()
    }));
    const api = createApiFetcher({
      fetch,
      serverTime: {
        clock,
        now: () => {
          const next = times.shift();

          if (next === undefined) {
            throw new Error("unexpected clock read");
          }

          return next;
        }
      }
    });

    const result = await api.get("/clock", {
      responseSchema: z.object({
        ok: z.boolean()
      })
    });

    expect(result).toEqual({
      code    : 200,
      response: { ok: true }
    });
    expect(clock.getServerTimeMs()).toBe(3_950);
  });

  it("creates and exposes an internal server time clock when serverTime is true", async () => {
    const times = [0, 1_000, 1_100, 3_000];
    const now = vi.spyOn(Date, "now").mockImplementation(() => {
      const next = times.shift();

      return next ?? 3_000;
    });
    const api = createApiFetcher({
      fetch: async () => jsonResponse({
        ok: true
      }, 200, {
        Date: new Date(2_000).toUTCString()
      }),
      serverTime: true
    });

    try {
      await api.get("/clock");

      expect(api.serverTime?.getServerTimeMs()).toBe(3_950);
    } finally {
      now.mockRestore();
    }
  });

  it("exposes external server time clocks passed to api fetchers", async () => {
    const clock = createServerClock();
    const api = createApiFetcher({
      fetch: async () => jsonResponse({
        ok: true
      }),
      serverTime: {
        clock
      }
    });

    expect(api.serverTime).toBe(clock);
  });

  it("ignores missing or invalid Date headers while preserving API results", async () => {
    const clock = createServerClock({
      now: () => 5_000
    });
    const api = createApiFetcher({
      fetch: async () => jsonResponse({
        ok: true
      }, 200, {
        Date: "not a date"
      }),
      serverTime: {
        clock,
        now: () => 1_000
      }
    });

    await expect(api.get("/clock")).resolves.toEqual({
      code    : 200,
      response: { ok: true }
    });
    expect(clock.getServerTimeMs()).toBeUndefined();
  });

  it("updates server time clocks before throwing HTTP errors", async () => {
    const times = [1_000, 1_100];
    const clock = createServerClock({
      now: () => 3_000
    });
    const api = createApiFetcher({
      fetch: async () => jsonResponse({
        message: "failed"
      }, 503, {
        Date: new Date(2_000).toUTCString()
      }),
      serverTime: {
        clock,
        now: () => times.shift() ?? 0
      }
    });

    await expect(api.get("/clock")).rejects.toBeInstanceOf(ApiHttpError);
    expect(clock.getServerTimeMs()).toBe(3_950);
  });

  it("throws typed HTTP errors with parsed response bodies", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      code   : "UNAUTHORIZED",
      message: "unauthorized"
    }, 401));
    const api = createApiFetcher({ fetch });

    await expect(api.get("/me", {
      responseSchema: User
    })).rejects.toMatchObject({
      body  : {
        code   : "UNAUTHORIZED",
        message: "unauthorized"
      },
      code   : "UNAUTHORIZED",
      message: "unauthorized",
      status: 401
    } satisfies Partial<ApiHttpError>);
  });

  it("uses error fallback values when HTTP error bodies do not include code or message", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ error: "denied" }, 403));
    const api = createApiFetcher({
      errorFallback: {
        code   : "REQUEST_FAILED",
        message: "request failed"
      },
      fetch
    });

    await expect(api.get("/me")).rejects.toMatchObject({
      code   : "REQUEST_FAILED",
      message: "request failed",
      status : 403
    } satisfies Partial<ApiHttpError>);

    await expect(api.get("/me", {
      errorFallback: {
        message: "내 정보를 불러오지 못했습니다"
      }
    })).rejects.toMatchObject({
      body   : { error: "denied" },
      code   : "REQUEST_FAILED",
      message: "내 정보를 불러오지 못했습니다",
      status : 403
    } satisfies Partial<ApiHttpError>);
  });

  it("uses endpoint error fallback values", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ error: "denied" }, 403));
    const api = createApiFetcher({ fetch });
    const getMe = endpoint.get("/me", {
      errorFallback: {
        code   : "ME_FETCH_FAILED",
        message: "내 정보를 불러오지 못했습니다"
      }
    });

    await expect(api.call(getMe)).rejects.toMatchObject({
      code   : "ME_FETCH_FAILED",
      message: "내 정보를 불러오지 못했습니다",
      status : 403
    } satisfies Partial<ApiHttpError>);
  });

  it("keeps server error code and message before fallback values", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      code   : 1001,
      message: "server failed"
    }, 500));
    const api = createApiFetcher({
      errorFallback: {
        code   : "REQUEST_FAILED",
        message: "request failed"
      },
      fetch
    });

    await expect(api.get("/server-error")).rejects.toMatchObject({
      code   : 1001,
      message: "server failed",
      status : 500
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
      code    : 200,
      response: { ok: true }
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("formats token headers with custom auth header logic", async () => {
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const headers = new Headers(init?.headers);

      return jsonResponse({
        authorization: headers.get("Authorization"),
        token        : headers.get("X-Access-Token")
      });
    });
    const api = createApiFetcher({
      fetch,
      auth: {
        formatTokenHeader: (accessToken) => ({
          "X-Access-Token": accessToken
        }),
        getAccessToken: () => "access-token"
      }
    });

    const result = await api.get("/me");

    expect(result.response).toEqual({
      authorization: null,
      token        : "access-token"
    });
  });

  it("keeps explicit request auth headers before formatted token headers", async () => {
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const headers = new Headers(init?.headers);

      return jsonResponse({
        authorization: headers.get("Authorization")
      });
    });
    const api = createApiFetcher({
      fetch,
      auth: {
        getAccessToken: () => "access-token"
      }
    });

    const result = await api.get("/me", {
      headers: {
        Authorization: "Token explicit"
      }
    });

    expect(result.response).toEqual({
      authorization: "Token explicit"
    });
  });

  it("creates SvelteKit fetchers with cookie-bound auth callbacks", async () => {
    const cookies = {
      accessToken: "token"
    };
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const headers = new Headers(init?.headers);

      return jsonResponse({
        authorization: headers.get("Authorization")
      });
    });
    const getAccessToken = vi.fn((input: typeof cookies) => input.accessToken);
    const clear = vi.fn((input: typeof cookies) => {
      input.accessToken = "";
    });
    const api = createSvelteKitApiFetcher({
      cookies,
      fetch,
      auth: {
        clear,
        getAccessToken
      }
    });

    const result = await api.get("/me");

    expect(result.response).toEqual({
      authorization: "Bearer token"
    });
    expect(getAccessToken).toHaveBeenCalledWith(cookies);
    expect(clear).not.toHaveBeenCalled();
  });

  it("passes custom token header formatting through SvelteKit fetchers", async () => {
    const cookies = {
      accessToken: "token"
    };
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const headers = new Headers(init?.headers);

      return jsonResponse({
        authorization: headers.get("Authorization"),
        token        : headers.get("X-Access-Token")
      });
    });
    const api = createSvelteKitApiFetcher({
      cookies,
      fetch,
      auth: {
        formatTokenHeader: (accessToken) => ({
          "X-Access-Token": accessToken
        }),
        getAccessToken: ({ accessToken }) => accessToken
      }
    });

    const result = await api.get("/me");

    expect(result.response).toEqual({
      authorization: null,
      token        : "token"
    });
  });

  it("dedupes SvelteKit auth refreshes across fetcher instances with the same access token", async () => {
    const cookiesA = { accessToken: "expired" };
    const cookiesB = { accessToken: "expired" };
    const refreshGate = createDeferred<void>();
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const headers = new Headers(init?.headers);

      if (headers.get("Authorization") === "Bearer fresh") {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ message: "expired" }, 401);
    });
    const refresh = vi.fn(async (cookies: typeof cookiesA) => {
      await refreshGate.promise;
      cookies.accessToken = "fresh";

      return "fresh";
    });
    const auth = {
      getAccessToken: (cookies: typeof cookiesA) => cookies.accessToken,
      refresh
    };
    const apiA = createSvelteKitApiFetcher({
      cookies: cookiesA,
      fetch,
      auth
    });
    const apiB = createSvelteKitApiFetcher({
      cookies: cookiesB,
      fetch,
      auth
    });

    const requestA = apiA.get("/me", {
      responseSchema: z.object({ ok: z.boolean() })
    });
    const requestB = apiB.get("/me", {
      responseSchema: z.object({ ok: z.boolean() })
    });

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    refreshGate.resolve();

    await expect(Promise.all([requestA, requestB])).resolves.toEqual([
      {
        code    : 200,
        response: { ok: true }
      },
      {
        code    : 200,
        response: { ok: true }
      }
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("keeps SvelteKit auth refreshes separate for different access tokens", async () => {
    const cookiesA = { accessToken: "expired-a" };
    const cookiesB = { accessToken: "expired-b" };
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      const authorization = headers.get("Authorization");

      if (authorization === "Bearer fresh-expired-a" || authorization === "Bearer fresh-expired-b") {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ message: "expired" }, 401);
    });
    const refresh = vi.fn(async (cookies: typeof cookiesA) => {
      const accessToken = `fresh-${cookies.accessToken}`;

      cookies.accessToken = accessToken;

      return accessToken;
    });
    const auth = {
      getAccessToken: (cookies: typeof cookiesA) => cookies.accessToken,
      refresh
    };

    await Promise.all([
      createSvelteKitApiFetcher({
        cookies: cookiesA,
        fetch,
        auth
      }).get("/me"),
      createSvelteKitApiFetcher({
        cookies: cookiesB,
        fetch,
        auth
      }).get("/me")
    ]);

    expect(refresh).toHaveBeenCalledTimes(2);
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

    expect(user.response.id).toBe(8);
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
      code    : 200,
      response: { ok: true }
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

    expect(message).toMatch(/^✅ POST {3}200 {1,4}\d{1,4} ms\s+\/health$/);
  });

  it("right aligns API log durations to a four digit field", () => {
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
    })).toBe("✅ GET    200 1000 ms /health");
    expect(formatApiLogEvent({
      ...event,
      durationMs: 213
    })).toBe("✅ GET    200  213 ms /health");
    expect(formatApiLogEvent({
      ...event,
      durationMs: 21
    })).toBe("✅ GET    200   21 ms /health");
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

    expect(message).toMatch(/^⚠️ GET {4}500 {1,4}\d{1,4} ms\s+\/broken$/);
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

    expect(message).toMatch(/^❌ GET {4}ERR {1,4}\d{1,4} ms\s+\/offline$/);
  });

  it("routes response parse failures to response error hooks", async () => {
    const onRequestError = vi.fn();
    const onResponseError = vi.fn();
    const fetch = vi.fn<FetchLike>(async () => new Response("{bad", {
      headers: {
        "Content-Type": "application/json"
      }
    }));
    const api = createApiFetcher({
      fetch,
      hooks: {
        onRequestError,
        onResponseError
      }
    });

    await expect(api.get("/broken-json")).rejects.toBeInstanceOf(ApiParseError);

    expect(onRequestError).not.toHaveBeenCalled();
    expect(onResponseError).toHaveBeenCalledWith(expect.objectContaining({
      error   : expect.any(ApiParseError),
      response: expect.any(Response)
    }));
  });

  it("routes response validation failures to response error hooks", async () => {
    const onRequestError = vi.fn();
    const onResponseError = vi.fn();
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      id  : "bad",
      name: "haru"
    }));
    const api = createApiFetcher({
      fetch,
      hooks: {
        onRequestError,
        onResponseError
      }
    });

    await expect(api.get("/users/1", {
      responseSchema: User
    })).rejects.toBeInstanceOf(ApiValidationError);

    expect(onRequestError).not.toHaveBeenCalled();
    expect(onResponseError).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        id  : "bad",
        name: "haru"
      },
      error   : expect.any(ApiValidationError),
      response: expect.any(Response)
    }));
  });

  it("handles API route errors as Web responses", async () => {
    await expect(handleApiRoute(() => {
      throw new ApiAuthError("로그인이 필요합니다");
    }, {
      responseMessage: "외부 응답이 올바르지 않습니다"
    })).resolves.toMatchObject({
      status: 401
    });

    const authResponse = await handleApiRoute(() => {
      throw new ApiAuthError("expired");
    }, {
      authMessage    : "다시 로그인해주세요",
      responseMessage: "외부 응답이 올바르지 않습니다"
    });

    await expect(authResponse.json()).resolves.toEqual({
      message: "다시 로그인해주세요"
    });

    const httpResponse = await handleApiRoute(() => {
      throw new ApiHttpError(jsonResponse({
        message: "server failed"
      }, 418), {
        message: "server failed"
      }, {
        method: "GET",
        path  : "/teapot",
        url   : "https://api.example.com/teapot"
      }, {
        message: "server failed"
      });
    }, {
      responseMessage: "외부 응답이 올바르지 않습니다"
    });

    expect(httpResponse.status).toBe(418);
    await expect(httpResponse.json()).resolves.toEqual({
      message: "server failed"
    });
  });

  it("preserves API error codes in API route error responses", async () => {
    const response = await handleApiRoute(() => {
      throw new ApiHttpError(jsonResponse({
        code   : "VALIDATION_ERROR",
        message: "Request validation failed"
      }, 422), {
        code   : "VALIDATION_ERROR",
        message: "Request validation failed"
      }, {
        method: "POST",
        path  : "/duo/posts",
        url   : "https://api.example.com/duo/posts"
      }, {
        code   : "VALIDATION_ERROR",
        message: "Request validation failed"
      });
    }, {
      responseMessage: "요청을 처리하지 못했습니다"
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      code   : "VALIDATION_ERROR",
      message: "Request validation failed"
    });
  });

  it("resolves API route messages from code and status mappings before API messages", async () => {
    const response = await handleApiRoute(() => {
      throw new ApiHttpError(jsonResponse({
        code   : "VALIDATION_ERROR",
        message: "Request validation failed"
      }, 422), {
        code   : "VALIDATION_ERROR",
        message: "Request validation failed"
      }, {
        method: "POST",
        path  : "/duo/posts",
        url   : "https://api.example.com/duo/posts"
      }, {
        code   : "VALIDATION_ERROR",
        message: "Request validation failed"
      });
    }, {
      codeMessages: {
        VALIDATION_ERROR: "배틀태그를 확인해주세요"
      },
      responseMessage: "요청을 처리하지 못했습니다",
      statusMessages : {
        422: "입력 내용을 확인해주세요"
      }
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      code   : "VALIDATION_ERROR",
      message: "배틀태그를 확인해주세요"
    });
  });

  it("uses a default API route error message when no route or API message is available", async () => {
    const response = await handleApiRoute(() => {
      throw new ApiHttpError(jsonResponse({
        ok: false
      }, 503), {
        ok: false
      }, {
        method: "GET",
        path  : "/missing-message",
        url   : "https://api.example.com/missing-message"
      });
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "API request failed"
    });
  });

  it("uses the default API route error message for malformed API responses without route options", async () => {
    const response = await handleApiRoute(() => {
      throw new ApiParseError(new Response("{bad", {
        status: 200
      }), "{bad", {
        method: "GET",
        path  : "/broken-json",
        url   : "https://api.example.com/broken-json"
      });
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: "API request failed"
    });
  });

  it("handles response parsing and validation route errors as bad gateway", async () => {
    const context = {
      method: "GET",
      path  : "/users",
      url   : "https://api.example.com/users"
    } as const;

    const parseResponse = await handleApiRoute(() => {
      throw new ApiParseError(new Response("{bad", {
        status: 200
      }), "{bad", context);
    }, {
      responseMessage: "외부 응답이 올바르지 않습니다"
    });

    expect(parseResponse.status).toBe(502);
    await expect(parseResponse.json()).resolves.toEqual({
      message: "외부 응답이 올바르지 않습니다"
    });

    const validationResponse = toApiRouteErrorResponse(
      new ApiValidationError("response", { issues: [] }, { id: "bad" }, context),
      {
        responseMessage: "응답 스키마가 올바르지 않습니다"
      }
    );

    expect(validationResponse?.status).toBe(502);
    await expect(validationResponse?.json()).resolves.toEqual({
      message: "응답 스키마가 올바르지 않습니다"
    });
  });

  it("does not convert unknown API route errors", async () => {
    const error = new Error("boom");

    await expect(handleApiRoute(() => {
      throw error;
    }, {
      responseMessage: "외부 응답이 올바르지 않습니다"
    })).rejects.toBe(error);

    expect(toApiRouteErrorResponse(error, {
      responseMessage: "외부 응답이 올바르지 않습니다"
    })).toBeNull();
  });

  it("gets API messages from message shaped bodies", () => {
    expect(getApiMessage({ message: "failed" })).toBe("failed");
    expect(getApiMessage({ message: 500 })).toBeUndefined();
    expect(getApiMessage(undefined)).toBeUndefined();
  });

  it("gets API error codes from code shaped bodies", () => {
    expect(getApiErrorCode({ code: "TOKEN_EXPIRED" })).toBe("TOKEN_EXPIRED");
    expect(getApiErrorCode({ code: 1001 })).toBe(1001);
    expect(getApiErrorCode({ code: false })).toBeUndefined();
    expect(getApiErrorCode(undefined)).toBeUndefined();
  });
});

const jsonResponse = (
  body: unknown,
  status = 200,
  headers?: Record<string, string>
): Response => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  }
);

function createDeferred<TValue>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: TValue | PromiseLike<TValue>) => void;
  const promise = new Promise<TValue>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject  = promiseReject;
  });

  return {
    promise,
    reject,
    resolve
  };
}
