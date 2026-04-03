import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createAuditEvent,
  createSession,
  createUser,
  findSessionByToken,
  findUserByUsername,
  getDailyAuditSummary,
  resetAuthDatabase,
  revokeSession
} from "@/lib/auth-db";

let authDbDir: string;
let authDbPath: string;

describe("auth database", () => {
  beforeEach(() => {
    authDbDir = mkdtempSync(join(tmpdir(), "atlas-auth-db-"));
    authDbPath = join(authDbDir, "atlas.db");
    process.env.ATLAS_DB_PATH = authDbPath;
    resetAuthDatabase();
  });

  afterEach(() => {
    resetAuthDatabase();
    delete process.env.ATLAS_DB_PATH;
    rmSync(authDbDir, { recursive: true, force: true });
  });

  test("creates users, sessions, audit events, and daily summaries in sqlite", () => {
    const user = createUser({
      username: "tester",
      passwordHash: "hashed-password",
      displayName: "Test User"
    });

    expect(findUserByUsername("tester")).toEqual(
      expect.objectContaining({
        id: user.id,
        username: "tester",
        displayName: "Test User",
        status: "active"
      })
    );

    const session = createSession({
      userId: user.id,
      tokenHash: "token-hash",
      expiresAt: "2026-04-15T00:00:00.000Z",
      ip: "127.0.0.1",
      userAgent: "vitest"
    });

    expect(findSessionByToken("token-hash")).toEqual(
      expect.objectContaining({
        id: session.id,
        userId: user.id,
        ip: "127.0.0.1"
      })
    );

    createAuditEvent({
      userId: user.id,
      eventType: "login_success",
      eventTime: "2026-03-30T08:00:00.000Z",
      payload: { username: "tester" },
      ip: "127.0.0.1",
      userAgent: "vitest"
    });
    createAuditEvent({
      userId: user.id,
      eventType: "analysis_created",
      eventTime: "2026-03-30T08:05:00.000Z",
      jobId: "job-1",
      targetType: "analysis_job",
      targetId: "job-1",
      payload: { fileName: "demo.pdf" },
      ip: "127.0.0.1",
      userAgent: "vitest"
    });

    expect(getDailyAuditSummary("2026-03-30")).toEqual({
      activeUsers: 1,
      registerSuccessCount: 0,
      registerFailedCount: 0,
      loginSuccessCount: 1,
      loginFailedCount: 0,
      analysisCreatedCount: 1,
      analysisCompletedCount: 0,
      analysisFailedCount: 0,
      followupAskedCount: 0,
      parameterConfirmedCount: 0,
      parameterCorrectedCount: 0,
      exportJsonCount: 0,
      exportHtmlCount: 0,
      exportCsvCount: 0
    });

    revokeSession(session.id);
    expect(findSessionByToken("token-hash")).toBeNull();
  });
});
