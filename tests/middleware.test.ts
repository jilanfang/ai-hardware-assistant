import { describe, expect, test } from "vitest";

import { middleware } from "@/middleware";

describe("middleware auth protection", () => {
  test("redirects unauthenticated workspace requests to login", async () => {
    const response = await middleware(new Request("http://localhost/") as never);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?returnTo=%2F");
  });

  test("returns 401 for unauthenticated analysis api requests", async () => {
    const response = await middleware(new Request("http://localhost/api/analysis") as never);

    expect(response.status).toBe(401);
  });

  test("returns 401 for unauthenticated audit api requests", async () => {
    const response = await middleware(new Request("http://localhost/api/audit") as never);

    expect(response.status).toBe(401);
  });

  test("allows health checks and login page without authentication", async () => {
    const loginResponse = await middleware(new Request("http://localhost/login") as never);
    const healthResponse = await middleware(new Request("http://localhost/healthz") as never);

    expect(loginResponse.headers.get("x-middleware-next")).toBe("1");
    expect(healthResponse.headers.get("x-middleware-next")).toBe("1");
  });
});
