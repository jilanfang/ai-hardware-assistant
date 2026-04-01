import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { GET, PATCH, POST } from "@/app/api/analysis/route";
import { createAnalysisJob, resetAnalysisJobs } from "@/lib/analysis-jobs";
import { createUser, getDailyAuditSummary, resetAuthDatabase } from "@/lib/auth-db";
import { hashPassword } from "@/lib/auth";

let analysisJobStoreDir: string;

beforeEach(() => {
  analysisJobStoreDir = mkdtempSync(join(tmpdir(), "analysis-route-jobs-"));
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

async function createPostRequest(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("taskName", "Test first pass");
  formData.append("chipName", "Test chip");

  return POST({
    formData: async () => formData
  } as Request);
}

async function createPostRequestWithArrayBuffer(file: File) {
  return POST({
    formData: async () =>
      ({
        get(key: string) {
          if (key === "file") return file;
          if (key === "taskName") return "Test first pass";
          if (key === "chipName") return "Test chip";
          return null;
        }
      }) as FormData
  } as Request);
}

async function waitForAnalysis(jobId: string) {
  let lastSnapshot: { status?: string; warnings?: string[] } | null = null;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const snapshotResponse = await GET(
      new Request(`http://localhost/api/analysis?jobId=${jobId}`)
    );
    const snapshot = await snapshotResponse.json();
    lastSnapshot = snapshot;

    if (snapshot.status !== "processing") {
      return snapshot;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(
    `analysis did not complete in time: ${lastSnapshot?.status ?? "unknown"} ${lastSnapshot?.warnings?.join(", ") ?? ""}`.trim()
  );
}

describe("POST /api/analysis", () => {
  test("rejects unauthenticated analysis api access", async () => {
    const response = await GET(new Request("http://localhost/api/analysis"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized"
    });
  });

  test("returns 404 when fetching a missing job", async () => {
    resetAnalysisJobs();
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });

    const response = await GET(
      new Request("http://localhost/api/analysis?jobId=missing-job", {
        headers: {
          "x-test-user-id": user.id
        }
      })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "job not found"
    });
  });

  test("returns recent jobs when fetching analysis without a job id", async () => {
    resetAnalysisJobs();
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });
    createAnalysisJob(
      {
        fileName: "s55643-51q.pdf",
        taskName: "S55643-51Q first pass",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70])
      },
      {
        createId: () => "job-recent-route",
        analyze: async () => ({
          status: "complete",
          warnings: [],
          analysis: {
            summary: "S55643-51Q 已完成真实解析。",
            review: "建议优先检查支持频段。",
            keyParameters: [],
            evidence: []
          }
        })
      }
    );

    await waitForAnalysis("job-recent-route");

    const response = await GET(
      new Request("http://localhost/api/analysis", {
        headers: {
          "x-test-user-id": user.id
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobs: [
        expect.objectContaining({
          jobId: "job-recent-route",
          status: "complete",
          updatedAt: expect.any(String),
          documentMeta: {
            fileName: "s55643-51q.pdf",
            taskName: "S55643-51Q first pass",
            chipName: "S55643-51Q",
            pageCount: 1
          },
          hasAnalysis: true,
          followUpCount: 0
        })
      ]
    });
  });

  test("returns document meta, pdf url, and persisted follow-up messages when fetching a job", async () => {
    resetAnalysisJobs();
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });
    createAnalysisJob(
      {
        fileName: "s55643-51q.pdf",
        taskName: "S55643-51Q first pass",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70])
      },
      {
        createId: () => "job-hydrate",
        analyze: async () => ({
          status: "complete",
          warnings: [],
          analysis: {
            summary: "S55643-51Q 已完成真实解析。",
            review: "建议优先检查支持频段。",
            keyParameters: [],
            evidence: []
          }
        })
      }
    );

    await waitForAnalysis("job-hydrate");

    const response = await GET(
      new Request("http://localhost/api/analysis?jobId=job-hydrate", {
        headers: {
          "x-test-user-id": user.id
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        jobId: "job-hydrate",
        documentMeta: {
          fileName: "s55643-51q.pdf",
          taskName: "S55643-51Q first pass",
          chipName: "S55643-51Q",
          pageCount: 1
        },
        pdfUrl: "/api/analysis/file?jobId=job-hydrate",
        followUpMessages: [],
        status: "complete",
        warnings: [],
        updatedAt: expect.any(String)
      })
    );
  });

  test("returns 404 when patching a missing job", async () => {
    resetAnalysisJobs();
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });

    const response = await PATCH(
      new Request("http://localhost/api/analysis", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-test-user-id": user.id },
        body: JSON.stringify({
          jobId: "missing-job",
          parameterName: "Package",
          evidenceId: "ev-package",
          action: "confirm"
        })
      })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "job not found"
    });
  });

  test("returns 400 when patching with missing required fields", async () => {
    resetAnalysisJobs();
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });

    const response = await PATCH(
      new Request("http://localhost/api/analysis", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-test-user-id": user.id },
        body: JSON.stringify({
          jobId: "job-confirm",
          parameterName: "Input voltage"
        })
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "missing patch fields"
    });
  });

  test("persists a parameter confirmation into the job snapshot", async () => {
    resetAnalysisJobs();
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });
    createAnalysisJob(
      {
        fileName: "lmr51430-datasheet.pdf",
        taskName: "Test first pass",
        chipName: "Test chip",
        buffer: new Uint8Array([37, 80, 68, 70])
      },
      {
        createId: () => "job-confirm",
        analyze: async () => ({
          status: "complete",
          warnings: [],
          analysis: {
            summary: "LMR51430 已完成真实解析。",
            review: "建议优先检查输入范围。",
            keyParameters: [
              {
                name: "Input voltage",
                value: "4.5 V to 36 V",
                evidenceId: "ev-input",
                status: "needs_review"
              }
            ],
            evidence: [
              {
                id: "ev-input",
                label: "输入电压范围",
                page: 1,
                quote: "VIN operating range 4.5 V to 36 V",
                rect: { left: 14, top: 18, width: 46, height: 10 }
              }
            ]
          }
        })
      }
    );

    const patchResponse = await PATCH(
      new Request("http://localhost/api/analysis", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-test-user-id": user.id },
        body: JSON.stringify({
          jobId: "job-confirm",
          parameterName: "Input voltage",
          evidenceId: "ev-input",
          action: "confirm"
        })
      })
    );

    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toEqual(
      expect.objectContaining({
        analysis: expect.objectContaining({
          keyParameters: expect.arrayContaining([
            expect.objectContaining({
              name: "Input voltage",
              status: "confirmed",
              provenance: expect.objectContaining({
                extractedBy: "user_confirmed"
              })
            })
          ]),
          events: expect.arrayContaining([
            expect.objectContaining({
              type: "parameter_confirmed",
              parameterName: "Input voltage"
            })
          ])
        })
      })
    );

    expect(getDailyAuditSummary(new Date().toISOString().slice(0, 10))).toEqual(
      expect.objectContaining({
        parameterConfirmedCount: 1
      })
    );
  });

  test("rejects a non-pdf upload before creating a job", async () => {
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });
    const formData = new FormData();
    formData.append("file", new File(["not a pdf"], "notes.txt", { type: "text/plain" }));
    formData.append("taskName", "Test first pass");
    formData.append("chipName", "Test chip");

    const response = await POST({
      headers: new Headers({ "x-test-user-id": user.id }),
      formData: async () => formData
    } as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "请上传 PDF 格式的数据手册。"
    });
  });

  test("rejects an empty pdf upload before creating a job", async () => {
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });
    const formData = new FormData();
    formData.append("file", new File([], "empty.pdf", { type: "application/pdf" }));
    formData.append("taskName", "Test first pass");
    formData.append("chipName", "Test chip");

    const response = await POST({
      headers: new Headers({ "x-test-user-id": user.id }),
      formData: async () => formData
    } as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "上传的 PDF 为空，请重新选择文件。"
    });
  });

  test("rejects an oversized pdf upload before creating a job", async () => {
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });
    const oversizedPayload = new Uint8Array(10 * 1024 * 1024 + 1);
    const formData = new FormData();
    formData.append("file", new File([oversizedPayload], "oversized.pdf", { type: "application/pdf" }));
    formData.append("taskName", "Test first pass");
    formData.append("chipName", "Test chip");

    const response = await POST({
      headers: new Headers({ "x-test-user-id": user.id }),
      formData: async () => formData
    } as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "PDF 不能超过 10 MB，请压缩后再试。"
    });
  });

  test("records analysis_created when an authenticated upload creates a job", async () => {
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });

    const authenticatedResponse = await POST({
      headers: new Headers({ "x-test-user-id": user.id }),
      formData: async () => {
        const formData = new FormData();
        formData.append("file", new File(["%PDF"], "demo.pdf", { type: "application/pdf" }));
        formData.append("taskName", "Test first pass");
        formData.append("chipName", "Test chip");
        return formData;
      }
    } as Request);

    expect(authenticatedResponse.status).toBe(200);
    expect(getDailyAuditSummary(new Date().toISOString().slice(0, 10))).toEqual(
      expect.objectContaining({
        analysisCreatedCount: 1
      })
    );
  });
});
