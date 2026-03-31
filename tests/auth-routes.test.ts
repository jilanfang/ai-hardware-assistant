import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { createUser, findSessionByToken, resetAuthDatabase } from "@/lib/auth-db";
import { hashPassword, parseSessionTokenFromCookie } from "@/lib/auth";

let authDbDir: string;

describe("auth routes", () => {
  beforeEach(() => {
    authDbDir = mkdtempSync(join(tmpdir(), "atlas-auth-route-"));
    process.env.ATLAS_DB_PATH = join(authDbDir, "atlas.db");
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.SESSION_COOKIE_NAME = "atlas_session";
    resetAuthDatabase();
  });

  afterEach(() => {
    resetAuthDatabase();
    delete process.env.ATLAS_DB_PATH;
    delete process.env.SESSION_SECRET;
    delete process.env.SESSION_COOKIE_NAME;
    rmSync(authDbDir, { recursive: true, force: true });
  });

  test("logs in with valid username and password and creates a session cookie", async () => {
    createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });

    const response = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
        body: JSON.stringify({
          username: "tester",
          password: "secret-pass"
        })
      })
    );

    expect(response.status).toBe(200);
    const cookieHeader = response.headers.get("set-cookie");
    expect(cookieHeader).toContain("atlas_session=");
    const token = parseSessionTokenFromCookie(cookieHeader ?? "", "atlas_session");
    expect(token).not.toBeNull();
    expect(findSessionByToken(token ?? "")).toEqual(
      expect.objectContaining({
        userId: expect.any(String)
      })
    );
  });

  test("returns the same error for missing users and wrong passwords", async () => {
    createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });

    const wrongPasswordResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "tester",
          password: "wrong-pass"
        })
      })
    );
    const missingUserResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "missing",
          password: "wrong-pass"
        })
      })
    );

    expect(wrongPasswordResponse.status).toBe(401);
    expect(missingUserResponse.status).toBe(401);
    await expect(wrongPasswordResponse.json()).resolves.toEqual({
      error: "用户名或密码错误。"
    });
    await expect(missingUserResponse.json()).resolves.toEqual({
      error: "用户名或密码错误。"
    });
  });

  test("disabled users cannot log in", async () => {
    createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User",
      status: "disabled"
    });

    const response = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "tester",
          password: "secret-pass"
        })
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "该账号已停用。"
    });
  });

  test("logs out by revoking the current session and clearing the cookie", async () => {
    createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });

    const loginResponse = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "tester",
          password: "secret-pass"
        })
      })
    );
    const cookieHeader = loginResponse.headers.get("set-cookie") ?? "";
    const token = parseSessionTokenFromCookie(cookieHeader, "atlas_session") ?? "";

    const logoutResponse = await logoutPost(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: `atlas_session=${token}`
        }
      })
    );

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("set-cookie")).toContain("atlas_session=;");
    expect(findSessionByToken(token)).toBeNull();
  });
});
