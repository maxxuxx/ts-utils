import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  ApiAbortError,
  ApiAuthError,
  ApiHttpError,
  ApiParseError,
  ApiRequestError,
  ApiResponseSizeError,
  ApiTimeoutError,
  ApiValidationError,
  buildApiUrl,
  createApiFetcher,
  endpoint,
  formatApiLogEvent,
  getApiErrorCode,
  getApiMessage,
  handleApiRoute,
  responseEnvelopeSchema,
  toApiRouteErrorResponse,
  type ApiEndpoint,
  type FetchLike,
  type RawBodyFactory,
  type RetryStrategy,
  z
} from "../src/api-fetch/index.js";
import {
  createApiFetcher as createSvelteKitApiFetcher,
  createSvelteKitRefreshNamespace,
  type SvelteKitRefreshAuthOptions,
  type SvelteKitRefreshNamespace
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

  it("keeps schema-free response payloads unknown while preserving select inference", async () => {
    const api = createApiFetcher({
      fetch: async () => jsonResponse({
        id  : 1,
        name: "haru"
      })
    });
    const rawResult = await api.get("/raw");
    const schemaResult = await api.get("/schema", {
      responseSchema: User
    });
    const schemaSelected = await api.get("/schema-selected", {
      responseSchema: User,
      select        : (data) => data.name
    });
    const selected = await api.get("/selected", {
      select: (data) => ({
        present: typeof data === "object" && data !== null && "id" in data
      })
    });
    const selectedEndpoint = endpoint.get("/selected-endpoint", {
      select: (data) => typeof data === "object" && data !== null
    });
    const endpointResult = await api.call(selectedEndpoint);
    const bodyAndResponseSelected = await api.post("/body-response-selected", {
      body          : { name: "haru" },
      bodySchema    : CreateUser,
      responseSchema: User,
      select        : (data) => data.id
    });

    expectTypeOf(rawResult.response).toBeUnknown();
    expectTypeOf(schemaResult.response).toEqualTypeOf<{
      id  : number;
      name: string;
    }>();
    expectTypeOf(schemaSelected).toBeString();
    expectTypeOf(selected).toEqualTypeOf<{ present: boolean }>();
    expectTypeOf(endpointResult).toBeBoolean();
    expectTypeOf(bodyAndResponseSelected).toBeNumber();

    if (false) {
      // @ts-expect-error schema-free reads cannot claim an unchecked output type
      await api.get<{ id: number }>("/raw");
      // @ts-expect-error schema-free writes cannot claim an unchecked output type
      await api.post<{ id: number }>("/raw");
      // @ts-expect-error schema-free requests cannot claim an unchecked output type
      await api.request<{ id: number }>("GET", "/raw");
      // @ts-expect-error schema-free endpoints cannot claim an unchecked output type
      endpoint.get<{ id: number }>("/raw");

      // @ts-expect-error a response schema generic requires the runtime schema
      await api.get<typeof User>("/raw", {});
      // @ts-expect-error a body schema generic requires options with bodySchema
      await api.post<typeof CreateUser>("/raw");
      // @ts-expect-error request body schema generics require runtime options
      await api.request<typeof CreateUser>("POST", "/raw");

      const Params = z.object({ id: z.number() });

      // @ts-expect-error endpoint schema generics require params and bodySchema
      endpoint.post<typeof Params, typeof CreateUser>("/users/:id");

      const forgedEndpoint: ApiEndpoint<
        undefined,
        undefined,
        undefined,
        { id: number }
      > = {
        method : "GET",
        // @ts-expect-error custom endpoint results require a runtime select function
        options: {},
        path   : "/raw"
      };

      await api.call(forgedEndpoint);
    }
  });

  it("preserves complete fragments when appending query to relative paths", () => {
    expect(buildApiUrl("/search#first#second#third", undefined, {
      page: 1
    })).toBe("/search?page=1#first#second#third");
  });

  it("rejects raw body and raw body factory together before fetch", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const rawBodyFactory = vi.fn(async () => new URLSearchParams({ fresh: "body" }));
    const api = createApiFetcher({ fetch });

    await expect(api.post("/users", {
      rawBody       : new URLSearchParams({ stale: "body" }),
      rawBodyFactory
    })).rejects.toThrow(TypeError);

    expect(fetch).not.toHaveBeenCalled();
    expect(rawBodyFactory).not.toHaveBeenCalled();
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

  it("throws typed HTTP errors with sanitized public properties", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      code   : "UNAUTHORIZED",
      message: "unauthorized"
    }, 401));
    const api = createApiFetcher({ fetch });

    await expect(api.get("/me", {
      responseSchema: User
    })).rejects.toMatchObject({
      code   : "UNAUTHORIZED",
      message: "API request failed: GET /me (401)",
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

  it("keeps server error codes while using configured safe messages", async () => {
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
      message: "request failed",
      status : 500
    } satisfies Partial<ApiHttpError>);
  });

  it("omits auth headers from untrusted origins", async () => {
    let capturedHeaders: Headers | undefined;
    const api = createApiFetcher({
      baseURL: "https://api.example.com",
      auth: {
        getAccessToken: async () => "secret"
      },
      fetch: async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);

        return jsonResponse({ ok: true });
      }
    });

    await api.get("https://attacker.example/collect");

    expect(capturedHeaders?.get("Authorization")).toBeNull();
  });

  it("attaches auth headers to explicitly allowed origins", async () => {
    let capturedHeaders: Headers | undefined;
    const api = createApiFetcher({
      allowedOrigins: ["https://uploads.example.com"],
      baseURL       : "https://api.example.com",
      auth: {
        getAccessToken: async () => "secret"
      },
      fetch: async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);

        return jsonResponse({ ok: true });
      }
    });

    await api.get("https://uploads.example.com/avatar");

    expect(capturedHeaders?.get("Authorization")).toBe("Bearer secret");
  });

  it("does not trust a request-level baseURL as an implicit auth origin", async () => {
    const captured: Headers[] = [];
    const api = createApiFetcher({
      baseURL: "https://api.example.com",
      headers: {
        Authorization        : "Client secret",
        "Proxy-Authorization": "Client proxy secret"
      },
      auth: {
        getAccessToken: async () => "bearer-secret"
      },
      fetch: async (_input, init) => {
        captured.push(new Headers(init?.headers));

        return jsonResponse({ ok: true });
      }
    });

    await api.get("/collect", {
      baseURL: "https://attacker.example",
      headers: {
        authorization        : "Request secret",
        "proxy-authorization": "Request proxy secret"
      }
    });

    expect(captured[0]?.get("Authorization")).toBeNull();
    expect(captured[0]?.get("Proxy-Authorization")).toBeNull();
  });

  it("uses one trusted URL snapshot when a request baseURL getter mutates", async () => {
    let accessToken = "expired";
    let baseURLReads = 0;
    const calls: Array<{
      authorization: string | null;
      url          : string;
    }> = [];
    const requestOptions = {
      get baseURL() {
        baseURLReads += 1;

        return baseURLReads === 1
          ? "https://api.example.com"
          : "https://attacker.example";
      },
      query: {
        page: 1
      }
    };
    const api = createApiFetcher({
      baseURL: "https://api.example.com",
      auth: {
        getAccessToken: () => accessToken,
        refresh       : async (_error, expectedAccessToken) => {
          expect(expectedAccessToken).toBe("expired");
          accessToken = "fresh";

          return accessToken;
        }
      },
      fetch: async (input, init) => {
        const authorization = new Headers(init?.headers).get("Authorization");

        calls.push({
          authorization,
          url          : String(input)
        });

        return authorization === "Bearer fresh"
          ? jsonResponse({ ok: true })
          : jsonResponse({ message: "expired" }, 401);
      }
    });

    await api.get("/private", requestOptions);

    expect(baseURLReads).toBe(1);
    expect(calls).toEqual([
      {
        authorization: "Bearer expired",
        url          : "https://api.example.com/private?page=1"
      },
      {
        authorization: "Bearer fresh",
        url          : "https://api.example.com/private?page=1"
      }
    ]);
    expect(calls.some((call) => (
      call.url.includes("attacker.example") && call.authorization !== null
    ))).toBe(false);
  });

  it("snapshots a client baseURL getter once at fetcher construction", async () => {
    let baseURLReads = 0;
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const api = createApiFetcher({
      get baseURL() {
        baseURLReads += 1;

        return baseURLReads === 1
          ? "https://api.example.com"
          : "https://attacker.example";
      },
      fetch
    });

    await api.get("/health");

    expect(baseURLReads).toBe(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/health",
      expect.any(Object)
    );
  });

  it("strips merged endpoint auth headers from untrusted origins", async () => {
    let capturedHeaders: Headers | undefined;
    const collect = endpoint.get("https://attacker.example/collect", {
      headers: {
        Authorization        : "Endpoint secret",
        "Proxy-Authorization": "Endpoint proxy secret"
      }
    });
    const api = createApiFetcher({
      allowedOrigins: [],
      baseURL       : "https://api.example.com",
      headers: {
        Authorization: "Client secret"
      },
      fetch: async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);

        return jsonResponse({ ok: true });
      }
    });

    await api.call(collect, {
      headers: {
        authorization        : "Call secret",
        "proxy-authorization": "Call proxy secret"
      }
    });

    expect(capturedHeaders?.get("Authorization")).toBeNull();
    expect(capturedHeaders?.get("Proxy-Authorization")).toBeNull();
  });

  it.each([
    String.raw`\\attacker.example\collect`,
    String.raw`/\attacker.example/collect`,
    "  //attacker.example/collect"
  ])("omits auth headers from ambiguous network path %s", async (path) => {
    for (const baseURL of [undefined, "https://api.example.com"]) {
      let capturedHeaders: Headers | undefined;
      const api = createApiFetcher({
        baseURL,
        auth: {
          getAccessToken: async () => "secret"
        },
        fetch: async (_input, init) => {
          capturedHeaders = new Headers(init?.headers);

          return jsonResponse({ ok: true });
        }
      });

      await api.get(path);

      expect(capturedHeaders?.get("Authorization")).toBeNull();
    }
  });

  it("does not trust the internal relative-resolution origin", async () => {
    let capturedHeaders: Headers | undefined;
    const api = createApiFetcher({
      auth: {
        getAccessToken: async () => "secret"
      },
      fetch: async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);

        return jsonResponse({ ok: true });
      }
    });

    await api.get("https://relative.invalid/collect");

    expect(capturedHeaders?.get("Authorization")).toBeNull();
  });

  it.each([
    "//relative.invalid/collect",
    String.raw`\\relative.invalid\collect`
  ])("does not trust sentinel-origin network path %s", async (path) => {
    let capturedHeaders: Headers | undefined;
    const api = createApiFetcher({
      auth: {
        getAccessToken: async () => "secret"
      },
      fetch: async (_input, init) => {
        capturedHeaders = new Headers(init?.headers);

        return jsonResponse({ ok: true });
      }
    });

    await api.get(path);

    expect(capturedHeaders?.get("Authorization")).toBeNull();
  });

  it("keeps secrets unreachable from public HTTP error properties", async () => {
    const api = createApiFetcher({
      baseURL: "https://api.example.com",
      fetch  : async () => jsonResponse({
        message: "upstream-token",
        secret : "response-body-token"
      }, 403, {
        "X-Secret": "response-header-token"
      })
    });
    const error = await api.get("/private?token=query-token#fragment-token")
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiHttpError);
    expect(error).not.toHaveProperty("body");
    expect(error).not.toHaveProperty("response");
    expect(error).not.toHaveProperty("statusText");
    expect(error).toMatchObject({
      context: {
        path: "/private",
        url : "https://api.example.com/private"
      }
    });

    const exposed = JSON.stringify(Object.fromEntries(
      Object.getOwnPropertyNames(error as object).map((key) => [
        key,
        (error as Record<string, unknown>)[key]
      ])
    ));

    expect(exposed).not.toContain("query-token");
    expect(exposed).not.toContain("fragment-token");
    expect(exposed).not.toContain("upstream-token");
    expect(exposed).not.toContain("response-body-token");
    expect(exposed).not.toContain("response-header-token");
  });

  it("redacts URL userinfo from public error contexts and messages", async () => {
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ message: "failed" }, 500)
    });
    const error = await api.get(
      "https://url-user:url-password@api.example.com/private?token=query#fragment"
    ).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiHttpError);
    expect(error).toMatchObject({
      context: {
        path: "https://api.example.com/private",
        url : "https://api.example.com/private"
      }
    });
    expect((error as Error).message).not.toContain("url-user");
    expect((error as Error).message).not.toContain("url-password");
    expect(JSON.stringify(error)).not.toContain("url-user");
    expect(JSON.stringify(error)).not.toContain("url-password");
  });

  it.each([
    "ftp://ftp-user:ftp-password@files.example.com/private?token=query#fragment",
    "ws://ws-user:ws-password@socket.example.com/private?token=query#fragment",
    String.raw`https:\\http-user:http-password@api.example.com/private?token=query#fragment`,
    String.raw`ftp:\\ftp-user:ftp-password@files.example.com/private?token=query#fragment`,
    String.raw`ws:\\ws-user:ws-password@socket.example.com/private?token=query#fragment`,
    String.raw`https:\http-user:http-password@api.example.com/private?token=query#fragment`,
    "https:/http-user:http-password@api.example.com/private?token=query#fragment",
    "https:http-user:http-password@api.example.com/private?token=query#fragment",
    String.raw`ftp:\ftp-user:ftp-password@files.example.com/private?token=query#fragment`,
    "ftp:/ftp-user:ftp-password@files.example.com/private?token=query#fragment",
    "ftp:ftp-user:ftp-password@files.example.com/private?token=query#fragment",
    String.raw`ws:\ws-user:ws-password@socket.example.com/private?token=query#fragment`,
    "ws:/ws-user:ws-password@socket.example.com/private?token=query#fragment",
    "ws:ws-user:ws-password@socket.example.com/private?token=query#fragment"
  ])("redacts hierarchical URL userinfo for %s", async (url) => {
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ message: "failed" }, 500)
    });
    const error = await api.get(url).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).context.path).not.toMatch(/user|password|token|fragment/);
    expect((error as ApiHttpError).context.url).not.toMatch(/user|password|token|fragment/);
    expect((error as Error).message).not.toMatch(/user|password|token|fragment/);
  });

  it("fails closed when an invalid absolute URL contains credentials", async () => {
    const invalidUrl = "https://url-user:url-password@[invalid/private?token=query#fragment";
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const api = createApiFetcher({ fetch });
    const error = await api.get(invalidUrl).catch((reason: unknown) => reason);

    expect(error).toMatchObject({
      context: {
        path: "[invalid-url]",
        url : "[invalid-url]"
      },
      name: "ApiRequestError"
    });
    expect(getExposedErrorText(error)).not.toMatch(/url-user|url-password|query|fragment/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    "ftp://ftp-user:ftp-password@[invalid/private?token=query#fragment",
    "ws://ws-user:ws-password@[invalid/private?token=query#fragment"
  ])("normalizes native fetch URL failures without exposing %s", async (url) => {
    const api = createApiFetcher();
    const error = await api.get(url).catch((reason: unknown) => reason);

    expect(error).toMatchObject({
      context: {
        path: "[invalid-url]",
        url : "[invalid-url]"
      },
      name: "ApiRequestError"
    });
    expect(getExposedErrorText(error)).not.toMatch(/user|password|token|fragment/);
  });

  it.each([
    "ftp://ftp-user:ftp-password@[invalid/private?token=query#fragment",
    "ws://ws-user:ws-password@[invalid/private?token=query#fragment"
  ])("does not resolve malformed scheme URL %s against baseURL", async (url) => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const api = createApiFetcher({
      baseURL: "https://api.example.com",
      fetch
    });
    const error = await api.get(url).catch((reason: unknown) => reason);

    expect(error).toMatchObject({
      context: {
        path: "[invalid-url]",
        url : "[invalid-url]"
      },
      name  : "ApiRequestError",
      reason: "URL_RESOLUTION_FAILURE"
    });
    expect(getExposedErrorText(error)).not.toMatch(/user|password|token|fragment/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps transport failures sanitized in hooks and retry callbacks", async () => {
    const callbackErrors: unknown[] = [];
    const api = createApiFetcher({
      fetch: async () => {
        throw Object.assign(new TypeError("transport-user:transport-password"), {
          input: "https://transport-user:transport-password@example.com/?token=secret"
        });
      },
      hooks: {
        onRequestError: ({ error }) => {
          callbackErrors.push(error);
        }
      }
    });
    const error = await api.get("/offline", {
      retry: {
        limit      : 1,
        shouldRetry: ({ error: retryError }) => {
          callbackErrors.push(retryError);

          return false;
        }
      }
    }).catch((reason: unknown) => reason);

    expect(error).toMatchObject({
      name  : "ApiRequestError",
      reason: "TRANSPORT_FAILURE"
    });
    expect(callbackErrors).toHaveLength(2);
    expect(callbackErrors).toEqual([
      expect.any(ApiRequestError),
      expect.any(ApiRequestError)
    ]);
    expect(getExposedErrorText(error)).not.toMatch(/transport-user|transport-password|secret/);
    expect(callbackErrors.map(getExposedErrorText).join(" "))
      .not.toMatch(/transport-user|transport-password|secret/);
  });

  it("blocks automatic redirects that would forward generated custom auth", async () => {
    const receivedApiKeys: Array<string | undefined> = [];
    const targetServer = createServer((request, response) => {
      const apiKey = request.headers["x-api-key"];

      receivedApiKeys.push(Array.isArray(apiKey) ? apiKey[0] : apiKey);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });
    const redirectServer = createServer((_request, response) => {
      response.writeHead(302, {
        Location: `${getServerOrigin(targetServer)}/target`
      });
      response.end();
    });

    await listenServer(targetServer);
    await listenServer(redirectServer);

    try {
      const api = createApiFetcher({
        baseURL: getServerOrigin(redirectServer),
        auth   : {
          formatTokenHeader: (accessToken) => ({
            "X-API-Key": accessToken
          }),
          getAccessToken: () => "redirect-secret"
        }
      });
      const error = await api.get("/redirect").catch((reason: unknown) => reason);

      expect(error).toMatchObject({
        name  : "ApiHttpError",
        status: 302
      });
      expect(receivedApiKeys).toEqual([]);
    } finally {
      await Promise.all([
        closeServer(redirectServer),
        closeServer(targetServer)
      ]);
    }
  });

  it("keeps parse and validation payloads unreachable from public errors", async () => {
    const parseApi = createApiFetcher({
      fetch: async () => new Response('{"token":"parse-token"', {
        headers: {
          "Content-Type": "application/json"
        }
      })
    });
    const parseError = await parseApi.get("/parse?token=query-token")
      .catch((reason: unknown) => reason);

    expect(parseError).toBeInstanceOf(ApiParseError);
    expect(parseError).not.toHaveProperty("text");
    expect(parseError).toMatchObject({
      context: {
        path: "/parse",
        url : "/parse"
      }
    });
    expect(JSON.stringify(parseError)).not.toContain("parse-token");
    expect(JSON.stringify(parseError)).not.toContain("query-token");

    const validationApi = createApiFetcher({
      fetch: async () => jsonResponse({
        secret: "validation-token"
      })
    });
    const validationError = await validationApi.get("/validate?token=query-token", {
      responseSchema: z.object({
        id: z.number()
      })
    }).catch((reason: unknown) => reason);

    expect(validationError).toBeInstanceOf(ApiValidationError);
    expect(validationError).not.toHaveProperty("body");
    expect(validationError).toMatchObject({
      context: {
        path: "/validate",
        url : "/validate"
      }
    });
    expect(JSON.stringify(validationError)).not.toContain("validation-token");
    expect(JSON.stringify(validationError)).not.toContain("query-token");
  });

  it("redacts endpoint validation error paths before request execution", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const api = createApiFetcher({ fetch });
    const getUser = endpoint.get("/users/:id?token=query-token#fragment-token", {
      params: z.object({
        id: z.number()
      })
    });
    const error = await api.call(getUser, {
      params: {
        id: "invalid" as unknown as number
      }
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiValidationError);
    expect(error).toMatchObject({
      context: {
        path: "/users/:id",
        url : "/users/:id"
      }
    });
    expect(JSON.stringify(error)).not.toContain("query-token");
    expect(JSON.stringify(error)).not.toContain("fragment-token");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not expose custom validation issue secrets", async () => {
    const bodySchema = z.string().superRefine((value, context) => {
      context.addIssue({
        code   : "custom",
        message: `invalid ${value}`,
        params : {
          value
        }
      });
    });
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ ok: true })
    });
    const error = await api.post("/validate", {
      body      : "validation-secret",
      bodySchema
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiValidationError);
    expect(error).not.toHaveProperty("validationError");
    expect(JSON.stringify(error)).not.toContain("validation-secret");
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

  it("refreshes an eligible auth request that initially has no access token", async () => {
    let accessToken: string | null = null;
    const refresh = vi.fn(async () => {
      accessToken = "fresh";

      return accessToken;
    });
    const fetch = vi.fn<FetchLike>(async (_input, init) => (
      new Headers(init?.headers).get("Authorization") === "Bearer fresh"
        ? jsonResponse({ ok: true })
        : jsonResponse({ message: "missing" }, 401)
    ));
    const api = createApiFetcher({
      fetch,
      auth: {
        getAccessToken: () => accessToken,
        refresh
      }
    });

    await expect(api.get("/private")).resolves.toMatchObject({
      response: { ok: true }
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("normalizes access tokens before comparing refresh generations", async () => {
    const fetch = vi.fn<FetchLike>(async (_input, init) => (
      new Headers(init?.headers).get("Authorization") === "Bearer fresh"
        ? jsonResponse({ ok: true })
        : jsonResponse({ message: "expired" }, 401)
    ));
    const api = createApiFetcher({
      fetch,
      auth: {
        getAccessToken: () => " expired ",
        refresh       : async () => "fresh"
      }
    });

    await expect(api.get("/private")).resolves.toMatchObject({
      response: { ok: true }
    });
    expect(fetch.mock.calls.map((call) => (
      new Headers(call[1]?.headers).get("Authorization")
    ))).toEqual([
      "Bearer expired",
      "Bearer fresh"
    ]);
  });

  it("normalizes auth refresh errors without retaining callback secrets", async () => {
    const refreshError = Object.assign(new Error("refresh-secret"), {
      body   : { accessToken: "body-secret" },
      headers: { Authorization: "header-secret" }
    });
    const clear = vi.fn(async () => undefined);
    const api = createApiFetcher({
      baseURL: "https://api.example.com",
      fetch  : async () => jsonResponse({ message: "expired" }, 401),
      auth: {
        clear,
        getAccessToken: async () => "expired",
        refresh       : async () => {
          throw refreshError;
        }
      }
    });

    const error = await api.get("/private?token=secret#debug")
      .catch((reason: unknown) => reason);

    expect(error).toMatchObject({
      cause: {
        type: "AUTH_CALLBACK_FAILURE"
      },
      context: {
        method: "GET",
        path  : "/private",
        url   : "https://api.example.com/private"
      },
      message: "API authentication failed",
      name   : "ApiAuthError"
    });
    expect((error as ApiAuthError).cause).not.toBe(refreshError);
    expect(JSON.stringify(error)).not.toContain("refresh-secret");
    expect(JSON.stringify(error)).not.toContain("body-secret");
    expect(JSON.stringify(error)).not.toContain("header-secret");
    await vi.waitFor(() => {
      expect(clear).toHaveBeenCalledTimes(1);
    });
  });

  it("does not trust an ApiHttpError thrown by an auth callback", async () => {
    const callbackError = new ApiHttpError(
      jsonResponse({ message: "response-secret" }, 418),
      { token: "body-secret" },
      {
        method: "GET",
        path  : "/callback?token=query-secret",
        url   : "https://api.example.com/callback?token=query-secret"
      },
      {
        message: "callback-http-secret"
      }
    );
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ message: "expired" }, 401),
      auth : {
        getAccessToken: () => "expired",
        refresh       : async () => {
          throw callbackError;
        }
      }
    });
    const error = await api.get("/private")
      .catch((reason: unknown) => reason);

    expect(error).toMatchObject({
      cause: {
        type: "AUTH_CALLBACK_FAILURE"
      },
      name: "ApiAuthError"
    });
    expect((error as ApiAuthError).cause).not.toBe(callbackError);
    expect(JSON.stringify(error)).not.toContain("callback-http-secret");
    expect(JSON.stringify(error)).not.toContain("query-secret");
  });

  it("does not treat an ApiAbortError thrown by refresh as caller cancellation", async () => {
    const callbackError = new ApiAbortError(
      {
        body   : "abort-body-secret",
        headers: { Authorization: "abort-header-secret" }
      },
      {
        method: "GET",
        path  : "/callback?token=abort-query-secret",
        url   : "https://api.example.com/callback?token=abort-query-secret"
      }
    );
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ message: "expired" }, 401),
      auth : {
        getAccessToken: () => "expired",
        refresh       : async () => {
          throw callbackError;
        }
      }
    });
    const error = await api.get("/private")
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiAuthError);
    expect(error).toMatchObject({
      cause: {
        type: "AUTH_CALLBACK_FAILURE"
      }
    });
    expect(error).not.toBe(callbackError);
    expect(JSON.stringify(error)).not.toContain("abort-body-secret");
    expect(JSON.stringify(error)).not.toContain("abort-header-secret");
    expect(JSON.stringify(error)).not.toContain("abort-query-secret");
  });

  it("rebuilds observed caller aborts instead of exposing callback-owned errors", async () => {
    const controller = new AbortController();
    const callbackError = new ApiAbortError(
      { secret: "callback-abort-secret" },
      {
        method: "GET",
        path  : "/callback",
        url   : "/callback"
      }
    );
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ message: "expired" }, 401),
      auth : {
        getAccessToken: () => "expired",
        refresh       : async () => {
          controller.abort("caller cancelled");

          throw callbackError;
        }
      }
    });
    const error = await api.get("/private", {
      signal: controller.signal
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiAbortError);
    expect(error).not.toBe(callbackError);
    expect(error).toMatchObject({
      cause: "caller cancelled",
      name : "ApiAbortError"
    });
    expect(JSON.stringify(error)).not.toContain("callback-abort-secret");
  });

  it("normalizes auth refreshes that return no access token", async () => {
    const clear = vi.fn(async () => undefined);
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ message: "expired" }, 401),
      auth : {
        clear,
        getAccessToken: async () => "expired",
        refresh       : async () => null
      }
    });

    await expect(api.get("/private")).rejects.toMatchObject({
      cause: {
        status: 401,
        type  : "HTTP_FAILURE"
      },
      name : "ApiAuthError"
    });
    await vi.waitFor(() => {
      expect(clear).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ["whitespace", "   "],
    ["control character", "fresh\nsecret"],
    ["non-string", { token: "fresh" }]
  ])("rejects unusable %s refresh results without retrying", async (_label, refreshed) => {
    const clear = vi.fn(async () => undefined);
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ message: "expired" }, 401));
    const api = createApiFetcher({
      fetch,
      auth: {
        clear,
        getAccessToken: async () => "expired",
        refresh       : async () => refreshed as unknown as string
      }
    });

    await expect(api.get("/private")).rejects.toMatchObject({
      cause: {
        type: "AUTH_CALLBACK_FAILURE"
      },
      name: "ApiAuthError"
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(clear).toHaveBeenCalledTimes(1);
    });
  });

  it("isolates refresh flights by failed access-token generation", async () => {
    let accessToken = "old";
    const oldRefresh = createDeferred<string>();
    const newRefresh = createDeferred<string>();
    const refresh = vi.fn(async () => (
      accessToken === "old" ? oldRefresh.promise : newRefresh.promise
    ));
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const token = new Headers(init?.headers).get("Authorization");

      return token === "Bearer current" || token === "Bearer newest"
        ? jsonResponse({ token })
        : jsonResponse({ message: "expired" }, 401);
    });
    const api = createApiFetcher({
      fetch,
      auth: {
        getAccessToken: () => accessToken,
        refresh
      }
    });

    const oldRequest = api.get("/old");

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    accessToken = "new";
    const newRequest = api.get("/new");

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    accessToken = "current";
    oldRefresh.resolve("stale-old-refresh");
    newRefresh.resolve("newest");

    await expect(oldRequest).resolves.toMatchObject({
      response: { token: "Bearer current" }
    });
    await expect(newRequest).resolves.toMatchObject({
      response: { token: "Bearer current" }
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.map((call) => (
      new Headers(call[1]?.headers).get("Authorization")
    ))).not.toContain("Bearer stale-old-refresh");
  });

  it("does not clear a newer login after an old 401 without refresh", async () => {
    let accessToken = "old-login";
    const clear = vi.fn(async (_expectedAccessToken?: string | null) => {
      accessToken = "";
    });
    const api = createApiFetcher({
      fetch: async () => {
        accessToken = "new-login";

        return jsonResponse({ message: "expired" }, 401);
      },
      auth: {
        clear,
        getAccessToken: () => accessToken
      }
    });

    await expect(api.get("/private")).rejects.toBeInstanceOf(ApiAuthError);
    await Promise.resolve();

    expect(accessToken).toBe("new-login");
    expect(clear).not.toHaveBeenCalled();
  });

  it("does not refresh or clear bearer auth for an explicit Authorization request", async () => {
    const clear = vi.fn(async () => undefined);
    const getAccessToken = vi.fn(() => {
      throw new Error("suppressed bearer getter must not run");
    });
    const refresh = vi.fn(async () => "fresh-bearer");
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe("Basic explicit");

      return jsonResponse({ message: "basic rejected" }, 401);
    });
    const api = createApiFetcher({
      fetch,
      auth: {
        clear,
        formatTokenHeader: (accessToken) => ({
          Authorization: `Bearer ${accessToken}`
        }),
        getAccessToken,
        refresh
      }
    });

    await expect(api.get("/basic", {
      headers: {
        Authorization: "Basic explicit"
      }
    })).rejects.toBeInstanceOf(ApiHttpError);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it("does not refresh when explicit Proxy-Authorization suppresses a custom token header", async () => {
    const clear = vi.fn(async () => undefined);
    const getAccessToken = vi.fn(() => {
      throw new Error("suppressed proxy getter must not run");
    });
    const refresh = vi.fn(async () => "fresh-proxy-token");
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      expect(new Headers(init?.headers).get("Proxy-Authorization")).toBe("Basic proxy");

      return jsonResponse({ message: "proxy rejected" }, 419);
    });
    const api = createApiFetcher({
      fetch,
      auth: {
        clear,
        formatTokenHeader: (accessToken) => ({
          "Proxy-Authorization": `Bearer ${accessToken}`
        }),
        getAccessToken,
        refresh
      }
    });

    await expect(api.get("/proxy", {
      headers: {
        "Proxy-Authorization": "Basic proxy"
      }
    })).rejects.toBeInstanceOf(ApiHttpError);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it("uses a newer login token when an older refresh fails", async () => {
    let accessToken = "old";
    const refreshGate = createDeferred<string>();
    const clear = vi.fn(async () => undefined);
    const fetch = vi.fn<FetchLike>(async (_input, init) => (
      new Headers(init?.headers).get("Authorization") === "Bearer new-login"
        ? jsonResponse({ ok: true })
        : jsonResponse({ message: "expired" }, 401)
    ));
    const api = createApiFetcher({
      fetch,
      auth: {
        clear,
        getAccessToken: () => accessToken,
        refresh       : () => refreshGate.promise
      }
    });
    const request = api.get("/private");

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    accessToken = "new-login";
    refreshGate.reject(new Error("stale refresh failure"));

    await expect(request).resolves.toMatchObject({
      response: { ok: true }
    });
    expect(clear).not.toHaveBeenCalled();
  });

  it("aborts one caller waiting on shared refresh without cancelling the flight", async () => {
    const refreshGate = createDeferred<string>();
    const refresh = vi.fn(() => refreshGate.promise);
    const fetch = vi.fn<FetchLike>(async (_input, init) => (
      new Headers(init?.headers).get("Authorization") === "Bearer fresh"
        ? jsonResponse({ ok: true })
        : jsonResponse({ message: "expired" }, 401)
    ));
    const api = createApiFetcher({
      fetch,
      auth: {
        getAccessToken: () => "expired",
        refresh
      }
    });
    const controller = new AbortController();
    const aborted = api.get("/aborted", {
      signal: controller.signal
    });
    const active = api.get("/active");

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    controller.abort("caller cancelled");

    await expect(aborted).rejects.toBeInstanceOf(ApiAbortError);
    expect(refresh).toHaveBeenCalledTimes(1);

    refreshGate.resolve("fresh");

    await expect(active).resolves.toMatchObject({
      response: { ok: true }
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("aborts an initial access-token getter wait promptly", async () => {
    const getterStarted = createDeferred<void>();
    const controller = new AbortController();
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ ok: true }),
      auth : {
        getAccessToken: async () => {
          getterStarted.resolve();

          return new Promise<string>(() => undefined);
        }
      }
    });
    const pending = api.get("/private", {
      signal: controller.signal
    });

    await getterStarted.promise;
    controller.abort("initial getter cancelled");

    const result = await Promise.race([
      pending.catch((error: unknown) => error),
      new Promise<"timeout">((resolve) => {
        setTimeout(() => resolve("timeout"), 100);
      })
    ]);

    expect(result).toBeInstanceOf(ApiAbortError);
    expect(result).not.toBe("timeout");
  });

  it("does not let a never-settling best-effort clear hide the auth error", async () => {
    const clear = vi.fn(() => new Promise<void>(() => undefined));
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ message: "expired" }, 401),
      auth : {
        clear,
        getAccessToken: () => "expired"
      }
    });
    const result = await Promise.race([
      api.get("/private").catch((error: unknown) => error),
      new Promise<"timeout">((resolve) => {
        setTimeout(() => resolve("timeout"), 100);
      })
    ]);

    expect(result).toBeInstanceOf(ApiAuthError);
    expect(result).not.toBe("timeout");
    await vi.waitFor(() => {
      expect(clear).toHaveBeenCalledWith("expired");
    });
  });

  it("normalizes non-ByteString access tokens and clears without fetching", async () => {
    const clear = vi.fn(async () => undefined);
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const api = createApiFetcher({
      fetch,
      auth: {
        clear,
        getAccessToken: () => "🔒-secret"
      }
    });

    await expect(api.get("/private")).rejects.toMatchObject({
      cause: {
        type: "AUTH_CALLBACK_FAILURE"
      },
      name: "ApiAuthError"
    });
    await vi.waitFor(() => {
      expect(clear).toHaveBeenCalledWith("🔒-secret");
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("normalizes auth responses when no refresh callback exists", async () => {
    const clear = vi.fn(async () => undefined);
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ message: "expired" }, 401),
      auth : {
        clear,
        getAccessToken: async () => "expired"
      }
    });

    await expect(api.get("/private")).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 401
      }),
      name: "ApiAuthError"
    });
    await vi.waitFor(() => {
      expect(clear).toHaveBeenCalledTimes(1);
    });
  });

  it("prioritizes malformed auth responses before body parsing", async () => {
    const clear = vi.fn(async () => undefined);
    const refresh = vi.fn(async () => "fresh");
    const fetch = vi.fn<FetchLike>(async () => new Response("{bad", {
      headers: {
        "Content-Type": "application/json"
      },
      status: 401
    }));
    const api = createApiFetcher({
      fetch,
      auth: {
        clear,
        getAccessToken: async () => "expired",
        refresh
      }
    });

    await expect(api.get("/private")).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 401,
        type  : "HTTP_FAILURE"
      }),
      name: "ApiAuthError"
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("preserves valid auth error codes for custom refresh classification", async () => {
    const clear = vi.fn(async () => undefined);
    const refresh = vi.fn(async () => "fresh");
    const shouldRefreshOnError = vi.fn((error: unknown) => (
      error instanceof ApiHttpError && error.code === "TOKEN_EXPIRED"
    ));
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      code   : "TOKEN_EXPIRED",
      message: "upstream-secret"
    }, 401, {
      "X-Secret": "header-secret"
    }));
    const api = createApiFetcher({
      fetch,
      maxResponseBytes: 100,
      auth: {
        clear,
        getAccessToken: async () => "expired",
        refresh,
        shouldRefreshOnError
      }
    });
    const error = await api.get("/private?token=query-secret")
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiAuthError);
    expect(error).toMatchObject({
      cause: expect.objectContaining({
        status: 401,
        type  : "HTTP_FAILURE"
      }),
      name: "ApiAuthError"
    });
    expect((error as ApiAuthError).cause).not.toHaveProperty("body");
    expect((error as ApiAuthError).cause).not.toHaveProperty("response");
    expect(JSON.stringify(error)).not.toContain("upstream-secret");
    expect(JSON.stringify(error)).not.toContain("header-secret");
    expect(JSON.stringify(error)).not.toContain("query-secret");
    expect(shouldRefreshOnError).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("prioritizes oversized auth responses before response size checks", async () => {
    const clear = vi.fn(async () => undefined);
    const response = new Response("response-secret", {
      headers: {
        "Content-Length": "15",
        "Content-Type"  : "text/plain"
      },
      status: 419
    });
    const cancelBody = vi.spyOn(response.body as ReadableStream<Uint8Array>, "cancel");
    const fetch = vi.fn<FetchLike>(async () => response);
    const api = createApiFetcher({
      fetch,
      maxResponseBytes: 1,
      auth: {
        clear,
        getAccessToken: async () => "expired"
      }
    });

    await expect(api.get("/private")).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 419,
        type  : "HTTP_FAILURE"
      }),
      name: "ApiAuthError"
    });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(cancelBody).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("normalizes one-shot stream auth responses without attempting refresh", async () => {
    const clear = vi.fn(async () => undefined);
    const refresh = vi.fn(async () => "fresh");
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ message: "expired" }, 401));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("body"));
        controller.close();
      }
    });
    const api = createApiFetcher({
      fetch,
      auth: {
        clear,
        getAccessToken: async () => "expired",
        refresh
      }
    });

    await expect(api.post("/private", {
      rawBody: body
    })).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 401
      }),
      name: "ApiAuthError"
    });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("normalizes a second auth response after refresh", async () => {
    const clear = vi.fn(async () => undefined);
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ message: "expired" }, 401));
    const api = createApiFetcher({
      fetch,
      auth: {
        clear,
        getAccessToken: async () => "expired",
        refresh       : async () => "fresh"
      }
    });

    await expect(api.get("/private")).rejects.toMatchObject({
      cause: expect.objectContaining({
        status: 401
      }),
      name: "ApiAuthError"
    });
    expect(clear).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps auth normalization when best effort session clearing fails", async () => {
    const clearError = new Error("clear failed");
    const api = createApiFetcher({
      fetch: async () => jsonResponse({ message: "expired" }, 401),
      auth : {
        clear: async () => {
          throw clearError;
        },
        getAccessToken: async () => "expired",
        refresh       : async () => null
      }
    });

    await expect(api.get("/private")).rejects.toMatchObject({
      cause: {
        status: 401,
        type  : "HTTP_FAILURE"
      },
      name : "ApiAuthError"
    });
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

  it("normalizes token-header formatter failures without retaining callback secrets", async () => {
    const clear = vi.fn(async () => undefined);
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const api = createApiFetcher({
      fetch,
      auth: {
        clear,
        formatTokenHeader: () => {
          throw Object.assign(new Error("formatter-secret"), {
            headers: { Authorization: "header-secret" }
          });
        },
        getAccessToken: () => "access-token"
      }
    });
    const error = await api.get("/private")
      .catch((reason: unknown) => reason);

    expect(error).toMatchObject({
      cause: {
        type: "AUTH_CALLBACK_FAILURE"
      },
      name: "ApiAuthError"
    });
    expect(JSON.stringify(error)).not.toContain("formatter-secret");
    expect(JSON.stringify(error)).not.toContain("header-secret");
    expect(clear).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not misclassify unrelated invalid static headers as auth callback failures", async () => {
    const clear = vi.fn(async () => undefined);
    const formatTokenHeader = vi.fn(() => ({
      Authorization: "Bearer formatted"
    }));
    const api = createApiFetcher({
      auth: {
        clear,
        formatTokenHeader,
        getAccessToken: () => "access-token"
      },
      fetch: async () => jsonResponse({ ok: true })
    });
    const error = await api.get("/private", {
      headers: {
        "X-Invalid": "invalid\nstatic-header"
      }
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(ApiAuthError);
    expect(formatTokenHeader).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
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

  it("shares SvelteKit refresh results and applies them to every cookie context", async () => {
    const cookiesA = {
      accessToken: "expired-shared",
      refreshKey : "shared-refresh"
    };
    const cookiesB = {
      accessToken: "expired-shared",
      refreshKey : "shared-refresh"
    };
    const refreshGate = createDeferred<void>();
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const headers = new Headers(init?.headers);

      if (headers.get("Authorization") === "Bearer fresh") {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ message: "expired" }, 401);
    });
    const refresh = vi.fn(async () => {
      await refreshGate.promise;

      return {
        accessToken: "fresh"
      };
    });
    const applyRefresh = vi.fn(async (
      cookies: typeof cookiesA,
      result: { accessToken: string }
    ) => {
      cookies.accessToken = result.accessToken;

      return cookies.accessToken;
    });
    const namespace = createSvelteKitRefreshNamespace<{
      accessToken: string;
    }>();
    const auth = {
      applyRefresh,
      getAccessToken: (cookies: typeof cookiesA) => cookies.accessToken,
      getRefreshKey : (cookies: typeof cookiesA) => cookies.refreshKey,
      namespace,
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
    expect(applyRefresh).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(cookiesA.accessToken).toBe("fresh");
    expect(cookiesB.accessToken).toBe("fresh");
  });

  it("shares SvelteKit refresh flights across different cache configurations", async () => {
    const cookiesA = {
      accessToken: "expired-config",
      refreshKey : "shared-config-refresh"
    };
    const cookiesB = {
      accessToken: "expired-config",
      refreshKey : "shared-config-refresh"
    };
    const refreshGate = createDeferred<void>();
    const refresh = vi.fn(async () => {
      await refreshGate.promise;

      return { accessToken: "fresh-config" };
    });
    const namespace = createSvelteKitRefreshNamespace<{
      accessToken: string;
    }>();
    const auth = {
      applyRefresh: async (
        cookies: typeof cookiesA,
        result: { accessToken: string }
      ) => {
        cookies.accessToken = result.accessToken;

        return cookies.accessToken;
      },
      getAccessToken: (cookies: typeof cookiesA) => cookies.accessToken,
      getRefreshKey : (cookies: typeof cookiesA) => cookies.refreshKey,
      namespace,
      refresh
    };
    const fetch = vi.fn<FetchLike>(async (_input, init) => (
      new Headers(init?.headers).get("Authorization") === "Bearer fresh-config"
        ? jsonResponse({ ok: true })
        : jsonResponse({ message: "expired" }, 401)
    ));
    const requestA = createSvelteKitApiFetcher({
      cookies: cookiesA,
      dedupeRefresh: {
        cacheSuccessMs: 0
      } as never,
      fetch,
      auth
    }).get("/me");
    const requestB = createSvelteKitApiFetcher({
      cookies: cookiesB,
      dedupeRefresh: {
        cacheSuccessMs: 5_000
      } as never,
      fetch,
      auth
    }).get("/me");

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });

    refreshGate.resolve();

    await expect(Promise.all([requestA, requestB])).resolves.toHaveLength(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(cookiesA.accessToken).toBe("fresh-config");
    expect(cookiesB.accessToken).toBe("fresh-config");
  });

  it("keeps typed SvelteKit namespace sharing in-flight only", async () => {
    const cookies = {
      accessToken: "expired-sequential",
      refreshKey : "sequential-refresh"
    };
    const namespace = createSvelteKitRefreshNamespace<{
      accessToken: string;
    }>();
    let refreshCount = 0;
    const refresh = vi.fn(async () => ({
      accessToken: `fresh-sequential-${++refreshCount}`
    }));
    const api = createSvelteKitApiFetcher({
      cookies,
      fetch: async (_input, init) => (
        new Headers(init?.headers).get("Authorization")?.startsWith("Bearer fresh-")
          ? jsonResponse({ ok: true })
          : jsonResponse({ message: "expired" }, 401)
      ),
      auth: {
        applyRefresh: (context, result) => {
          context.accessToken = result.accessToken;

          return context.accessToken;
        },
        getAccessToken: (context) => context.accessToken,
        getRefreshKey : (context) => context.refreshKey,
        namespace,
        refresh
      }
    });

    await expect(api.get("/me")).resolves.toMatchObject({
      response: { ok: true }
    });

    cookies.accessToken = "expired-sequential";

    await expect(api.get("/me")).resolves.toMatchObject({
      response: { ok: true }
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(cookies.accessToken).toBe("fresh-sequential-2");
  });

  it("keeps SvelteKit refreshes separate for different namespace handles", async () => {
    const cookiesA = {
      accessToken: "expired-namespace",
      id         : "a",
      refreshKey : "shared-refresh"
    };
    const cookiesB = {
      accessToken: "expired-namespace",
      id         : "b",
      refreshKey : "shared-refresh"
    };
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      const authorization = headers.get("Authorization");

      if (authorization === "Bearer fresh-a" || authorization === "Bearer fresh-b") {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ message: "expired" }, 401);
    });
    const refresh = vi.fn(async (cookies: typeof cookiesA) => {
      return {
        accessToken: `fresh-${cookies.id}`
      };
    });
    const createAuth = (
      namespace: SvelteKitRefreshNamespace<{ accessToken: string }>
    ) => ({
      applyRefresh: async (
        cookies: typeof cookiesA,
        result: { accessToken: string }
      ) => {
        cookies.accessToken = result.accessToken;

        return cookies.accessToken;
      },
      getAccessToken: (cookies: typeof cookiesA) => cookies.accessToken,
      getRefreshKey : (cookies: typeof cookiesA) => cookies.refreshKey,
      namespace,
      refresh
    });

    await Promise.all([
      createSvelteKitApiFetcher({
        cookies: cookiesA,
        fetch,
        auth   : createAuth(createSvelteKitRefreshNamespace())
      }).get("/me"),
      createSvelteKitApiFetcher({
        cookies: cookiesB,
        fetch,
        auth   : createAuth(createSvelteKitRefreshNamespace())
      }).get("/me")
    ]);

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("keeps SvelteKit refreshes separate for different refresh keys", async () => {
    const cookiesA = {
      accessToken: "expired-keys",
      refreshKey : "refresh-a"
    };
    const cookiesB = {
      accessToken: "expired-keys",
      refreshKey : "refresh-b"
    };
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      const accessToken = new Headers(init?.headers)
        .get("Authorization")
        ?.replace("Bearer ", "");

      return accessToken?.startsWith("fresh-")
        ? jsonResponse({ ok: true })
        : jsonResponse({ message: "expired" }, 401);
    });
    const refresh = vi.fn(async (cookies: typeof cookiesA) => ({
      accessToken: `fresh-${cookies.refreshKey}`
    }));
    const namespace = createSvelteKitRefreshNamespace<{
      accessToken: string;
    }>();
    const auth = {
      applyRefresh: async (
        cookies: typeof cookiesA,
        result: { accessToken: string }
      ) => {
        cookies.accessToken = result.accessToken;

        return cookies.accessToken;
      },
      getAccessToken: (cookies: typeof cookiesA) => cookies.accessToken,
      getRefreshKey : (cookies: typeof cookiesA) => cookies.refreshKey,
      namespace,
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
    expect(cookiesA.accessToken).toBe("fresh-refresh-a");
    expect(cookiesB.accessToken).toBe("fresh-refresh-b");
  });

  it("evicts failed SvelteKit refreshes before the next request", async () => {
    const cookies = {
      accessToken: "expired-failure",
      refreshKey : "retry-refresh"
    };
    const refreshError = new Error("refresh failed");
    const refresh = vi.fn()
      .mockRejectedValueOnce(refreshError)
      .mockResolvedValueOnce({ accessToken: "fresh" });
    const clear = vi.fn(async () => undefined);
    const namespace = createSvelteKitRefreshNamespace<{
      accessToken: string;
    }>();
    const api = createSvelteKitApiFetcher({
      cookies,
      fetch: async (_input, init) => (
        new Headers(init?.headers).get("Authorization") === "Bearer fresh"
          ? jsonResponse({ ok: true })
          : jsonResponse({ message: "expired" }, 401)
      ),
      auth: {
        applyRefresh: async (context, result: { accessToken: string }) => {
          context.accessToken = result.accessToken;

          return context.accessToken;
        },
        clear,
        getAccessToken: (context) => context.accessToken,
        getRefreshKey : (context) => context.refreshKey,
        namespace,
        refresh
      }
    });

    await expect(api.get("/me")).rejects.toMatchObject({
      cause: {
        type: "AUTH_CALLBACK_FAILURE"
      },
      name : "ApiAuthError"
    });
    await expect(api.get("/me")).resolves.toMatchObject({
      response: { ok: true }
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("clears only the SvelteKit cookie context whose refresh apply fails", async () => {
    const cookiesA = {
      accessToken: "expired-apply",
      cleared    : false,
      id         : "a",
      refreshKey : "shared-apply"
    };
    const cookiesB = {
      accessToken: "expired-apply",
      cleared    : false,
      id         : "b",
      refreshKey : "shared-apply"
    };
    const refreshGate = createDeferred<void>();
    const refresh = vi.fn(async () => {
      await refreshGate.promise;

      return { accessToken: "fresh" };
    });
    const applyRefresh = vi.fn(async (
      cookies: typeof cookiesA,
      result: { accessToken: string }
    ) => {
      if (cookies.id === "a") {
        throw new Error("cookie write failed");
      }

      cookies.accessToken = result.accessToken;

      return cookies.accessToken;
    });
    const clear = vi.fn(async (cookies: typeof cookiesA) => {
      cookies.accessToken = "";
      cookies.cleared     = true;
    });
    const namespace = createSvelteKitRefreshNamespace<{
      accessToken: string;
    }>();
    const auth = {
      applyRefresh,
      clear,
      getAccessToken: (cookies: typeof cookiesA) => cookies.accessToken,
      getRefreshKey : (cookies: typeof cookiesA) => cookies.refreshKey,
      namespace,
      refresh
    };
    const fetch = vi.fn<FetchLike>(async (_input, init) => (
      new Headers(init?.headers).get("Authorization") === "Bearer fresh"
        ? jsonResponse({ ok: true })
        : jsonResponse({ message: "expired" }, 401)
    ));
    const requestA = createSvelteKitApiFetcher({
      cookies: cookiesA,
      fetch,
      auth
    }).get("/me");
    const requestB = createSvelteKitApiFetcher({
      cookies: cookiesB,
      fetch,
      auth
    }).get("/me");
    const resultA = requestA.catch((error: unknown) => error);
    const resultB = requestB.catch((error: unknown) => error);

    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    refreshGate.resolve();

    await expect(resultA).resolves.toBeInstanceOf(ApiAuthError);
    await expect(resultB).resolves.toMatchObject({
      response: { ok: true }
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(applyRefresh).toHaveBeenCalledTimes(2);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledWith(cookiesA, "expired-apply");
    expect(cookiesA.cleared).toBe(true);
    expect(cookiesB.cleared).toBe(false);
    expect(cookiesB.accessToken).toBe("fresh");
  });

  it("requires applyRefresh for deduped SvelteKit refreshes", () => {
    expect(() => createSvelteKitApiFetcher({
      cookies: { accessToken: "expired" },
      fetch  : async () => jsonResponse({ ok: true }),
      auth   : {
        getAccessToken: (cookies: { accessToken: string }) => cookies.accessToken,
        refresh       : async () => "fresh"
      } as never
    })).toThrow(TypeError);
  });

  it("requires applyRefresh when SvelteKit refresh dedupe is disabled", () => {
    expect(() => createSvelteKitApiFetcher({
      cookies: { accessToken: "expired" },
      dedupeRefresh: false,
      fetch  : async () => jsonResponse({ ok: true }),
      auth   : {
        getAccessToken: (cookies: { accessToken: string }) => cookies.accessToken,
        refresh       : async () => "fresh"
      } as never
    })).toThrow(/applyRefresh is required for every SvelteKit refresh/u);
  });

  if (false) {
    const accessNamespace = createSvelteKitRefreshNamespace<{
      accessToken: string;
    }>();

    expectTypeOf(accessNamespace).toEqualTypeOf<
      SvelteKitRefreshNamespace<{ accessToken: string }>
    >();

    // @ts-expect-error refresh namespace result contracts are invariant
    const incompatibleNamespace: SvelteKitRefreshNamespace<{
      sessionToken: string;
    }> = accessNamespace;

    void incompatibleNamespace;

    createSvelteKitApiFetcher({
      cookies: { accessToken: "expired" },
      fetch  : async () => jsonResponse({ ok: true }),
      // @ts-expect-error every SvelteKit refresh requires generation-aware applyRefresh
      auth   : {
        getAccessToken: (cookies: { accessToken: string }) => cookies.accessToken,
        refresh       : async () => "fresh"
      }
    });

    createSvelteKitApiFetcher({
      cookies: { accessToken: "expired" },
      dedupeRefresh: false,
      fetch  : async () => jsonResponse({ ok: true }),
      // @ts-expect-error non-deduped refresh still requires generation-aware applyRefresh
      auth   : {
        getAccessToken: (cookies: { accessToken: string }) => cookies.accessToken,
        refresh       : async () => "fresh"
      }
    });

    createSvelteKitApiFetcher<
      { accessToken: string },
      { sessionToken: string }
    >({
      cookies: { accessToken: "expired" },
      fetch  : async () => jsonResponse({ ok: true }),
      auth   : {
        applyRefresh: (_cookies, result) => result.sessionToken,
        getAccessToken: (cookies) => cookies.accessToken,
        // @ts-expect-error namespace contract does not match the refresh result
        namespace: accessNamespace,
        refresh  : async () => ({ sessionToken: "fresh" })
      }
    });

    createSvelteKitApiFetcher<
      { accessToken: string },
      { accessToken: string }
    >({
      cookies: { accessToken: "expired" },
      fetch  : async () => jsonResponse({ ok: true }),
      auth   : {
        applyRefresh: (_cookies, result) => result.accessToken,
        getAccessToken: (cookies) => cookies.accessToken,
        // @ts-expect-error string refresh namespaces are no longer accepted
        namespace: "app-session",
        refresh  : async () => ({ accessToken: "fresh" })
      }
    });

    createSvelteKitApiFetcher({
      cookies: { accessToken: "expired" },
      // @ts-expect-error SvelteKit refresh dedupe no longer accepts cache settings
      dedupeRefresh: {
        cacheSuccessMs: 2_000
      },
      fetch: async () => jsonResponse({ ok: true }),
      auth : {
        applyRefresh: () => "fresh",
        getAccessToken: (cookies: { accessToken: string }) => cookies.accessToken,
        refresh       : async () => "fresh"
      }
    });
  }

  it("applies a non-deduped SvelteKit refresh result", async () => {
    const cookies = { accessToken: "expired-non-deduped" };
    const refresh = vi.fn(async () => ({ accessToken: "fresh" }));
    const applyRefresh = vi.fn(async (
      context: typeof cookies,
      result: { accessToken: string }
    ) => {
      context.accessToken = result.accessToken;

      return context.accessToken;
    });
    const api = createSvelteKitApiFetcher({
      cookies,
      dedupeRefresh: false,
      fetch: async (_input, init) => (
        new Headers(init?.headers).get("Authorization") === "Bearer fresh"
          ? jsonResponse({ ok: true })
          : jsonResponse({ message: "expired" }, 401)
      ),
      auth: {
        applyRefresh,
        getAccessToken: (context) => context.accessToken,
        refresh
      }
    });

    await expect(api.get("/me")).resolves.toMatchObject({
      response: { ok: true }
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(applyRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not apply a non-deduped SvelteKit refresh over a newer login", async () => {
    const cookies = { accessToken: "old-login" };
    const refreshGate = createDeferred<void>();
    const refreshStarted = createDeferred<void>();
    const applyRefresh = vi.fn(async (
      context: typeof cookies,
      result: { accessToken: string }
    ) => {
      context.accessToken = result.accessToken;

      return context.accessToken;
    });
    const api = createSvelteKitApiFetcher({
      cookies,
      dedupeRefresh: false,
      fetch: async (_input, init) => (
        new Headers(init?.headers).get("Authorization") === "Bearer new-login"
          ? jsonResponse({ ok: true })
          : jsonResponse({ message: "expired" }, 401)
      ),
      auth: {
        applyRefresh,
        getAccessToken: (context) => context.accessToken,
        refresh       : async () => {
          refreshStarted.resolve();
          await refreshGate.promise;

          return { accessToken: "stale-refresh" };
        }
      }
    });
    const request = api.get("/private");

    await refreshStarted.promise;
    cookies.accessToken = "new-login";
    refreshGate.resolve();

    await expect(request).resolves.toMatchObject({
      response: { ok: true }
    });
    expect(cookies.accessToken).toBe("new-login");
    expect(applyRefresh).not.toHaveBeenCalled();
  });

  it("does not apply a shared SvelteKit refresh over a newer login", async () => {
    const cookies = {
      accessToken: "old-login",
      refreshKey : "shared-stale-apply"
    };
    const refreshGate = createDeferred<void>();
    const refreshStarted = createDeferred<void>();
    const applyRefresh = vi.fn(async (
      context: typeof cookies,
      result: { accessToken: string },
      _expectedAccessToken?: string | null
    ) => {
      context.accessToken = result.accessToken;

      return context.accessToken;
    });
    const api = createSvelteKitApiFetcher({
      cookies,
      fetch: async (_input, init) => (
        new Headers(init?.headers).get("Authorization") === "Bearer new-login"
          ? jsonResponse({ ok: true })
          : jsonResponse({ message: "expired" }, 401)
      ),
      auth: {
        applyRefresh,
        getAccessToken: (context) => context.accessToken,
        getRefreshKey : (context) => context.refreshKey,
        refresh       : async () => {
          refreshStarted.resolve();
          await refreshGate.promise;

          return { accessToken: "stale-refresh" };
        }
      }
    });
    const request = api.get("/private");

    await refreshStarted.promise;
    cookies.accessToken = "new-login";
    refreshGate.resolve();

    await expect(request).resolves.toMatchObject({
      response: { ok: true }
    });
    expect(cookies.accessToken).toBe("new-login");
    expect(applyRefresh).not.toHaveBeenCalled();
  });

  it("passes sanitized transport errors to SvelteKit refresh", async () => {
    const cookies = { accessToken: "expired-custom" };
    const customError = new Error("custom auth failure");
    const auth: SvelteKitRefreshAuthOptions<typeof cookies, string> = {
      applyRefresh: (context, result) => {
        context.accessToken = result;

        return context.accessToken;
      },
      getAccessToken: (context) => context.accessToken,
      refresh: vi.fn(async (_context, error) => {
        expectTypeOf(error).toBeUnknown;
        expect(error).toBeInstanceOf(ApiRequestError);

        return "fresh";
      }),
      shouldRefreshOnError: (error) => error instanceof ApiRequestError
    };
    const api = createSvelteKitApiFetcher({
      cookies,
      dedupeRefresh: false,
      fetch: async (_input, init) => {
        if (new Headers(init?.headers).get("Authorization") === "Bearer fresh") {
          return jsonResponse({ ok: true });
        }

        throw customError;
      },
      auth
    });

    await expect(api.get("/me")).resolves.toMatchObject({
      response: { ok: true }
    });
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

  it("infers calls from structurally declared endpoints", async () => {
    const api = createApiFetcher({
      fetch: async () => jsonResponse({
        id  : 9,
        name: "structural"
      })
    });
    const structuralEndpoint = {
      method : "GET",
      options: {
        responseSchema: User,
        select        : (data: z.output<typeof User>) => data.name
      },
      path: "/users/9"
    } satisfies ApiEndpoint<undefined, undefined, typeof User, string>;
    const name = await api.call(structuralEndpoint);

    expectTypeOf(name).toBeString();
    expect(name).toBe("structural");
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

  it("resolves auth after body preparation and request hooks", async () => {
    let accessToken = "old";
    const authorizations: Array<string | null> = [];
    const api = createApiFetcher({
      fetch: async (_input, init) => {
        authorizations.push(new Headers(init?.headers).get("Authorization"));

        return jsonResponse({ ok: true });
      },
      auth: {
        getAccessToken: () => accessToken
      },
      hooks: {
        onRequest: async () => {
          accessToken = "hook-login";
        }
      }
    });

    await api.post("/private", {
      rawBodyFactory: async () => {
        accessToken = "body-login";

        return "body";
      }
    });

    expect(authorizations).toEqual(["Bearer hook-login"]);
  });

  it("re-reads auth immediately before every general retry attempt", async () => {
    let accessToken = "old";
    const authorizations: Array<string | null> = [];
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      authorizations.push(new Headers(init?.headers).get("Authorization"));

      return authorizations.length === 1
        ? jsonResponse({ message: "retry" }, 503)
        : jsonResponse({ ok: true });
    });
    const api = createApiFetcher({
      fetch,
      auth: {
        getAccessToken: () => accessToken
      }
    });

    await api.get("/private", {
      retry: {
        limit: 1,
        shouldRetry: () => {
          accessToken = "new-login";

          return true;
        }
      }
    });

    expect(authorizations).toEqual([
      "Bearer old",
      "Bearer new-login"
    ]);
  });

  it("recreates raw body for every general retry", async () => {
    const bodies: RequestInit["body"][] = [];
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      bodies.push(init?.body);

      return bodies.length === 1
        ? jsonResponse({ message: "try again" }, 503)
        : jsonResponse({ ok: true });
    });
    const rawBodyFactory = vi.fn(async (attempt: number) => new URLSearchParams({
      attempt: String(attempt)
    }));
    const api = createApiFetcher({ fetch });

    await api.post("/upload", {
      rawBodyFactory,
      retry: {
        limit  : 1,
        methods: ["POST"]
      }
    });

    expect(rawBodyFactory.mock.calls).toEqual([[1], [2]]);
    expect(bodies[0]).not.toBe(bodies[1]);
    expect(String(bodies[0])).toBe("attempt=1");
    expect(String(bodies[1])).toBe("attempt=2");
  });

  it("does not retry one-shot raw body streams", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("body"));
        controller.close();
      }
    });
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ message: "try again" }, 503));
    const api = createApiFetcher({ fetch });

    await expect(api.post("/upload", {
      rawBody: body,
      retry  : {
        limit  : 1,
        methods: ["POST"]
      }
    })).rejects.toBeInstanceOf(ApiHttpError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("detects structurally compatible one-shot raw body streams", async () => {
    const body = {
      getReader: () => ({})
    } as unknown as RequestInit["body"];
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ message: "try again" }, 503));
    const api = createApiFetcher({ fetch });

    await expect(api.post("/upload", {
      rawBody: body,
      retry  : {
        limit  : 1,
        methods: ["POST"]
      }
    })).rejects.toBeInstanceOf(ApiHttpError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("parses transforms and serializes JSON body once per logical request", async () => {
    const toJSON = vi.fn(() => ({ name: "haru" }));
    const transform = vi.fn(() => ({ toJSON }));
    const bodySchema = z.object({
      name: z.string()
    }).transform(transform);
    let attempt = 0;
    const bodies: RequestInit["body"][] = [];
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      attempt += 1;
      bodies.push(init?.body);

      if (attempt === 1) {
        return jsonResponse({ message: "try again" }, 503);
      }

      if (attempt === 2) {
        return jsonResponse({ message: "expired" }, 401);
      }

      return jsonResponse({ ok: true });
    });
    const api = createApiFetcher({
      fetch,
      auth: {
        getAccessToken: async () => "expired",
        refresh       : async () => "fresh"
      }
    });

    await api.post("/users", {
      body: {
        name: "haru"
      },
      bodySchema,
      retry: {
        limit  : 1,
        methods: ["POST"]
      }
    });

    expect(transform).toHaveBeenCalledTimes(1);
    expect(toJSON).toHaveBeenCalledTimes(1);
    expect(bodies).toEqual([
      JSON.stringify({ name: "haru" }),
      JSON.stringify({ name: "haru" }),
      JSON.stringify({ name: "haru" })
    ]);
  });

  it("recreates raw body for an auth retry", async () => {
    const bodies: RequestInit["body"][] = [];
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      bodies.push(init?.body);
      const headers = new Headers(init?.headers);

      return headers.get("Authorization") === "Bearer fresh"
        ? jsonResponse({ ok: true })
        : jsonResponse({ message: "expired" }, 401);
    });
    const rawBodyFactory = vi.fn(async (attempt: number) => new URLSearchParams({
      attempt: String(attempt)
    }));
    const api = createApiFetcher({
      fetch,
      auth: {
        getAccessToken: async () => "expired",
        refresh       : async () => "fresh"
      }
    });

    await api.post("/upload", {
      rawBodyFactory
    });

    expect(rawBodyFactory.mock.calls).toEqual([[1], [2]]);
    expect(bodies[0]).not.toBe(bodies[1]);
  });

  it("recreates endpoint raw body for every retry", async () => {
    const bodies: RequestInit["body"][] = [];
    const fetch = vi.fn<FetchLike>(async (_input, init) => {
      bodies.push(init?.body);

      return bodies.length === 1
        ? jsonResponse({ message: "try again" }, 503)
        : jsonResponse({ ok: true });
    });
    const rawBodyFactory = vi.fn(async (attempt: number) => new URLSearchParams({
      attempt: String(attempt)
    }));
    const upload = endpoint.post("/upload", {
      retry: {
        limit  : 1,
        methods: ["POST"]
      }
    });
    const api = createApiFetcher({ fetch });

    await api.call(upload, {
      rawBodyFactory
    });

    expect(rawBodyFactory.mock.calls).toEqual([[1], [2]]);
    expect(bodies[0]).not.toBe(bodies[1]);
  });

  it("rejects response size from content-length before reading text", async () => {
    const response = new Response("oversized", {
      headers: {
        "Content-Length": "9",
        "Content-Type"  : "text/plain"
      }
    });
    const readText   = vi.spyOn(response, "text");
    const cancelBody = vi.spyOn(response.body as ReadableStream<Uint8Array>, "cancel");
    const api = createApiFetcher({
      fetch: async () => response,
      maxResponseBytes: 3
    });

    await expect(api.get("/large")).rejects.toMatchObject({
      limit: 3,
      name : "ApiResponseSizeError",
      size : 9
    });
    expect(readText).not.toHaveBeenCalled();
    expect(cancelBody).toHaveBeenCalledTimes(1);
  });

  it("rejects streamed response size beyond the configured limit", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("ab"));
        controller.enqueue(encoder.encode("cd"));
        controller.close();
      }
    });
    const api = createApiFetcher({
      fetch: async () => new Response(body, {
        headers: {
          "Content-Type": "text/plain"
        }
      }),
      maxResponseBytes: 3
    });

    await expect(api.get("/large")).rejects.toMatchObject({
      limit: 3,
      name : "ApiResponseSizeError",
      size : 4
    });
  });

  it("enforces endpoint response size limits", async () => {
    const api = createApiFetcher({
      fetch: async () => new Response("large")
    });
    const download = endpoint.get("/download", {
      maxResponseBytes: 3
    });

    await expect(api.call(download)).rejects.toMatchObject({
      limit: 3,
      name : "ApiResponseSizeError",
      size : 5
    });
  });

  it("rejects invalid response size limits before fetch", async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response("body"));
    const api = createApiFetcher({ fetch });

    await expect(api.get("/download", {
      maxResponseBytes: 1.5
    })).rejects.toBeInstanceOf(RangeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("honors Retry-After seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      const attemptTimes: number[] = [];
      const fetch = vi.fn<FetchLike>(async () => {
        attemptTimes.push(Date.now());

        return attemptTimes.length === 1
          ? jsonResponse({ message: "slow down" }, 503, { "Retry-After": "2" })
          : jsonResponse({ ok: true });
      });
      const api = createApiFetcher({ fetch });
      const request = api.get("/unstable", {
        retry: {
          limit            : 1,
          respectRetryAfter: true
        }
      });

      await vi.runAllTimersAsync();
      await request;

      expect(attemptTimes).toEqual([0, 2_000]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("honors Retry-After HTTP dates", async () => {
    const now = Date.UTC(2026, 6, 11, 0, 0, 0);

    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      const attemptTimes: number[] = [];
      const retryAt = new Date(now + 3_000).toUTCString();
      const fetch = vi.fn<FetchLike>(async () => {
        attemptTimes.push(Date.now());

        return attemptTimes.length === 1
          ? jsonResponse({ message: "slow down" }, 503, { "Retry-After": retryAt })
          : jsonResponse({ ok: true });
      });
      const api = createApiFetcher({ fetch });
      const request = api.get("/unstable", {
        retry: {
          limit            : 1,
          respectRetryAfter: true
        }
      });

      await vi.runAllTimersAsync();
      await request;

      expect(attemptTimes).toEqual([now, now + 3_000]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores fractional Retry-After seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      const attemptTimes: number[] = [];
      const fetch = vi.fn<FetchLike>(async () => {
        attemptTimes.push(Date.now());

        return attemptTimes.length === 1
          ? jsonResponse({ message: "slow down" }, 503, { "Retry-After": "0.5" })
          : jsonResponse({ ok: true });
      });
      const api = createApiFetcher({ fetch });
      const request = api.get("/unstable", {
        retry: {
          delay            : 100,
          limit            : 1,
          respectRetryAfter: true
        }
      });

      await vi.runAllTimersAsync();
      await request;

      expect(attemptTimes).toEqual([0, 100]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("applies exponential retry delay without jitter", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    try {
      const attemptTimes: number[] = [];
      const fetch = vi.fn<FetchLike>(async () => {
        attemptTimes.push(Date.now());

        return attemptTimes.length < 3
          ? jsonResponse({ message: "try again" }, 503)
          : jsonResponse({ ok: true });
      });
      const api = createApiFetcher({ fetch });
      const request = api.get("/unstable", {
        retry: {
          delay   : 100,
          limit   : 2,
          strategy: "exponential"
        }
      });

      await vi.runAllTimersAsync();
      await request;

      expect(attemptTimes).toEqual([0, 100, 300]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps retry jitter inside the configured ratio bounds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1);

    try {
      const attemptTimes: number[] = [];
      const fetch = vi.fn<FetchLike>(async () => {
        attemptTimes.push(Date.now());

        return attemptTimes.length < 3
          ? jsonResponse({ message: "try again" }, 503)
          : jsonResponse({ ok: true });
      });
      const api = createApiFetcher({ fetch });
      const request = api.get("/unstable", {
        retry: {
          delay : 100,
          jitter: 0.5,
          limit : 2
        }
      });

      await vi.runAllTimersAsync();
      await request;

      expect(attemptTimes).toEqual([0, 50, 200]);
    } finally {
      random.mockRestore();
      vi.useRealTimers();
    }
  });

  it("rejects retry jitter ratios outside zero through one", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const api = createApiFetcher({ fetch });

    await expect(api.get("/unstable", {
      retry: {
        jitter: 1.1,
        limit : 1
      }
    })).rejects.toBeInstanceOf(RangeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5])(
    "rejects invalid retry limit %s before fetch",
    async (limit) => {
      for (const retry of [limit, { limit }]) {
        const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
        const api = createApiFetcher({ fetch });

        await expect(api.get("/unstable", {
          retry
        })).rejects.toBeInstanceOf(RangeError);
        expect(fetch).not.toHaveBeenCalled();
      }
    }
  );

  it("keeps one general retry budget across auth refresh", async () => {
    let attempt = 0;
    const fetch = vi.fn<FetchLike>(async () => {
      attempt += 1;

      if (attempt === 1 || attempt === 3) {
        return jsonResponse({ message: "try again" }, 503);
      }

      if (attempt === 2) {
        return jsonResponse({ message: "expired" }, 401);
      }

      return jsonResponse({ ok: true });
    });
    const api = createApiFetcher({
      fetch,
      auth: {
        getAccessToken: async () => "expired",
        refresh       : async () => "fresh"
      }
    });

    await expect(api.get("/unstable", {
      retry: 1
    })).rejects.toMatchObject({
      name  : "ApiHttpError",
      status: 503
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("turns caller abort during retry delay into an abort error", async () => {
    vi.useFakeTimers();

    const controller = new AbortController();
    const reason = new Error("caller stopped");
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ message: "try again" }, 503));
    const api = createApiFetcher({ fetch });
    try {
      const request = api.get("/unstable", {
        retry: {
          delay      : 10_000,
          limit      : 1,
          shouldRetry: () => true
        },
        signal : controller.signal,
        timeout: 100
      });
      const errorPromise = request.catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      controller.abort(reason);
      await vi.runAllTimersAsync();

      const error = await errorPromise;

      expect(error).toMatchObject({
        cause: reason,
        context: {
          method: "GET",
          path  : "/unstable",
          url   : "/unstable"
        },
        name : "ApiAbortError"
      });
      expect((error as ApiAbortError).context).not.toHaveProperty("error");
      expect((error as ApiAbortError).context).not.toHaveProperty("response");
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("normalizes caller abort during a network error retry delay", async () => {
    vi.useFakeTimers();

    const controller = new AbortController();
    const reason = new Error("caller stopped");
    const fetch = vi.fn<FetchLike>(async () => {
      throw new Error("network failed");
    });
    const api = createApiFetcher({ fetch });

    try {
      const request = api.get("/unstable", {
        retry: {
          delay      : 10_000,
          limit      : 1,
          shouldRetry: () => true
        },
        signal: controller.signal
      });
      const errorPromise = request.catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(1);

      controller.abort(reason);
      await vi.runAllTimersAsync();

      const error = await errorPromise;

      expect(error).toMatchObject({
        cause: reason,
        context: {
          method: "GET",
          path  : "/unstable",
          url   : "/unstable"
        },
        name : "ApiAbortError"
      });
      expect((error as ApiAbortError).context).not.toHaveProperty("error");
      expect((error as ApiAbortError).context).not.toHaveProperty("response");
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
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

  it("distinguishes caller abort errors from timeout errors", async () => {
    const controller = new AbortController();
    const reason = new Error("caller stopped");
    const fetch = vi.fn<FetchLike>(async (_input, init) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;

      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }

      signal?.addEventListener("abort", () => {
        reject(signal.reason);
      });
    }));
    const api = createApiFetcher({ fetch });
    const request = api.get("/slow", {
      signal: controller.signal
    });
    const errorPromise = request.catch((error: unknown) => error);

    controller.abort(reason);

    const error = await errorPromise;

    expect(error).toBeInstanceOf(ApiAbortError);
    expect(error).toMatchObject({
      cause: reason,
      name : "ApiAbortError"
    });
  });

  it("exports request lifecycle errors and option types", async () => {
    const rawBodyFactory: RawBodyFactory = async () => undefined;
    const retryStrategy: RetryStrategy   = "fixed";

    expect(ApiAbortError).toBeTypeOf("function");
    expect(ApiResponseSizeError).toBeTypeOf("function");
    await expect(rawBodyFactory(1)).resolves.toBeUndefined();
    expect(retryStrategy).toBe("fixed");
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

    await expect(api.get("/offline")).rejects.toMatchObject({
      context: {
        method: "GET",
        path  : "/offline",
        url   : "/offline"
      },
      message: "API request failed: GET /offline",
      name   : "ApiRequestError",
      reason : "TRANSPORT_FAILURE"
    });

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
      message: "외부 응답이 올바르지 않습니다"
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
      message: "요청을 처리하지 못했습니다"
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

  it("uses the API route fallback instead of raw upstream messages", async () => {
    const response = await handleApiRoute(() => {
      throw new ApiHttpError(jsonResponse({
        message: "upstream token=secret"
      }, 503), {
        message: "upstream token=secret"
      }, {
        method: "GET",
        path  : "/private",
        url   : "https://api.example.com/private"
      }, {
        message: "upstream token=secret"
      });
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "API request failed"
    });
  });

  it("uses explicit API route status messages before the fallback", async () => {
    const response = await handleApiRoute(() => {
      throw new ApiHttpError(jsonResponse({
        message: "upstream failed"
      }, 503), {
        message: "upstream failed"
      }, {
        method: "GET",
        path  : "/private",
        url   : "https://api.example.com/private"
      }, {
        message: "upstream failed"
      });
    }, {
      responseMessage: "route failed",
      statusMessages : {
        503: "service unavailable"
      }
    });

    await expect(response.json()).resolves.toEqual({
      message: "service unavailable"
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

  it("handles sanitized request failures as bad gateway", async () => {
    const response = await handleApiRoute(() => {
      throw new ApiRequestError("TRANSPORT_FAILURE", {
        method: "GET",
        path  : "/upstream",
        url   : "https://api.example.com/upstream"
      });
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: "API request failed"
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

const listenServer = (server: Server): Promise<void> => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    server.off("error", reject);
    resolve();
  });
});

const closeServer = (server: Server): Promise<void> => new Promise((resolve, reject) => {
  server.close((error) => {
    if (error) {
      reject(error);
      return;
    }

    resolve();
  });
});

const getServerOrigin = (server: Server): string => {
  const address = server.address() as AddressInfo;

  return `http://127.0.0.1:${address.port}`;
};

const getExposedErrorText = (error: unknown): string => {
  if (typeof error !== "object" || error === null) {
    return String(error);
  }

  return JSON.stringify(Object.fromEntries(
    Object.getOwnPropertyNames(error).map((key) => [
      key,
      (error as Record<string, unknown>)[key]
    ])
  ));
};
