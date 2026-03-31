import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { GET } from "@/app/api/analysis/file/route";
import { createAnalysisJob, resetAnalysisJobs } from "@/lib/analysis-jobs";
import { createUser, resetAuthDatabase } from "@/lib/auth-db";
import { hashPassword } from "@/lib/auth";

let analysisJobStoreDir: string;

beforeEach(() => {
  analysisJobStoreDir = mkdtempSync(join(tmpdir(), "analysis-file-route-"));
  process.env.ANALYSIS_JOB_STORE_DIR = analysisJobStoreDir;
  process.env.ATLAS_DB_PATH = join(analysisJobStoreDir, "atlas.db");
  process.env.SESSION_SECRET = "test-session-secret";
  resetAnalysisJobs();
  resetAuthDatabase();
});

afterEach(() => {
  resetAnalysisJobs();
  resetAuthDatabase();
  delete process.env.ANALYSIS_JOB_STORE_DIR;
  delete process.env.ATLAS_DB_PATH;
  delete process.env.SESSION_SECRET;
  rmSync(analysisJobStoreDir, { recursive: true, force: true });
});

describe("GET /api/analysis/file", () => {
  test("rejects unauthenticated file access", async () => {
    const response = await GET(new Request("http://localhost/api/analysis/file?jobId=missing-job"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized"
    });
  });

  test("returns 404 for a missing job pdf", async () => {
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });
    const response = await GET(
      new Request("http://localhost/api/analysis/file?jobId=missing-job", {
        headers: { "x-test-user-id": user.id }
      })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "pdf payload not found"
    });
  });

  test("returns persisted pdf bytes with application/pdf content type", async () => {
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });
    const pdfBuffer = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);

    createAnalysisJob(
      {
        fileName: "s55643-51q.pdf",
        taskName: "S55643-51Q first pass",
        chipName: "S55643-51Q",
        buffer: pdfBuffer
      },
      {
        createId: () => "job-file",
        analyze: async () => ({
          status: "complete",
          warnings: [],
          analysis: {
            summary: "done",
            review: "done",
            keyParameters: [],
            evidence: []
          }
        })
      }
    );

    const response = await GET(
      new Request("http://localhost/api/analysis/file?jobId=job-file", {
        headers: { "x-test-user-id": user.id }
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/pdf");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pdfBuffer);
  });
});
