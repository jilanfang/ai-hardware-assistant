import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { POST } from "@/app/api/analysis/follow-up/route";
import { createAnalysisJob, getAnalysisJob, resetAnalysisJobs } from "@/lib/analysis-jobs";
import { createUser, getDailyAuditSummary, resetAuthDatabase } from "@/lib/auth-db";
import { hashPassword } from "@/lib/auth";

let analysisJobStoreDir: string;

beforeEach(() => {
  analysisJobStoreDir = mkdtempSync(join(tmpdir(), "analysis-followup-route-"));
  process.env.ANALYSIS_JOB_STORE_DIR = analysisJobStoreDir;
  process.env.ATLAS_DB_PATH = join(analysisJobStoreDir, "atlas.db");
  process.env.SESSION_SECRET = "test-session-secret";
  process.env.ANALYSIS_LLM_PROVIDER = "mock";
  resetAnalysisJobs();
  resetAuthDatabase();
});

afterEach(() => {
  resetAnalysisJobs();
  resetAuthDatabase();
  delete process.env.ANALYSIS_JOB_STORE_DIR;
  delete process.env.ATLAS_DB_PATH;
  delete process.env.SESSION_SECRET;
  delete process.env.ANALYSIS_LLM_PROVIDER;
  vi.restoreAllMocks();
  rmSync(analysisJobStoreDir, { recursive: true, force: true });
});

