import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { GET as analysisGet } from "@/app/api/analysis/route";
import { createAnalysisJob } from "@/lib/analysis-jobs";
import { hashPassword } from "@/lib/auth";
import { resetAuthDatabase, createUser } from "@/lib/auth-db";

let tempDir: string;

describe("analysis route cache headers", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "atlas-analysis-cache-"));
    process.env.ANALYSIS_JOB_STORE_DIR = join(tempDir, "jobs");
    process.env.ATLAS_DB_PATH = join(tempDir, "atlas.db");
    process.env.SESSION_SECRET = "test-session-secret";
    resetAuthDatabase();
    createUser({
      username: "tester",
      passwordHash: "hashed-password",
      displayName: "Test User"
    });
  });

  afterEach(() => {
    resetAuthDatabase();
    delete process.env.ANALYSIS_JOB_STORE_DIR;
    delete process.env.ATLAS_DB_PATH;
    delete process.env.SESSION_SECRET;
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("job snapshot responses are no-store so browser polling cannot reuse a stale processing snapshot", async () => {
    const user = createUser({
      username: "route-cache-tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Route Cache Tester"
    });

    const job = createAnalysisJob({
      fileName: "demo.pdf",
      taskName: "demo task",
      chipName: "demo chip",
      buffer: new Uint8Array([1, 2, 3]),
      initialPageCount: 1
    }, {
      analyze: async () => new Promise(() => {})
    });

    const response = await analysisGet(
      new Request(`http://localhost/api/analysis?jobId=${job.jobId}`, {
        headers: {
          "x-test-user-id": user.id
        }
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
