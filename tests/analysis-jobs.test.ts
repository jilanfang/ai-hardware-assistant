import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, test } from "vitest";

import {
  appendAnalysisJobFollowUpMessage,
  createAnalysisJob,
  getAnalysisJob,
  getAnalysisJobDocumentMeta,
  listRecentAnalysisJobs,
  resetAnalysisJobs
} from "@/lib/analysis-jobs";
import type { AnalysisJobResult } from "@/lib/types";

describe("analysis jobs", () => {
  test("returns null for a missing job snapshot", () => {
    resetAnalysisJobs();

    expect(getAnalysisJob("missing-job")).toBeNull();
  });

  test("creates a processing job first and later stores the completed result", async () => {
    const storeDir = mkdtempSync(join(tmpdir(), "analysis-jobs-"));
    process.env.ANALYSIS_JOB_STORE_DIR = storeDir;
    resetAnalysisJobs();

    let resolveAnalysis!: (value: {
      status: "complete";
      warnings: string[];
      analysis: {
        summary: string;
        review: string;
        keyParameters: [];
        evidence: [];
        identity: {
          canonicalPartNumber: string;
          manufacturer: string;
          deviceClass: string;
          parameterTemplateId: string;
          focusChecklist: [];
          publicContext: [];
          confidence: number;
        };
        report: {
          executiveSummary: string;
          deviceIdentity: {
            canonicalPartNumber: string;
            manufacturer: string;
            deviceClass: string;
            parameterTemplateId: string;
            confidence: number;
          };
          keyParameters: [];
          designFocus: [];
          risks: [];
          openQuestions: [];
          publicNotes: [];
          citations: [];
          sections: [];
          claims: [];
        };
        preparationMeta: {
          pageCount: number;
          textCoverage: number;
          extractionMethod: "opendataloader";
          localCandidateCount: number;
          complexityFlags: {
            twoColumn: boolean;
            tableHeavy: boolean;
            imageHeavy: boolean;
            watermarkHeavy: boolean;
            crossPageTableLikely: boolean;
            lowTextReliability: boolean;
          };
        };
        sourceAttribution: {
          mode: "llm_first_with_odl";
          llmProvider: string;
          searchProvider: string;
        };
      };
    }) => void;

    const job = createAnalysisJob(
      {
        fileName: "lmr51430.pdf",
        taskName: "LMR51430 first pass",
        chipName: "LMR51430",
        buffer: new Uint8Array([1, 2, 3]),
        initialPageCount: 9
      },
      {
        createId: () => "job-1",
        analyze: () =>
          new Promise<{
            status: "complete";
            warnings: string[];
            analysis: {
              summary: string;
              review: string;
              keyParameters: [];
              evidence: [];
              identity: {
                canonicalPartNumber: string;
                manufacturer: string;
                deviceClass: string;
                parameterTemplateId: string;
                focusChecklist: [];
                publicContext: [];
                confidence: number;
              };
              report: {
                executiveSummary: string;
                deviceIdentity: {
                  canonicalPartNumber: string;
                  manufacturer: string;
                  deviceClass: string;
                  parameterTemplateId: string;
                  confidence: number;
                };
                keyParameters: [];
                designFocus: [];
                risks: [];
                openQuestions: [];
                publicNotes: [];
                citations: [];
                sections: [];
                claims: [];
              };
              preparationMeta: {
                pageCount: number;
                textCoverage: number;
                extractionMethod: "opendataloader";
                localCandidateCount: number;
                complexityFlags: {
                  twoColumn: boolean;
                  tableHeavy: boolean;
                  imageHeavy: boolean;
                  watermarkHeavy: boolean;
                  crossPageTableLikely: boolean;
                  lowTextReliability: boolean;
                };
              };
              sourceAttribution: {
                mode: "llm_first_with_odl";
                llmProvider: string;
                searchProvider: string;
              };
            };
          }>((resolve) => {
            resolveAnalysis = resolve;
          })
      }
    );

    expect(job).toEqual({
      jobId: "job-1",
      status: "processing",
      warnings: [],
      followUpMessages: [],
      updatedAt: expect.any(String)
    });

    expect(getAnalysisJob("job-1")).toEqual({
      jobId: "job-1",
      status: "processing",
      warnings: [],
      followUpMessages: [],
      updatedAt: expect.any(String)
    });

    expect(getAnalysisJobDocumentMeta("job-1")).toEqual({
      fileName: "lmr51430.pdf",
      taskName: "LMR51430 first pass",
      chipName: "LMR51430",
      pageCount: 9
    });

    expect(
      JSON.parse(readFileSync(join(storeDir, "job-1.json"), "utf8"))
    ).toEqual({
      jobId: "job-1",
      status: "processing",
      warnings: [],
      followUpMessages: [],
      updatedAt: expect.any(String)
    });

    resolveAnalysis({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围。",
        keyParameters: [],
        evidence: [],
        identity: {
          canonicalPartNumber: "LMR51430",
          manufacturer: "Texas Instruments",
          deviceClass: "DC-DC",
          parameterTemplateId: "dc-dc",
          focusChecklist: [],
          publicContext: [],
          confidence: 0.8
        },
        report: {
          executiveSummary: "summary",
          deviceIdentity: {
            canonicalPartNumber: "LMR51430",
            manufacturer: "Texas Instruments",
            deviceClass: "DC-DC",
            parameterTemplateId: "dc-dc",
            confidence: 0.8
          },
          keyParameters: [],
          designFocus: [],
          risks: [],
          openQuestions: [],
          publicNotes: [],
          citations: [],
          sections: [],
          claims: []
        },
        preparationMeta: {
          pageCount: 2,
          textCoverage: 200,
          extractionMethod: "opendataloader",
          localCandidateCount: 0,
          complexityFlags: {
            twoColumn: false,
            tableHeavy: false,
            imageHeavy: false,
            watermarkHeavy: false,
            crossPageTableLikely: false,
            lowTextReliability: false
          }
        },
        sourceAttribution: {
          mode: "llm_first_with_odl",
          llmProvider: "mock",
          searchProvider: "mock"
        }
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getAnalysisJob("job-1")).toEqual({
      jobId: "job-1",
      status: "complete",
      warnings: [],
      followUpMessages: [],
      updatedAt: expect.any(String),
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围。",
        keyParameters: [],
        evidence: [],
        identity: {
          canonicalPartNumber: "LMR51430",
          manufacturer: "Texas Instruments",
          deviceClass: "DC-DC",
          parameterTemplateId: "dc-dc",
          focusChecklist: [],
          publicContext: [],
          confidence: 0.8
        },
        report: {
          executiveSummary: "summary",
          deviceIdentity: {
            canonicalPartNumber: "LMR51430",
            manufacturer: "Texas Instruments",
            deviceClass: "DC-DC",
            parameterTemplateId: "dc-dc",
            confidence: 0.8
          },
          keyParameters: [],
          designFocus: [],
          risks: [],
          openQuestions: [],
          publicNotes: [],
          citations: [],
          sections: [],
          claims: []
        },
        preparationMeta: {
          pageCount: 2,
          textCoverage: 200,
          extractionMethod: "opendataloader",
          localCandidateCount: 0,
          complexityFlags: {
            twoColumn: false,
            tableHeavy: false,
            imageHeavy: false,
            watermarkHeavy: false,
            crossPageTableLikely: false,
            lowTextReliability: false
          }
        },
        sourceAttribution: {
          mode: "llm_first_with_odl",
          llmProvider: "mock",
          searchProvider: "mock"
        }
      }
    });

    expect(
      JSON.parse(readFileSync(join(storeDir, "job-1.json"), "utf8"))
    ).toEqual({
      jobId: "job-1",
      status: "complete",
      warnings: [],
      followUpMessages: [],
      updatedAt: expect.any(String),
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围。",
        keyParameters: [],
        evidence: [],
        identity: {
          canonicalPartNumber: "LMR51430",
          manufacturer: "Texas Instruments",
          deviceClass: "DC-DC",
          parameterTemplateId: "dc-dc",
          focusChecklist: [],
          publicContext: [],
          confidence: 0.8
        },
        report: {
          executiveSummary: "summary",
          deviceIdentity: {
            canonicalPartNumber: "LMR51430",
            manufacturer: "Texas Instruments",
            deviceClass: "DC-DC",
            parameterTemplateId: "dc-dc",
            confidence: 0.8
          },
          keyParameters: [],
          designFocus: [],
          risks: [],
          openQuestions: [],
          publicNotes: [],
          citations: [],
          sections: [],
          claims: []
        },
        preparationMeta: {
          pageCount: 2,
          textCoverage: 200,
          extractionMethod: "opendataloader",
          localCandidateCount: 0,
          complexityFlags: {
            twoColumn: false,
            tableHeavy: false,
            imageHeavy: false,
            watermarkHeavy: false,
            crossPageTableLikely: false,
            lowTextReliability: false
          }
        },
        sourceAttribution: {
          mode: "llm_first_with_odl",
          llmProvider: "mock",
          searchProvider: "mock"
        }
      }
    });

    expect(getAnalysisJobDocumentMeta("job-1")).toEqual({
      fileName: "lmr51430.pdf",
      taskName: "LMR51430 first pass",
      chipName: "LMR51430",
      pageCount: 2
    });

    delete process.env.ANALYSIS_JOB_STORE_DIR;
    rmSync(storeDir, { recursive: true, force: true });
  });

  test("stores a partial in-flight snapshot before the final result resolves", async () => {
    const storeDir = mkdtempSync(join(tmpdir(), "analysis-jobs-partial-"));
    process.env.ANALYSIS_JOB_STORE_DIR = storeDir;
    resetAnalysisJobs();

    let resolveAnalysis!: (value: AnalysisJobResult) => void;

    createAnalysisJob(
      {
        fileName: "upf5755.pdf",
        taskName: "UPF5755 smoke",
        chipName: "UPF5755",
        buffer: new Uint8Array([1, 2, 3]),
        initialPageCount: 7
      },
      {
        createId: () => "job-partial",
        analyze: ({ onProgress }: {
          onProgress?: (snapshot: AnalysisJobResult) => void;
        } & Record<string, unknown>) => {
          onProgress?.({
            status: "partial",
            warnings: ["参数初稿已生成，完整报告仍在整理。"],
            analysis: {
              summary: "",
              review: "",
              keyParameters: [
                {
                  name: "Frequency Coverage",
                  value: "5.15 GHz to 5.85 GHz",
                  evidenceId: "ev-1",
                  status: "needs_review"
                }
              ],
              evidence: [
                {
                  id: "ev-1",
                  label: "frequency range",
                  page: 1,
                  quote: "5.15 to 5.85GHz",
                  rect: { left: 1, top: 1, width: 1, height: 1 }
                }
              ],
              parameterReconciliation: {
                fastPassCompleted: true,
                fullReportCompleted: false,
                conflictCount: 0,
                conflicts: [],
                missingFromFastPass: [],
                missingFromReportPass: [],
                arbitrationNotes: []
              },
              fastParametersReadyAt: "2026-03-30T00:00:00.000Z",
              fullReportReadyAt: null,
              preparationMeta: {
                pageCount: 7,
                textCoverage: 0,
                extractionMethod: "none",
                localCandidateCount: 0,
                complexityFlags: {
                  twoColumn: false,
                  tableHeavy: false,
                  imageHeavy: false,
                  watermarkHeavy: false,
                  crossPageTableLikely: false,
                  lowTextReliability: false
                }
              }
            }
          });

          return new Promise<AnalysisJobResult>((resolve) => {
            resolveAnalysis = resolve;
          });
        }
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getAnalysisJob("job-partial")).toEqual({
      jobId: "job-partial",
      status: "partial",
      warnings: ["参数初稿已生成，完整报告仍在整理。"],
      followUpMessages: [],
      updatedAt: expect.any(String),
      analysis: expect.objectContaining({
        fastParametersReadyAt: "2026-03-30T00:00:00.000Z",
        parameterReconciliation: expect.objectContaining({
          fastPassCompleted: true,
          fullReportCompleted: false
        }),
        keyParameters: [
          expect.objectContaining({
            name: "Frequency Coverage",
            status: "needs_review"
          })
        ]
      })
    });

    resolveAnalysis({
      status: "failed",
      warnings: ["LLM 主分析链路超时，当前任务已停止。请稍后重试，或检查 provider / base URL 是否稳定。"],
      analysis: {
        summary: "LLM 主分析链路超时，当前任务已停止。请稍后重试，或检查 provider / base URL 是否稳定。",
        review: "LLM 主分析链路超时，当前任务已停止。请稍后重试，或检查 provider / base URL 是否稳定。",
        keyParameters: [],
        evidence: []
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getAnalysisJob("job-partial")).toEqual(
      expect.objectContaining({
        jobId: "job-partial",
        status: "failed"
      })
    );

    delete process.env.ANALYSIS_JOB_STORE_DIR;
    rmSync(storeDir, { recursive: true, force: true });
  });

  test("lists recent jobs with metadata ordered by latest update time", async () => {
    const storeDir = mkdtempSync(join(tmpdir(), "analysis-jobs-list-"));
    process.env.ANALYSIS_JOB_STORE_DIR = storeDir;
    resetAnalysisJobs();

    createAnalysisJob(
      {
        fileName: "older.pdf",
        taskName: "Older 初步分析",
        chipName: "Older",
        buffer: new Uint8Array([1, 2, 3]),
        initialPageCount: 6
      },
      {
        createId: () => "job-older",
        analyze: async () => ({
          status: "complete",
          warnings: [],
          analysis: {
            summary: "older done",
            review: "done",
            keyParameters: [],
            evidence: []
          }
        })
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 5));

    createAnalysisJob(
      {
        fileName: "newer.pdf",
        taskName: "Newer 初步分析",
        chipName: "Newer",
        buffer: new Uint8Array([4, 5, 6]),
        initialPageCount: 11
      },
      {
        createId: () => "job-newer",
        analyze: async () => ({
          status: "partial",
          warnings: ["partial"],
          analysis: {
            summary: "newer partial",
            review: "check",
            keyParameters: [],
            evidence: []
          }
        })
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(listRecentAnalysisJobs()).toEqual([
      expect.objectContaining({
        jobId: "job-newer",
        status: "partial",
        updatedAt: expect.any(String),
        documentMeta: {
          fileName: "newer.pdf",
          taskName: "Newer 初步分析",
          chipName: "Newer",
          pageCount: 11
        },
        hasAnalysis: true,
        followUpCount: 0
      }),
      expect.objectContaining({
        jobId: "job-older",
        status: "complete",
        updatedAt: expect.any(String),
        documentMeta: {
          fileName: "older.pdf",
          taskName: "Older 初步分析",
          chipName: "Older",
          pageCount: 6
        },
        hasAnalysis: true,
        followUpCount: 0
      })
    ]);

    delete process.env.ANALYSIS_JOB_STORE_DIR;
    rmSync(storeDir, { recursive: true, force: true });
  });

  test("appends persisted follow-up messages onto an existing job snapshot", async () => {
    const storeDir = mkdtempSync(join(tmpdir(), "analysis-jobs-followup-"));
    process.env.ANALYSIS_JOB_STORE_DIR = storeDir;
    resetAnalysisJobs();

    createAnalysisJob(
      {
        fileName: "s55643-51q.pdf",
        taskName: "S55643-51Q first pass",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([1, 2, 3])
      },
      {
        createId: () => "job-followup-store",
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

    await new Promise((resolve) => setTimeout(resolve, 0));

    const updated = appendAnalysisJobFollowUpMessage("job-followup-store", {
      id: "follow-1",
      question: "这颗芯片最先看哪几个参数？",
      answer: "优先看 Supported bands 和 linear output power。",
      claims: [],
      citations: [],
      warnings: [],
      usedSources: ["datasheet"],
      sourceAttribution: {
        mode: "llm_first"
      },
      createdAt: "2026-03-30T08:00:00.000Z"
    });

    expect(updated).toEqual(
      expect.objectContaining({
        jobId: "job-followup-store",
        followUpMessages: [
          expect.objectContaining({
            id: "follow-1",
            question: "这颗芯片最先看哪几个参数？"
          })
        ]
      })
    );
    expect(getAnalysisJob("job-followup-store")?.followUpMessages).toEqual([
      expect.objectContaining({
        id: "follow-1",
        answer: "优先看 Supported bands 和 linear output power。"
      })
    ]);
  });

  test("stores a failed job snapshot when analysis throws", async () => {
    const storeDir = mkdtempSync(join(tmpdir(), "analysis-jobs-"));
    process.env.ANALYSIS_JOB_STORE_DIR = storeDir;
    resetAnalysisJobs();

    createAnalysisJob(
      {
        fileName: "broken.pdf",
        taskName: "Broken first pass",
        chipName: "Broken",
        buffer: new Uint8Array([1, 2, 3])
      },
      {
        createId: () => "job-2",
        analyze: async () => {
          throw new Error("boom");
        }
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getAnalysisJob("job-2")).toEqual({
      jobId: "job-2",
      status: "failed",
      warnings: ["当前解析失败，请稍后重试。"],
      followUpMessages: [],
      updatedAt: expect.any(String)
    });

    expect(
      JSON.parse(readFileSync(join(storeDir, "job-2.json"), "utf8"))
    ).toEqual({
      jobId: "job-2",
      status: "failed",
      warnings: ["当前解析失败，请稍后重试。"],
      followUpMessages: [],
      updatedAt: expect.any(String)
    });

    delete process.env.ANALYSIS_JOB_STORE_DIR;
    rmSync(storeDir, { recursive: true, force: true });
  });

  test("stores analyzed page count into document meta when analysis completes", async () => {
    const storeDir = mkdtempSync(join(tmpdir(), "analysis-jobs-pages-"));
    process.env.ANALYSIS_JOB_STORE_DIR = storeDir;
    resetAnalysisJobs();

    createAnalysisJob(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q first pass",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([1, 2, 3])
      },
      {
        createId: () => "job-pages",
        analyze: async () => ({
          status: "complete",
          warnings: [],
          analysis: {
            summary: "done",
            review: "done",
            keyParameters: [],
            evidence: [],
            preparationMeta: {
              pageCount: 43,
              textCoverage: 1000,
              extractionMethod: "opendataloader",
              localCandidateCount: 0,
              complexityFlags: {
                twoColumn: false,
                tableHeavy: false,
                imageHeavy: false,
                watermarkHeavy: false,
                crossPageTableLikely: false,
                lowTextReliability: false
              }
            },
            identity: {
              canonicalPartNumber: "S55643-51Q",
              manufacturer: "Samsung",
              deviceClass: "Cellular PAM / PA",
              parameterTemplateId: "cellular-3g4g5g",
              focusChecklist: [],
              publicContext: [],
              confidence: 0.9
            },
            report: {
              executiveSummary: "done",
              deviceIdentity: {
                canonicalPartNumber: "S55643-51Q",
                manufacturer: "Samsung",
                deviceClass: "Cellular PAM / PA",
                parameterTemplateId: "cellular-3g4g5g",
                confidence: 0.9
              },
              keyParameters: [],
              designFocus: [],
              risks: [],
              openQuestions: [],
              publicNotes: [],
              citations: [],
              sections: [],
              claims: []
            },
            sourceAttribution: {
              mode: "llm_first_with_odl",
              llmProvider: "mock",
              searchProvider: "mock"
            }
          }
        })
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getAnalysisJobDocumentMeta("job-pages")).toEqual({
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q first pass",
      chipName: "S55643-51Q",
      pageCount: 43
    });
  });

  test("preserves source-specific failed warnings returned by analysis", async () => {
    const storeDir = mkdtempSync(join(tmpdir(), "analysis-jobs-"));
    process.env.ANALYSIS_JOB_STORE_DIR = storeDir;
    resetAnalysisJobs();

    createAnalysisJob(
      {
        fileName: "scanned.pdf",
        taskName: "Scanned first pass",
        chipName: "Scanned",
        buffer: new Uint8Array([1, 2, 3])
      },
      {
        createId: () => "job-3",
        analyze: async () => ({
          status: "failed",
          warnings: ["当前 PDF 未能提取到可用文本，请先上传带文本层的数据手册。"],
          analysis: {
            summary: "当前 PDF 未能提取到可用文本。",
            review: "建议先上传带文本层的数据手册。",
            keyParameters: [],
            evidence: [],
            events: []
          }
        })
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getAnalysisJob("job-3")).toEqual({
      jobId: "job-3",
      status: "failed",
      warnings: ["当前 PDF 未能提取到可用文本，请先上传带文本层的数据手册。"],
      followUpMessages: [],
      updatedAt: expect.any(String),
      analysis: {
        summary: "当前 PDF 未能提取到可用文本。",
        review: "建议先上传带文本层的数据手册。",
        keyParameters: [],
        evidence: [],
        events: []
      }
    });

    expect(
      JSON.parse(readFileSync(join(storeDir, "job-3.json"), "utf8"))
    ).toEqual({
      jobId: "job-3",
      status: "failed",
      warnings: ["当前 PDF 未能提取到可用文本，请先上传带文本层的数据手册。"],
      followUpMessages: [],
      updatedAt: expect.any(String),
      analysis: {
        summary: "当前 PDF 未能提取到可用文本。",
        review: "建议先上传带文本层的数据手册。",
        keyParameters: [],
        evidence: [],
        events: []
      }
    });

    delete process.env.ANALYSIS_JOB_STORE_DIR;
    rmSync(storeDir, { recursive: true, force: true });
  });

  test("keeps existing jobs readable after resetting a different store directory", async () => {
    delete process.env.ANALYSIS_JOB_STORE_DIR;
    resetAnalysisJobs();

    let resolveAnalysis!: (value: {
      status: "complete";
      warnings: string[];
      analysis: {
        summary: string;
        review: string;
        keyParameters: [];
        evidence: [];
      };
    }) => void;

    const originalJob = createAnalysisJob(
      {
        fileName: "stable.pdf",
        taskName: "Stable first pass",
        chipName: "Stable",
        buffer: new Uint8Array([1, 2, 3])
      },
      {
        createId: () => "stable-job",
        analyze: () =>
          new Promise<{
            status: "complete";
            warnings: string[];
            analysis: {
              summary: string;
              review: string;
              keyParameters: [];
              evidence: [];
            };
          }>((resolve) => {
            resolveAnalysis = resolve;
          })
      }
    );

    const isolatedStoreDir = mkdtempSync(join(tmpdir(), "analysis-jobs-"));
    process.env.ANALYSIS_JOB_STORE_DIR = isolatedStoreDir;
    resetAnalysisJobs();

    expect(originalJob).toEqual({
      jobId: "stable-job",
      status: "processing",
      warnings: [],
      followUpMessages: [],
      updatedAt: expect.any(String)
    });
    expect(getAnalysisJob("stable-job")).toEqual({
      jobId: "stable-job",
      status: "processing",
      warnings: [],
      followUpMessages: [],
      updatedAt: expect.any(String)
    });

    resolveAnalysis({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "Stable 已完成真实解析。",
        review: "建议优先检查输入范围。",
        keyParameters: [],
        evidence: []
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getAnalysisJob("stable-job")).toEqual({
      jobId: "stable-job",
      status: "complete",
      warnings: [],
      followUpMessages: [],
      updatedAt: expect.any(String),
      analysis: {
        summary: "Stable 已完成真实解析。",
        review: "建议优先检查输入范围。",
        keyParameters: [],
        evidence: []
      }
    });

    delete process.env.ANALYSIS_JOB_STORE_DIR;
    rmSync(isolatedStoreDir, { recursive: true, force: true });
    resetAnalysisJobs();
  });
});
