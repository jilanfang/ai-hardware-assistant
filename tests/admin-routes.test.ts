import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { POST as createInvitesPost } from "@/app/api/admin/invite-codes/route";
import { GET as listInvitesGet } from "@/app/api/admin/invite-codes/route";
import { GET as listUsersGet } from "@/app/api/admin/users/route";
import { createUser, resetAuthDatabase } from "@/lib/auth-db";
import { hashPassword } from "@/lib/auth";

let authDbDir: string;

describe("admin routes", () => {
  beforeEach(() => {
    authDbDir = mkdtempSync(join(tmpdir(), "atlas-admin-route-"));
    process.env.ATLAS_DB_PATH = join(authDbDir, "atlas.db");
    process.env.SESSION_SECRET = "test-session-secret";
    process.env.ATLAS_ADMIN_USERNAMES = "atlas01";
    resetAuthDatabase();
  });

  afterEach(() => {
    resetAuthDatabase();
    delete process.env.ATLAS_DB_PATH;
    delete process.env.SESSION_SECRET;
    delete process.env.ATLAS_ADMIN_USERNAMES;
    rmSync(authDbDir, { recursive: true, force: true });
  });

  test("rejects invite generation for non-admin users", async () => {
    const user = createUser({
      username: "regular-user",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Regular User"
    });

    const response = await createInvitesPost(
      new Request("http://localhost/api/admin/invite-codes", {
        method: "POST",
        headers: { "x-test-user-id": user.id }
      })
    );

    expect(response.status).toBe(403);
  });

  test("creates 20 single-use invite codes for an admin", async () => {
    const admin = createUser({
      username: "atlas01",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Atlas Admin"
    });

    const createResponse = await createInvitesPost(
      new Request("http://localhost/api/admin/invite-codes", {
        method: "POST",
        headers: { "x-test-user-id": admin.id }
      })
    );

    expect(createResponse.status).toBe(200);
    const payload = (await createResponse.json()) as {
      inviteCodes: Array<{ code: string; status: string }>;
    };
    expect(payload.inviteCodes).toHaveLength(20);
    expect(new Set(payload.inviteCodes.map((item) => item.code)).size).toBe(20);
    expect(payload.inviteCodes.every((item) => item.status === "active")).toBe(true);

    const listResponse = await listInvitesGet(
      new Request("http://localhost/api/admin/invite-codes", {
        headers: { "x-test-user-id": admin.id }
      })
    );
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as {
      inviteCodes: Array<{ code: string; status: string }>;
    };
    expect(listed.inviteCodes).toHaveLength(20);
  });

  test("lists users for an admin", async () => {
    const admin = createUser({
      username: "atlas01",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Atlas Admin"
    });
    createUser({
      username: "guest-user",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Guest User"
    });

    const response = await listUsersGet(
      new Request("http://localhost/api/admin/users", {
        headers: { "x-test-user-id": admin.id }
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      users: Array<{ username: string; displayName: string }>;
    };
    expect(payload.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: "atlas01", displayName: "Atlas Admin" }),
        expect.objectContaining({ username: "guest-user", displayName: "Guest User" })
      ])
    );
    expect(payload.users[0]).not.toHaveProperty("passwordHash");
  });
});
