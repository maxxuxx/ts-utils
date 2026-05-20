import { describe, expect, it, vi } from "vitest";

import {
  ApiHttpError,
  ApiValidationError,
  HttpMethod,
  createApiClient,
  defineEndpoint,
  responseEnvelopeSchema,
  type FetchLike,
  z
} from "../src/api-fetch/index.js";

describe("api-fetch", () => {
  it("sends zod validated JSON requests and parses zod validated responses", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      id  : 1,
      name: "haru"
    }));
    const client = createApiClient({
      baseUrl: "https://api.example.com",
      headers: {
        "X-App": "test"
      },
      fetch
    });
    const requestSchema = z.object({
      name: z.string().min(1)
    });
    const responseSchema = z.object({
      id  : z.number(),
      name: z.string()
    });

    const data = await client.request("/users", {
      method        : HttpMethod.POST,
      body          : { name: "haru" },
      requestSchema,
      responseSchema,
      query         : { page: 1, empty: null }
    });

    expect(data).toEqual({
      id  : 1,
      name: "haru"
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/users?page=1",
      expect.objectContaining({
        method: "POST",
        body  : JSON.stringify({ name: "haru" })
      })
    );

    const headers = new Headers(fetch.mock.calls[0]?.[1]?.headers);

    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-App")).toBe("test");
  });

  it("throws validation errors before invalid requests are sent", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const client = createApiClient({ fetch });

    await expect(client.request("/users", {
      method       : HttpMethod.POST,
      body         : { name: "" },
      requestSchema: z.object({
        name: z.string().min(1)
      })
    })).rejects.toBeInstanceOf(ApiValidationError);

    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws typed HTTP errors with parsed response bodies", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({ message: "unauthorized" }, 401));
    const client = createApiClient({ fetch });

    await expect(client.request("/me", {
      responseSchema: z.object({
        id: z.number()
      })
    })).rejects.toMatchObject({
      status: 401,
      body  : { message: "unauthorized" }
    } satisfies Partial<ApiHttpError>);
  });

  it("refreshes access tokens once and retries unauthorized requests", async () => {
    type Token = {
      accessToken: string;
      expiresAt  : number;
    };

    let token: Token | null = {
      accessToken: "expired",
      expiresAt  : 0
    };
    const fetch = vi.fn<FetchLike>(async (_input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);

      if (headers.get("Authorization") === "Bearer fresh") {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ message: "expired" }, 401);
    });
    const refreshToken = vi.fn(async () => ({
      accessToken: "fresh",
      expiresAt  : Date.now() + 60_000
    }));
    const client = createApiClient<Token>({
      fetch,
      token: {
        getToken          : () => token,
        setToken          : (nextToken) => {
          token = nextToken;
        },
        getAccessToken    : (currentToken) => currentToken.accessToken,
        shouldRefreshToken: () => false,
        refreshToken
      }
    });

    const data = await client.request("/me", {
      responseSchema: z.object({
        ok: z.boolean()
      })
    });

    expect(data).toEqual({ ok: true });
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(token?.accessToken).toBe("fresh");
  });

  it("creates reusable endpoints with params, query, body, response, and result mapping", async () => {
    const fetch = vi.fn<FetchLike>(async () => jsonResponse({
      code: 200,
      data: {
        id  : 7,
        name: "haru"
      }
    }));
    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetch
    });
    const endpoint = defineEndpoint({
      method      : HttpMethod.GET,
      path        : (params: { id: number }) => `/users/${params.id}`,
      paramsSchema: z.object({
        id: z.number()
      }),
      responseSchema: responseEnvelopeSchema(z.object({
        id  : z.number(),
        name: z.string()
      })),
      resultSchema: z.object({
        id: z.number()
      }),
      mapQuery: () => ({ include: "profile" }),
      mapResult: (response) => ({
        id: response.data?.id ?? 0
      })
    });

    const getUser = client.endpoint(endpoint);

    await expect(getUser({ id: 7 })).resolves.toEqual({ id: 7 });
    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.example.com/users/7?include=profile");
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
