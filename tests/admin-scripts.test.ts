import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createAuditEvent, findUserByUsername, getDailyAuditSummary, resetAuthDatabase } from "@/lib/auth-db";

let tempDir: string;
let authDbPath: string;

describe("admin scripts", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "atlas-admin-script-"));
    authDbPath = join(tempDir, "atlas.db");
    process.env.ATLAS_DB_PATH = authDbPath;
    resetAuthDatabase();
  });

  afterEach(() => {
    resetAuthDatabase();
    delete process.env.ATLAS_DB_PATH;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("creates a manual user and prints a csv row", () => {
    const output = execFileSync(
      "node",
      ["scripts/admin-users.mjs", "create", "--username", "tester", "--display-name", "Test User", "--password", "TempPass123!"],
      {
        cwd: "/Users/jilanfang/ai-hardware-assistant",
        env: {
          ...process.env,
          ATLAS_DB_PATH: authDbPath
        },
        encoding: "utf8"
      }
    );

    expect(output).toContain("username,password,display_name,status");
    expect(output).toContain("tester,TempPass123!,Test User,active");
    expect(findUserByUsername("tester")).toEqual(
      expect.objectContaining({
        username: "tester",
        displayName: "Test User",
        status: "active"
      })
    );
  });

  test("imports a username list and outputs generated passwords as csv", () => {
    const inputPath = join(tempDir, "users.txt");
    writeFileSync(inputPath, "alpha\nbeta\n\n");

    const output = execFileSync("node", ["scripts/admin-users.mjs", "import", "--input", inputPath], {
      cwd: "/Users/jilanfang/ai-hardware-assistant",
      env: {
        ...process.env,
        ATLAS_DB_PATH: authDbPath
      },
      encoding: "utf8"
    });

    expect(output).toContain("username,password,display_name,status");
    expect(output).toMatch(/alpha,[^,\n]+,alpha,active/);
    expect(output).toMatch(/beta,[^,\n]+,beta,active/);
    expect(findUserByUsername("alpha")).toEqual(expect.objectContaining({ username: "alpha" }));
    expect(findUserByUsername("beta")).toEqual(expect.objectContaining({ username: "beta" }));
  });

  test("prints the daily audit summary as json", () => {
    createAuditEvent({
      userId: "user-1",
      eventType: "login_success",
      eventTime: "2026-03-30T08:00:00.000Z"
    });
    createAuditEvent({
      userId: "user-1",
      eventType: "analysis_created",
      eventTime: "2026-03-30T09:00:00.000Z"
    });

    const output = execFileSync("node", ["scripts/audit-summary.mjs", "--date", "2026-03-30", "--format", "json"], {
      cwd: "/Users/jilanfang/ai-hardware-assistant",
      env: {
        ...process.env,
        ATLAS_DB_PATH: authDbPath
      },
      encoding: "utf8"
    });

    expect(JSON.parse(output)).toEqual({
      date: "2026-03-30",
      ...getDailyAuditSummary("2026-03-30")
    });
  });
});
