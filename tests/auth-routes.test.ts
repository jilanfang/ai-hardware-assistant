import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { createUser, findSessionByToken, findUserByUsername, resetAuthDatabase } from "@/lib/auth-db";
import { hashPassword, parseSessionTokenFromCookie } from "@/lib/auth";
import { listInviteCodes } from "@/lib/invite-codes";
import { resetSignupRateLimit } from "@/lib/signup-rate-limit";

let authDbDir: string;

describe("auth routes", () => {
  beforeEach(() => {
    authDbDir = mkdtempSync(join(tmpdir(), "atlas-auth-route-"));
    process.env.ATLAS_DB_PATH = join(authDbDir, "atlas.db");
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.SESSION_COOKIE_NAME = "atlas_session";
    process.env.ATLAS_SELF_SERVICE_SIGNUP_ENABLED = "true";
    process.env.ATLAS_ADMIN_USERNAMES = "atlas01";
    resetAuthDatabase();
    resetSignupRateLimit();
  });

  afterEach(() => {
    resetAuthDatabase();
    resetSignupRateLimit();
    delete process.env.ATLAS_DB_PATH;
    delete process.env.SESSION_SECRET;
    delete process.env.SESSION_COOKIE_NAME;
    delete process.env.ATLAS_SELF_SERVICE_SIGNUP_ENABLED;
    delete process.env.ATLAS_ADMIN_USERNAMES;
    delete process.env.ATLAS_SIGNUP_INVITE_CODE;
    rmSync(authDbDir, { recursive: true, force: true });
  });

  async function createInviteCode(code = "ATLAS-AB12-CD34") {
    const existingAdmin = findUserByUsername("atlas01");
    const admin =
      existingAdmin ??
      createUser({
        username: "atlas01",
        passwordHash: await hashPassword("secret-pass"),
        displayName: "Atlas Admin"
      });

    const { createInviteCodes } = await import("@/lib/invite-codes");
    createInviteCodes(admin.username, 1, [code]);
    return code;
  }

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

  test("registers a new user and creates a session cookie", async () => {
    const inviteCode = await createInviteCode();

    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
        body: JSON.stringify({
          username: "new-user",
          password: "secret-pass",
          displayName: "New User",
          inviteCode
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: expect.objectContaining({
        username: "new-user",
        displayName: "New User"
      })
    });

    const cookieHeader = response.headers.get("set-cookie");
    expect(cookieHeader).toContain("atlas_session=");
    const token = parseSessionTokenFromCookie(cookieHeader ?? "", "atlas_session");
    expect(token).not.toBeNull();
    expect(findSessionByToken(token ?? "")).toEqual(
      expect.objectContaining({
        userId: expect.any(String)
      })
    );
    expect(findUserByUsername("new-user")).toEqual(
      expect.objectContaining({
        username: "new-user",
        displayName: "New User",
        status: "active"
      })
    );
    expect(listInviteCodes()[0]).toEqual(
      expect.objectContaining({
        code: inviteCode,
        status: "used",
        usedByUsername: "new-user"
      })
    );
  });

  test("rejects duplicate usernames during registration", async () => {
    const inviteCode = await createInviteCode();

    createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });

    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "tester",
          password: "another-pass",
          displayName: "Another User",
          inviteCode
        })
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "用户名已存在。"
    });
  });

  test("rejects short passwords during registration", async () => {
    const inviteCode = await createInviteCode();

    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "tester",
          password: "123",
          displayName: "Test User",
          inviteCode
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "密码至少需要 8 位。"
    });
  });

  test("rejects registration when self-service signup is disabled", async () => {
    process.env.ATLAS_SELF_SERVICE_SIGNUP_ENABLED = "false";
    const inviteCode = await createInviteCode();

    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "new-user",
          password: "secret-pass",
          displayName: "New User",
          inviteCode
        })
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "当前未开放公开注册。"
    });
  });

  test("rejects registration when invite code is missing or invalid", async () => {
    await createInviteCode();

    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "new-user",
          password: "secret-pass",
          displayName: "New User",
          inviteCode: "wrong-code"
        })
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "邀请码无效。"
    });
  });

  test("accepts a valid database invite even when legacy env invite code is configured", async () => {
    process.env.ATLAS_SIGNUP_INVITE_CODE = "legacy-only-code";
    const inviteCode = await createInviteCode("ATLAS-EF56-GH78");

    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "new-user-2",
          password: "secret-pass",
          displayName: "New User Two",
          inviteCode
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: expect.objectContaining({
        username: "new-user-2",
        displayName: "New User Two"
      })
    });
  });

  test("rejects registration when username format is invalid", async () => {
    const inviteCode = await createInviteCode();

    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "bad name",
          password: "secret-pass",
          displayName: "Bad Name",
          inviteCode
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "用户名只能包含字母、数字、下划线或连字符，长度 3 到 32 位。"
    });
  });

  test("rate limits repeated registrations from the same ip", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const inviteCode = await createInviteCode(`ATLAS-AB12-CD3${attempt}`);
      const response = await registerPost(
        new Request("http://localhost/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
          body: JSON.stringify({
            username: `user-${attempt}`,
            password: "secret-pass",
            displayName: `User ${attempt}`,
            inviteCode
          })
        })
      );

      expect(response.status).toBe(200);
    }

    const blockedInviteCode = await createInviteCode("ATLAS-AB12-CD39");
    const blockedResponse = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" },
        body: JSON.stringify({
          username: "user-4",
          password: "secret-pass",
          displayName: "User 4",
          inviteCode: blockedInviteCode
        })
      })
    );

    expect(blockedResponse.status).toBe(429);
    await expect(blockedResponse.json()).resolves.toEqual({
      error: "注册过于频繁，请稍后再试。"
    });
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