describe("POST /api/analysis/follow-up", () => {
  test("rejects unauthenticated follow-up requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/analysis/follow-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId: "missing-job",
          question: "test"
        })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthorized"
    });
  });

  test("returns a real follow-up answer grounded in the existing job snapshot", async () => {
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });
    createAnalysisJob(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70])
      },
      {
        createId: () => "job-follow-up",
        analyze: async () => ({
          status: "complete",
          warnings: [],
          analysis: {
            summary: "S55643-51Q 已完成主报告。",
            review: "优先核对支持频段和线性输出功率。",
            keyParameters: [
              {
                name: "Supported bands",
                value: "NR/LTE/3G",
                evidenceId: "ev-bands",
                status: "confirmed"
              }
            ],
            evidence: [
              {
                id: "ev-bands",
                label: "Supported bands",
                page: 2,
                quote: "Mode Bands NR ... LTE ... WCDMA ...",
                rect: { left: 10, top: 20, width: 30, height: 8 }
              }
            ],
            identity: {
              canonicalPartNumber: "S55643-51Q",
              manufacturer: "Samsung",
              deviceClass: "Cellular PAM / PA",
              parameterTemplateId: "cellular-3g4g5g",
              focusChecklist: ["Supported bands", "RFFE bus"],
              publicContext: [
                {
                  id: "public-1",
                  title: "Samsung S55643-51Q overview",
                  url: "https://example.com/s55643-51q",
                  snippet: "Public overview",
                  sourceType: "public"
                }
              ],
              confidence: 0.92
            },
            report: {
              executiveSummary: "S55643-51Q 是一颗蜂窝 PAM。",
              deviceIdentity: {
                canonicalPartNumber: "S55643-51Q",
                manufacturer: "Samsung",
                deviceClass: "Cellular PAM / PA",
                parameterTemplateId: "cellular-3g4g5g",
                confidence: 0.92
              },
              keyParameters: [
                {
                  id: "claim-bands",
                  label: "Supported bands",
                  value: "NR/LTE/3G",
                  title: "Supported bands",
                  body: "支持多制式",
                  sourceType: "datasheet",
                  citations: [
                    {
                      id: "cite-bands",
                      sourceType: "datasheet",
                      page: 2,
                      quote: "Mode Bands NR ... LTE ... WCDMA ..."
                    }
                  ]
                }
              ],
              designFocus: [],
              risks: [],
              openQuestions: [],
              publicNotes: [
                {
                  id: "public-note-1",
                  label: "Public context",
                  title: "Public context",
                  body: "外部资料只能作补充。",
                  sourceType: "public",
                  citations: [
                    {
                      id: "cite-public-1",
                      sourceType: "public",
                      url: "https://example.com/s55643-51q",
                      title: "Samsung S55643-51Q overview",
                      snippet: "Public overview"
                    }
                  ]
                }
              ],
              citations: [],
              sections: [],
              claims: []
            },
            sourceAttribution: {
              mode: "llm_first"
            }
          }
        })
      }
    );

    const response = await POST(
      new Request("http://localhost/api/analysis/follow-up", {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user-id": user.id },
        body: JSON.stringify({
          jobId: "job-follow-up",
          question: "这个器件最先看哪几个参数，为什么？"
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        messageId: expect.any(String),
        createdAt: expect.any(String),
        answer: expect.any(String),
        claims: expect.any(Array),
        citations: expect.any(Array),
        warnings: expect.any(Array),
        usedSources: expect.arrayContaining(["datasheet", "public"]),
        sourceAttribution: expect.objectContaining({
          mode: "llm_first"
        })
      })
    );
    expect(getAnalysisJob("job-follow-up")?.followUpMessages).toEqual([
      expect.objectContaining({
        question: "这个器件最先看哪几个参数，为什么？",
        answer: expect.any(String)
      })
    ]);
    expect(getDailyAuditSummary(new Date().toISOString().slice(0, 10))).toEqual(
      expect.objectContaining({
        followupAskedCount: 1
      })
    );
  });

  test("fails instead of falling back to local canned reply when no llm provider is configured", async () => {
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });

    const response = await POST(
      new Request("http://localhost/api/analysis/follow-up", {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user-id": user.id },
        body: JSON.stringify({
          jobId: "missing-job",
          question: "这个器件最先看哪几个参数，为什么？"
        })
      })
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "job not found"
    });
  });

  test("rejects follow-up while only fast parameters are ready and full report is still pending", async () => {
    const user = createUser({
      username: "tester",
      passwordHash: await hashPassword("secret-pass"),
      displayName: "Test User"
    });
    createAnalysisJob(
      {
        fileName: "LMR51430.pdf",
        taskName: "LMR51430 初步分析",
        chipName: "LMR51430",
        buffer: new Uint8Array([37, 80, 68, 70])
      },
      {
        createId: () => "job-fast-pass-only",
        analyze: async () => ({
          status: "partial",
          warnings: ["参数初稿已生成，完整报告仍在整理。"],
          analysis: {
            summary: "",
            review: "",
            keyParameters: [
              {
                name: "Input voltage",
                value: "4.5V to 36V",
                evidenceId: "ev-vin",
                status: "needs_review"
              }
            ],
            evidence: [
              {
                id: "ev-vin",
                label: "Input voltage",
                page: 1,
                quote: "Input voltage 4.5V to 36V",
                rect: { left: 10, top: 20, width: 30, height: 8 }
              }
            ],
            identity: {
              canonicalPartNumber: "LMR51430",
              manufacturer: "Texas Instruments",
              deviceClass: "Power",
              parameterTemplateId: "power",
              focusChecklist: ["Input voltage"],
              publicContext: [],
              confidence: 0.9
            },
            report: null,
            parameterReconciliation: {
              fastPassCompleted: true,
              fullReportCompleted: false,
              conflictCount: 0,
              conflicts: [],
              arbitrationNotes: [],
              missingFromFastPass: [],
              missingFromReportPass: []
            },
            sourceAttribution: {
              mode: "llm_first"
            }
          }
        })
      }
    );

    const response = await POST(
      new Request("http://localhost/api/analysis/follow-up", {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user-id": user.id },
        body: JSON.stringify({
          jobId: "job-fast-pass-only",
          question: "这个器件最先看哪几个参数？"
        })
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "full report not ready"
    });
  });
});
