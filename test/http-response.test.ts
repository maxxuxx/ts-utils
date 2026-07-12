import {
  badGateway,
  badRequest,
  conflict,
  forbidden,
  httpResponse,
  jsonResponse,
  messageResponse,
  noContent,
  notFound,
  unprocessableEntity,
  unauthorized
} from "../src/http-response/index.js";
import { describe, expect, it } from "vitest";

describe("http-response module", () => {
  it("creates JSON responses", async () => {
    const response = jsonResponse({
      ok: true
    }, {
      status: 201
    });

    await expect(response.json()).resolves.toEqual({
      ok: true
    });
    expect(response.status).toBe(201);
  });

  it("creates message responses with explicit status", async () => {
    const response = messageResponse("Request failed", 418);

    await expect(response.json()).resolves.toEqual({
      message: "Request failed"
    });
    expect(response.status).toBe(418);
  });

  it("uses English default messages for status helpers", async () => {
    await expect(badRequest().json()).resolves.toEqual({
      message: "Bad Request"
    });
    expect(badRequest().status).toBe(400);

    await expect(unauthorized().json()).resolves.toEqual({
      message: "Unauthorized"
    });
    expect(unauthorized().status).toBe(401);

    await expect(badGateway().json()).resolves.toEqual({
      message: "Bad Gateway"
    });
    expect(badGateway().status).toBe(502);
  });

  it("allows caller provided status messages", async () => {
    const response = unauthorized("로그인이 필요합니다");

    await expect(response.json()).resolves.toEqual({
      message: "로그인이 필요합니다"
    });
    expect(response.status).toBe(401);
  });

  it("creates exact common status responses", async () => {
    const forbiddenResponse           = forbidden();
    const notFoundResponse            = notFound();
    const conflictResponse            = conflict();
    const unprocessableEntityResponse = unprocessableEntity();
    const noContentResponse           = noContent();

    expect(forbiddenResponse.status).toBe(403);
    await expect(forbiddenResponse.json()).resolves.toEqual({
      message: "Forbidden"
    });
    expect(notFoundResponse.status).toBe(404);
    await expect(notFoundResponse.json()).resolves.toEqual({
      message: "Not Found"
    });
    expect(conflictResponse.status).toBe(409);
    await expect(conflictResponse.json()).resolves.toEqual({
      message: "Conflict"
    });
    expect(unprocessableEntityResponse.status).toBe(422);
    await expect(unprocessableEntityResponse.json()).resolves.toEqual({
      message: "Unprocessable Entity"
    });
    expect(noContentResponse.status).toBe(204);
    expect(noContentResponse.body).toBeNull();
    expect(noContentResponse.headers.get("content-type")).toBeNull();
    await expect(noContentResponse.text()).resolves.toBe("");
  });

  it("provides namespace style helpers", async () => {
    const response = httpResponse.badRequest("Invalid payload");

    await expect(response.json()).resolves.toEqual({
      message: "Invalid payload"
    });
    expect(response.status).toBe(400);

    const conflictResponse = httpResponse.conflict("Already exists");

    await expect(conflictResponse.json()).resolves.toEqual({
      message: "Already exists"
    });
    expect(conflictResponse.status).toBe(409);
    expect(httpResponse.noContent().status).toBe(204);
  });
});
