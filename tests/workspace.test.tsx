import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Workspace } from "@/components/workspace";
import { resetAnalysisJobs } from "@/lib/analysis-jobs";
import type { AnalysisResult, AnalysisJobSnapshot } from "@/lib/types";

const fetchMock = vi.fn();
const replaceStateMock = vi.fn();

beforeEach(() => {
  resetAnalysisJobs();
  window.history.replaceState = replaceStateMock;
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  replaceStateMock.mockReset();
  window.history.pushState(null, "", "/");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function queueAnalysisJobResponses(result: {
  status: "complete" | "partial" | "failed";
  warnings: string[];
  analysis?: AnalysisResult;
}) {
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobId: "job-1",
        status: "processing",
        warnings: [],
        followUpMessages: []
      })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobId: "job-1",
        followUpMessages: [],
        ...result
      })
    });
}

function buildSnapshot(
  overrides: Partial<AnalysisJobSnapshot> & Pick<AnalysisJobSnapshot, "jobId" | "status" | "warnings">
): AnalysisJobSnapshot {
  return {
    followUpMessages: [],
    updatedAt: "2026-03-30T08:00:00.000Z",
    ...overrides
  };
}

function queueFollowUpResponse(payload: {
  answer: string;
  claims?: Array<{
    id: string;
    label: string;
    value?: string;
    title?: string;
    body?: string;
    sourceType: "datasheet" | "public" | "review";
    citations: Array<{
      id: string;
      sourceType: "datasheet" | "public";
      page?: number;
      quote?: string;
      url?: string;
      title?: string;
      snippet?: string;
    }>;
  }>;
  citations?: Array<{
    id: string;
    sourceType: "datasheet" | "public";
    page?: number;
    quote?: string;
    url?: string;
    title?: string;
    snippet?: string;
  }>;
  warnings?: string[];
  usedSources?: string[];
  sourceAttribution?: {
    mode: "llm_first" | "llm_first_with_odl" | "failed";
  };
}) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      claims: [],
      citations: [],
      warnings: [],
      usedSources: ["datasheet"],
      messageId: "followup-1",
      createdAt: "2026-03-30T08:00:00.000Z",
      sourceAttribution: { mode: "llm_first" },
      ...payload
    })
  });
}

function queueLongProcessingResponses(processingCount: number, finalResult?: {
  status: "complete" | "partial" | "failed";
  warnings: string[];
  analysis?: AnalysisResult;
}) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      jobId: "job-1",
      status: "processing",
      warnings: [],
      followUpMessages: []
    })
  });

  for (let index = 0; index < processingCount; index += 1) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobId: "job-1",
        status: "processing",
        warnings: []
      })
    });
  }

  if (finalResult) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
        json: async () => ({
          jobId: "job-1",
          followUpMessages: [],
          ...finalResult
        })
      });
  }
}

function buildProcessingSnapshot(overrides?: Partial<AnalysisJobSnapshot>): AnalysisJobSnapshot {
  return {
    jobId: "job-1",
    status: "processing",
    warnings: [],
    followUpMessages: [],
    updatedAt: "2026-03-30T08:00:00.000Z",
    ...overrides
  };
}

describe("Workspace", () => {
  test("shows the signed-in user and can log out from the rail", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true })
    });

    render(<Workspace currentUser={{ username: "tester", displayName: "Test User" }} />);

    expect(await screen.findByText("T")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
  });

  test("waits for logout to finish before redirecting to login", async () => {
    let resolveLogout: ((value: { ok: true; json: () => Promise<{ ok: true }> }) => void) | null = null;
    const logoutPromise = new Promise<{ ok: true; json: () => Promise<{ ok: true }> }>((resolve) => {
      resolveLogout = resolve;
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    fetchMock.mockImplementationOnce(() => logoutPromise);

    render(<Workspace currentUser={{ username: "tester", displayName: "Test User" }} />);

    expect(await screen.findByRole("button", { name: "退出登录" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(replaceStateMock).not.toHaveBeenCalledWith(null, "", "/login");

    resolveLogout?.({
      ok: true,
      json: async () => ({ ok: true })
    });

    await waitFor(() => {
      expect(replaceStateMock).toHaveBeenCalledWith(null, "", "/login");
    });
  });

  test("shows a datasheet workspace empty state with no fake history before a pdf is uploaded", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: []
      })
    });

    render(<Workspace />);

    expect(screen.getByRole("heading", { name: "任务" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "对话区" })).toBeInTheDocument();
    expect(screen.getByText("最近任务")).toBeInTheDocument();
    expect(screen.queryByText("LMR51430")).not.toBeInTheDocument();
    expect(screen.queryByText("TPS54302")).not.toBeInTheDocument();
    expect(await screen.findByText("支持单个 datasheet PDF")).toBeInTheDocument();
    expect(screen.getByText("上传一份 PDF -> 开始分析 -> 获得 summary / key parameters / follow-up")).toBeInTheDocument();
    expect(screen.getByText("会先生成总结和关键参数")).toBeInTheDocument();
    expect(screen.getByText("每条重要结果都可回查")).toBeInTheDocument();
    expect(screen.getByText("你可以确认/修正后再导出")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上传 PDF 并分析" })).toBeInTheDocument();
    expect(screen.queryByLabelText("继续提问")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("上传一份 datasheet 后，这里会依次给出 summary、风险待确认项、关键参数、导出和 follow-up。").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("还没有最近任务，上传第一份 datasheet 开始。")).toBeInTheDocument();
  });

  test("rejects a non-pdf upload before calling the analysis api", async () => {
    render(<Workspace />);

    const file = new File(["not pdf"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("请上传 PDF 格式的数据手册。")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) => call[0] === "/api/analysis" && (call[1] as { method?: string } | undefined)?.method === "POST")
    ).toBe(false);
  });

  test("rejects an empty pdf upload before calling the analysis api", async () => {
    render(<Workspace />);

    const file = new File([], "empty.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("上传的 PDF 为空，请重新选择文件。")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) => call[0] === "/api/analysis" && (call[1] as { method?: string } | undefined)?.method === "POST")
    ).toBe(false);
  });

  test("renders the result inside the right dialog column and updates the evidence canvas after upload", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        pipelineMode: "staged",
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        report: {
          executiveSummary: "这是最终报告。",
          deviceIdentity: {
            canonicalPartNumber: "LMR51430",
            manufacturer: "Texas Instruments",
            deviceClass: "DC-DC",
            parameterTemplateId: "dc-dc",
            confidence: 0.92
          },
          keyParameters: [
            {
              id: "claim-input",
              label: "Voltage - Input (Max)",
              value: "36 V",
              sourceType: "datasheet",
              citations: [
                {
                  id: "cite-input",
                  sourceType: "datasheet",
                  page: 1,
                  quote: "VIN operating range 4.5 V to 36 V"
                }
              ]
            }
          ],
          designFocus: [],
          risks: [],
          openQuestions: [],
          publicNotes: [],
          citations: [],
          sections: [
            {
              id: "device_identity",
              title: "器件身份",
              body: "LMR51430 是一颗 DC-DC 电源芯片。",
              sourceType: "review",
              citations: []
            },
            {
              id: "how_to_read_this_datasheet",
              title: "怎么读这份 Datasheet",
              body: "先看首页、特性列表和工作条件，再看电气特性与布局建议。",
              sourceType: "review",
              citations: []
            },
            {
              id: "intern_action_list",
              title: "实习生下一步动作",
              body: "回查输入范围、输出电流和封装散热相关原文。",
              sourceType: "review",
              citations: []
            }
          ],
          claims: []
        },
        sourceAttribution: {
          mode: "llm_first_with_odl",
          llmProvider: "mock",
          llmTarget: "mock/gpt-4.1",
          searchProvider: "mock",
          documentPath: "pdf_direct",
          pipelineMode: "staged"
        },
        keyParameters: [
          { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" },
          { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }
        ],
        evidence: [
          {
            id: "ev-input",
            label: "输入电压范围",
            page: 1,
            quote: "VIN operating range 4.5 V to 36 V",
            rect: { left: 14, top: 18, width: 46, height: 10 }
          },
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    const input = screen.getByLabelText("上传数据手册 PDF");

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("Task Received")).toBeInTheDocument();
    expect(screen.getByText("Identity Ready")).toBeInTheDocument();
    expect(screen.getByText("Fast Parameters Ready")).toBeInTheDocument();
    expect(screen.getByText("Full Report Ready")).toBeInTheDocument();
    expect(screen.getByText("Reconciliation Ready")).toBeInTheDocument();
    expect(await screen.findByText("这是最终报告。")).toBeInTheDocument();
    expect(screen.getByText("器件身份")).toBeInTheDocument();
    expect(screen.getByText("怎么读这份 Datasheet")).toBeInTheDocument();
    expect(screen.getByText("实习生下一步动作")).toBeInTheDocument();
    expect(screen.getByText("风险与待确认项")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.queryByText("lmr51430 datasheet 初步分析")).not.toBeInTheDocument();
    expect(screen.getAllByText("关键参数表").length).toBeGreaterThan(0);
    expect(screen.getByText("Datasheet")).toBeInTheDocument();
    expect(screen.getAllByText("输入电压").length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "快速总结" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下载报告 Word" })).not.toBeInTheDocument();
    expect(screen.getByText("运行路径：mock/gpt-4.1 · PDF direct · staged")).toBeInTheDocument();
    expect(screen.queryByText("运行路径：未记录模型 · 路径未知 · unknown")).not.toBeInTheDocument();

    const riskBlock = screen.getByText("风险与待确认项").closest(".dialog-message-block");
    const parameterBlock = screen.getAllByText("关键参数表")
      .map((node) => node.closest(".dialog-message-block"))
      .find((node) => node !== null) ?? null;
    expect(riskBlock).not.toBeNull();
    expect(parameterBlock).not.toBeNull();
    expect(
      (riskBlock as HTMLElement).compareDocumentPosition(parameterBlock as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const packageLabel = screen.getAllByText("封装").find((node) => node.closest(".dialog-parameter-row"));
    const packageRow = packageLabel?.closest(".dialog-parameter-row");
    expect(packageRow).not.toBeNull();
    fireEvent.click(within(packageRow as HTMLElement).getByRole("button", { name: "定位到证据" }));

    expect(screen.getByTitle("PDF 预览")).toHaveAttribute("src", "/api/analysis/file?jobId=job-1#page=4");
  });

  test("shows fast-parameter middle state without summary, export, or follow-up", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "partial",
      warnings: ["参数初稿已生成，完整报告仍在整理。"],
      analysis: {
        summary: "",
        review: "",
        report: null,
        keyParameters: [
          {
            name: "Input voltage",
            value: "4.5V to 36V",
            evidenceId: "ev-input",
            status: "needs_review",
            provenance: {
              extractedBy: "gpt4o_fast_pass",
              confidence: "review",
              confidenceReason: "来自 4o 快参数初稿，等待完整报告复核。",
              sourcePages: [1],
              sourceQuote: "Input voltage 4.5V to 36V"
            }
          }
        ],
        evidence: [
          {
            id: "ev-input",
            label: "Input voltage",
            page: 1,
            quote: "Input voltage 4.5V to 36V",
            rect: { left: 12, top: 18, width: 30, height: 8 }
          }
        ],
        identity: {
          canonicalPartNumber: "LMR51430",
          manufacturer: "Texas Instruments",
          deviceClass: "Power",
          parameterTemplateId: "power",
          focusChecklist: ["Input voltage"],
          publicContext: [],
          confidence: 0.92
        },
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
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("参数初稿已生成，完整报告仍在整理。")).toBeInTheDocument();
    expect(screen.getAllByText("输入电压").length).toBeGreaterThan(0);
    expect(screen.queryByText("Summary")).not.toBeInTheDocument();
    expect(screen.queryByText("最终报告")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导出已确认参数 CSV" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("继续提问")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "总结这份数据手册" })).not.toBeInTheDocument();
  });

  test("single pipeline complete state does not render staged task labels", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        pipelineMode: "single",
        summary: "LMR51430 单模型报告已生成。",
        review: "建议优先检查输入范围。",
        report: {
          executiveSummary: "这是一颗 36 V 输入降压芯片。",
          deviceIdentity: {
            canonicalPartNumber: "LMR51430",
            manufacturer: "Texas Instruments",
            deviceClass: "DC-DC",
            parameterTemplateId: "dc-dc",
            confidence: 0.92
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
        keyParameters: [],
        evidence: [],
        identity: {
          canonicalPartNumber: "LMR51430",
          manufacturer: "Texas Instruments",
          deviceClass: "Power",
          parameterTemplateId: "power",
          focusChecklist: ["Input voltage"],
          publicContext: [],
          confidence: 0.92
        },
        parameterReconciliation: null,
        fastParametersReadyAt: null,
        fullReportReadyAt: "2026-03-30T08:03:00.000Z",
        sourceAttribution: {
          mode: "llm_first"
        }
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("这是一颗 36 V 输入降压芯片。")).toBeInTheDocument();
    expect(screen.queryByText("Fast Parameters Ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Reconciliation Ready")).not.toBeInTheDocument();
    expect(screen.getByText("Intelligent Analysis")).toBeInTheDocument();
    expect(screen.getByText("Result Ready")).toBeInTheDocument();
  });

  test("updates page count and fast parameters while the job is still processing", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        buildProcessingSnapshot({
          documentMeta: {
            fileName: "upf5755.pdf",
            taskName: "UPF5755 初步分析",
            chipName: "UPF5755",
            pageCount: 7
          },
          pdfUrl: "/api/analysis/file?jobId=job-1"
        })
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        buildProcessingSnapshot({
          warnings: ["参数初稿已生成，完整报告仍在整理。"],
          documentMeta: {
            fileName: "upf5755.pdf",
            taskName: "UPF5755 初步分析",
            chipName: "UPF5755",
            pageCount: 7
          },
          analysis: {
            summary: "",
            review: "",
            report: null,
            keyParameters: [
              {
                name: "Input voltage",
                value: "4.75 to 5.25 V",
                evidenceId: "ev-vcc",
                status: "needs_review",
                provenance: {
                  extractedBy: "gpt4o_fast_pass",
                  confidence: "review",
                  confidenceReason: "来自 4o 快参数初稿，完整报告仍在整理。",
                  sourcePages: [2],
                  sourceQuote: "Supply voltage VCC 4.75 5.0 5.25 V"
                }
              }
            ],
            evidence: [
              {
                id: "ev-vcc",
                label: "Supply voltage",
                page: 2,
                quote: "Supply voltage VCC 4.75 5.0 5.25 V",
                rect: { left: 12, top: 18, width: 30, height: 8 }
              }
            ],
            identity: {
              canonicalPartNumber: "UPF5755",
              manufacturer: "UPMicro",
              deviceClass: "Wi-Fi Front End Module (FEM)",
              parameterTemplateId: "generic-fallback",
              focusChecklist: ["Input voltage"],
              publicContext: [],
              confidence: 0.82
            },
            parameterReconciliation: {
              fastPassCompleted: true,
              fullReportCompleted: false,
              conflictCount: 0,
              conflicts: [],
              arbitrationNotes: [],
              missingFromFastPass: [],
              missingFromReportPass: []
            },
            fastParametersReadyAt: "2026-03-30T08:01:00.000Z",
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
            },
            sourceAttribution: {
              mode: "llm_first"
            }
          }
        })
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        buildProcessingSnapshot({
          warnings: ["参数初稿已生成，完整报告仍在整理。"],
          documentMeta: {
            fileName: "upf5755.pdf",
            taskName: "UPF5755 初步分析",
            chipName: "UPF5755",
            pageCount: 7
          },
          analysis: {
            summary: "",
            review: "",
            report: null,
            keyParameters: [
              {
                name: "Input voltage",
                value: "4.75 to 5.25 V",
                evidenceId: "ev-vcc",
                status: "needs_review"
              }
            ],
            evidence: [
              {
                id: "ev-vcc",
                label: "Supply voltage",
                page: 2,
                quote: "Supply voltage VCC 4.75 5.0 5.25 V",
                rect: { left: 12, top: 18, width: 30, height: 8 }
              }
            ],
            parameterReconciliation: {
              fastPassCompleted: true,
              fullReportCompleted: false,
              conflictCount: 0,
              conflicts: [],
              arbitrationNotes: [],
              missingFromFastPass: [],
              missingFromReportPass: []
            },
            fastParametersReadyAt: "2026-03-30T08:01:00.000Z",
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
        })
    });

    render(<Workspace pollIntervalMs={1} maxPollAttempts={2} />);

    const file = new File(["pdf"], "upf5755.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("参数初稿已生成，完整报告仍在整理。")).toBeInTheDocument();
    expect(screen.getAllByText("输入电压").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4.75 to 5.25 V").length).toBeGreaterThan(0);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("第 1 页 / 1")).not.toBeInTheDocument();
  });

  test("renders explicit summary citations and separates evidence-backed risks from review-only judgments", async () => {
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        report: {
          executiveSummary: "这是一颗 36 V 输入降压芯片，适合中低功率电源轨。",
          deviceIdentity: {
            canonicalPartNumber: "LMR51430",
            manufacturer: "Texas Instruments",
            deviceClass: "DC-DC",
            parameterTemplateId: "dc-dc",
            confidence: 0.92
          },
          keyParameters: [],
          designFocus: [],
          risks: [
            {
              id: "risk-datasheet",
              label: "启动电压需要回查",
              body: "不同工作模式下启动条件可能不同，落地前应回查 Recommended Operating Conditions。",
              sourceType: "datasheet",
              citations: [
                {
                  id: "cite-summary-page",
                  sourceType: "datasheet",
                  page: 3,
                  quote: "Recommended Operating Conditions"
                }
              ]
            },
            {
              id: "risk-public",
              label: "生态信息需外部补充",
              body: "样片 availability 和 lead time 需要结合公开渠道再次确认。",
              sourceType: "public",
              citations: [
                {
                  id: "cite-public",
                  sourceType: "public",
                  url: "https://example.com/ti-lmr51430",
                  title: "TI product page",
                  snippet: "Inventory and lifecycle information."
                }
              ]
            }
          ],
          openQuestions: [
            {
              id: "open-review",
              label: "热设计边界",
              body: "需要结合实际板层和铜皮面积判断热余量，这一条属于分析判断，不是 datasheet 原文参数。",
              sourceType: "review",
              citations: []
            }
          ],
          publicNotes: [],
          citations: [
            {
              id: "cite-summary-root",
              sourceType: "datasheet",
              page: 2,
              quote: "4.5-V to 36-V, 3-A buck converter"
            }
          ],
          sections: [],
          claims: []
        },
        keyParameters: [],
        evidence: [
          {
            id: "ev-summary",
            label: "首页特性",
            page: 2,
            quote: "4.5-V to 36-V, 3-A buck converter",
            rect: { left: 14, top: 18, width: 46, height: 10 }
          },
          {
            id: "ev-risk",
            label: "Recommended Operating Conditions",
            page: 3,
            quote: "Recommended Operating Conditions",
            rect: { left: 18, top: 24, width: 44, height: 8 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("这是一颗 36 V 输入降压芯片，适合中低功率电源轨。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "P2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "P2" }));
    expect(screen.getByTitle("PDF 预览")).toHaveAttribute("src", "/api/analysis/file?jobId=job-1#page=2");

    const evidenceGroup = screen.getByText("待回查原文").closest(".dialog-risk-group");
    const reviewGroup = screen.getByText("分析判断").closest(".dialog-risk-group");
    expect(evidenceGroup).not.toBeNull();
    expect(reviewGroup).not.toBeNull();
    expect(within(evidenceGroup as HTMLElement).getByText("启动电压需要回查")).toBeInTheDocument();
    expect(within(evidenceGroup as HTMLElement).getByRole("button", { name: "P3" })).toBeInTheDocument();
    expect(within(evidenceGroup as HTMLElement).getByText("Public")).toBeInTheDocument();
    fireEvent.click(within(evidenceGroup as HTMLElement).getByRole("button", { name: "TI product page" }));
    expect(openMock).toHaveBeenCalledWith("https://example.com/ti-lmr51430", "_blank", "noopener,noreferrer");

    expect(within(reviewGroup as HTMLElement).getByText("热设计边界")).toBeInTheDocument();
    expect(within(reviewGroup as HTMLElement).getByText("Review")).toBeInTheDocument();
    expect(within(reviewGroup as HTMLElement).queryByRole("button", { name: "P3" })).not.toBeInTheDocument();
  });

  test("defaults the pdf focus to the top review-needed evidence after analysis completes", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [
          { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" },
          { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }
        ],
        evidence: [
          {
            id: "ev-input",
            label: "输入电压范围",
            page: 1,
            quote: "VIN operating range 4.5 V to 36 V",
            rect: { left: 14, top: 18, width: 46, height: 10 }
          },
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("LMR51430 已完成真实解析。")).toBeInTheDocument();
    expect(screen.getByTitle("PDF 预览")).toHaveAttribute("src", "/api/analysis/file?jobId=job-1#page=4");
  });

  test("shows failed-state diagnostics when llm-first provider is unavailable", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "failed",
      warnings: ["未配置可用 LLM provider，当前系统已切换为 LLM-first，因而不会再退回本地抽取。"],
      analysis: {
        summary: "未配置可用 LLM provider，当前系统已切换为 LLM-first，因而不会再退回本地抽取。",
        review: "未配置可用 LLM provider，当前系统已切换为 LLM-first，因而不会再退回本地抽取。",
        identity: null,
        report: null,
        sourceAttribution: {
          mode: "failed"
        },
        keyParameters: [],
        evidence: []
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(
      (await screen.findAllByText("未配置可用 LLM provider，当前系统已切换为 LLM-first，因而不会再退回本地抽取。")).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("解析失败")).toBeInTheDocument();
    expect(screen.queryByText("关键参数表")).not.toBeInTheDocument();
  });

  test("moves the real pdf preview to the selected evidence page", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [
          { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" },
          { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }
        ],
        evidence: [
          {
            id: "ev-input",
            label: "输入电压范围",
            page: 1,
            quote: "VIN operating range 4.5 V to 36 V",
            rect: { left: 14, top: 18, width: 46, height: 10 }
          },
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect((await screen.findAllByRole("heading", { name: "LMR51430" })).length).toBeGreaterThan(0);
    const inputLabel = screen.getAllByText("输入电压").find((node) => node.closest(".dialog-parameter-row"));
    const inputRow = inputLabel?.closest(".dialog-parameter-row");
    expect(inputRow).not.toBeNull();
    fireEvent.click(within(inputRow as HTMLElement).getByRole("button", { name: "定位到证据" }));

    await waitFor(() => {
      expect(screen.getByTitle("PDF 预览")).toHaveAttribute("src", "/api/analysis/file?jobId=job-1#page=1");
    });
  });

  test("updates the preview total page count from analyzed document pages instead of the upload default", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "S55643-51Q 已完成真实解析。",
        review: "建议优先检查封装、RFFE 总线和输出功率。",
        keyParameters: [
          { name: "Document pages", value: "43", evidenceId: "ev-pages", status: "confirmed" },
          { name: "Package", value: "4.0 mm x 6.8 mm x 0.746 mm", evidenceId: "ev-package", status: "confirmed" }
        ],
        evidence: [
          {
            id: "ev-pages",
            label: "文档页数",
            page: 1,
            quote: "43 pages",
            rect: { left: 14, top: 18, width: 34, height: 8 }
          },
          {
            id: "ev-package",
            label: "封装",
            page: 1,
            quote: "4.0 mm x 6.8 mm x 0.746 mm Package Size",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    const { container } = render(<Workspace />);

    const file = new File(["pdf"], "S55643-51Q.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("S55643-51Q 已完成真实解析。")).toBeInTheDocument();
    const toolbar = container.querySelector(".canvas-toolbar");
    expect(toolbar?.textContent?.replace(/\s+/g, "")).toContain("第1页/43");
    expect(toolbar?.textContent?.replace(/\s+/g, "")).not.toContain("/26");
  });

  test("renders a coordinate-based evidence highlight over the pdf canvas", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [{ name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" }],
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
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect((await screen.findAllByRole("heading", { name: "LMR51430" })).length).toBeGreaterThan(0);

    const highlight = screen.getByTestId("evidence-highlight");
    expect(highlight).toHaveStyle({
      left: "14%",
      top: "18%",
      width: "46%",
      height: "10%"
    });
  });

  test("shows follow-up input only after the first analysis result is available", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [{ name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" }],
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
    });

    render(<Workspace />);

    expect(screen.queryByLabelText("继续提问")).not.toBeInTheDocument();

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByLabelText("继续提问")).toBeInTheDocument();
  });

  test("shows fixed datasheet prompt chips and promotes the top review item into the third prompt", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [
          { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" },
          { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }
        ],
        evidence: [
          {
            id: "ev-input",
            label: "输入电压范围",
            page: 1,
            quote: "VIN operating range 4.5 V to 36 V",
            rect: { left: 14, top: 18, width: 46, height: 10 }
          },
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByRole("button", { name: "总结这份数据手册" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "适用场景有哪些？" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "封装 这个参数需要重点确认什么？" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "主要功能和限制是什么？" })).not.toBeInTheDocument();
  });

  test("prioritizes review-needed parameters in both nav and parameter rows", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [
          { name: "Output current", value: "3 A", evidenceId: "ev-output", status: "user_corrected" },
          { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" },
          { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }
        ],
        evidence: [
          {
            id: "ev-output",
            label: "输出电流",
            page: 2,
            quote: "3 A output current",
            rect: { left: 14, top: 22, width: 44, height: 8 }
          },
          {
            id: "ev-input",
            label: "输入电压范围",
            page: 1,
            quote: "VIN operating range 4.5 V to 36 V",
            rect: { left: 14, top: 18, width: 46, height: 10 }
          },
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    await screen.findByText("LMR51430 已完成真实解析。");

    const navButtons = within(screen.getByText("参数导航").closest(".control-section") as HTMLElement).getAllByRole("button");
    expect(navButtons[0]).toHaveTextContent("封装");
    expect(navButtons[1]).toHaveTextContent("输入电压");
    expect(navButtons[2]).toHaveTextContent("输出电流");

    const parameterRows = Array.from(document.querySelectorAll(".dialog-parameter-row"))
      .filter((row) => row.querySelector(".dialog-parameter-actions"))
      .map((row) => row.textContent ?? "");
    expect(parameterRows[0]).toContain("封装");
    expect(parameterRows[1]).toContain("输入电压");
    expect(parameterRows[2]).toContain("输出电流");
  });

  test("shows a timeline thread before the final analysis appears", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueLongProcessingResponses(2);

    render(<Workspace pollIntervalMs={1} maxPollAttempts={2} />);

    const file = new File(["pdf"], "processing.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("Task Received")).toBeInTheDocument();
    expect(screen.getByText("Identity Ready")).toBeInTheDocument();
    expect(screen.getByText("Intelligent Analysis")).toBeInTheDocument();
    expect(screen.getByText("Result Ready")).toBeInTheDocument();
    expect(screen.getByText("正在识别器件类型与模板")).toBeInTheDocument();
    expect(screen.getByText("正在整理完整 datasheet 报告")).toBeInTheDocument();
    expect(screen.queryByText("LMR51430 已完成真实解析。")).not.toBeInTheDocument();
  });

  test("answers follow-up questions through the follow-up api instead of local canned grounding text", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [{ name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" }],
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
    });
    queueFollowUpResponse({
      answer: "优先看 Supported bands、Maximum Linear Output Power 和 RFFE bus，因为它们直接决定制式覆盖、线性能力和主控控制方式。",
      claims: [
        {
          id: "follow-bands",
          label: "Supported bands",
          value: "NR/LTE/3G",
          title: "Supported bands",
          body: "先看支持频段，先确认是否满足项目 band 需求。",
          sourceType: "datasheet",
          citations: [
            {
              id: "follow-cite-bands",
              sourceType: "datasheet",
              page: 2,
              quote: "Mode Bands NR ..."
            }
          ]
        }
      ],
      citations: [
        {
          id: "follow-cite-bands",
          sourceType: "datasheet",
          page: 2,
          quote: "Mode Bands NR ..."
        }
      ],
      usedSources: ["datasheet", "public"],
      warnings: []
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    const composer = await screen.findByLabelText("继续提问");
    fireEvent.change(composer, { target: { value: "这颗芯片最重要的限制条件是什么？" } });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));

    expect(await screen.findByText("这颗芯片最重要的限制条件是什么？")).toBeInTheDocument();
    expect(
      await screen.findByText("优先看 Supported bands、Maximum Linear Output Power 和 RFFE bus，因为它们直接决定制式覆盖、线性能力和主控控制方式。")
    ).toBeInTheDocument();
    expect(await screen.findByText("Supported bands")).toBeInTheDocument();
    expect(await screen.findByText("Datasheet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "P2" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analysis/follow-up",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(screen.getByText("Sources: Datasheet, Public")).toBeInTheDocument();
  });

  test("updates the url with jobId after the upload job is created", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "done",
        keyParameters: [],
        evidence: []
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    await screen.findByText("LMR51430 已完成真实解析。");
    expect(replaceStateMock).toHaveBeenCalledWith(null, "", "/?jobId=job-1");
  });

  test("hydrates an existing job from the url and restores transcript plus server pdf preview", async () => {
    window.history.pushState(null, "", "/?jobId=job-restore");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobId: "job-restore",
        status: "complete",
        warnings: [],
        documentMeta: {
          fileName: "S55643-51Q.pdf",
          taskName: "S55643-51Q 初步分析",
          chipName: "S55643-51Q"
        },
        pdfUrl: "/api/analysis/file?jobId=job-restore",
        followUpMessages: [
          {
            id: "follow-1",
            question: "这个器件最先看哪几个参数？",
            answer: "优先看支持频段、线性输出功率和控制接口。",
            claims: [
              {
                id: "follow-claim-1",
                label: "Supported bands",
                value: "NR/LTE/3G",
                sourceType: "datasheet",
                citations: [
                  {
                    id: "follow-cite-1",
                    sourceType: "datasheet",
                    page: 2,
                    quote: "Mode Bands NR ..."
                  }
                ]
              }
            ],
            citations: [
              {
                id: "follow-cite-1",
                sourceType: "datasheet",
                page: 2,
                quote: "Mode Bands NR ..."
              }
            ],
            warnings: ["当前为近似引用。"],
            usedSources: ["datasheet", "public"],
            sourceAttribution: {
              mode: "llm_first"
            },
            createdAt: "2026-03-30T08:00:00.000Z"
          }
        ],
        analysis: {
          summary: "S55643-51Q 已完成主报告。",
          review: "优先核对支持频段。",
          report: {
            executiveSummary: "S55643-51Q 是一颗蜂窝 PAM。",
            deviceIdentity: {
              canonicalPartNumber: "S55643-51Q",
              manufacturer: "Samsung",
              deviceClass: "Cellular PAM / PA",
              parameterTemplateId: "cellular-3g4g5g",
              confidence: 0.92
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
          keyParameters: [],
          evidence: []
        }
      })
    });

    render(<Workspace />);

    expect(await screen.findByText("S55643-51Q 是一颗蜂窝 PAM。")).toBeInTheDocument();
    expect(screen.getByText("这个器件最先看哪几个参数？")).toBeInTheDocument();
    expect(screen.getByText("优先看支持频段、线性输出功率和控制接口。")).toBeInTheDocument();
    expect(screen.getByText("当前为近似引用。")).toBeInTheDocument();
    expect(screen.getByText("Sources: Datasheet, Public")).toBeInTheDocument();
    expect(screen.getByTitle("PDF 预览")).toHaveAttribute("src", "/api/analysis/file?jobId=job-restore#page=1");
  });

  test("clears local correction messages when reopening another recent task", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobs: [
            {
              jobId: "job-recent-2",
              status: "complete",
              updatedAt: "2026-03-30T09:00:00.000Z",
              documentMeta: {
                fileName: "tps54302.pdf",
                taskName: "TPS54302 初步分析",
                chipName: "TPS54302"
              }
            }
          ]
        })
      });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [{ name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }],
        evidence: [
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        buildSnapshot({
          jobId: "job-1",
          status: "complete",
          warnings: [],
          analysis: {
            summary: "LMR51430 已完成真实解析。",
            review: "建议优先检查输入范围和封装散热。",
            keyParameters: [{ name: "Package", value: "SOT-23-THN-6", evidenceId: "ev-package", status: "user_corrected" }],
            evidence: [
              {
                id: "ev-package",
                label: "封装",
                page: 4,
                quote: "Package options SOT-23-THN",
                rect: { left: 18, top: 30, width: 42, height: 9 }
              }
            ],
            events: []
          }
        })
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        buildSnapshot({
          jobId: "job-recent-2",
          status: "complete",
          warnings: [],
          documentMeta: {
            fileName: "tps54302.pdf",
            taskName: "TPS54302 初步分析",
            chipName: "TPS54302",
            pageCount: 1
          },
          pdfUrl: "/api/analysis/file?jobId=job-recent-2",
          analysis: {
            summary: "TPS54302 已恢复结果。",
            review: "建议优先检查输入范围。",
            keyParameters: [],
            evidence: []
          }
        })
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("LMR51430 已完成真实解析。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "修改参数 Package" }));
    fireEvent.change(screen.getByLabelText("修改参数 Package"), { target: { value: "SOT-23-THN-6" } });
    fireEvent.click(screen.getByRole("button", { name: "保存参数 Package" }));

    expect(await screen.findByText("参数修正已记录，可作为后续经验样本。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "打开最近任务 TPS54302 初步分析" }));

    expect(await screen.findByText("TPS54302 已恢复结果。")).toBeInTheDocument();
    expect(screen.queryByText("参数修正已记录，可作为后续经验样本。")).not.toBeInTheDocument();
  });

  test("renders real recent tasks from snapshots and reopens a selected task", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobs: [
            {
              jobId: "job-recent-1",
              status: "complete",
              updatedAt: "2026-03-30T10:00:00.000Z",
              documentMeta: {
                fileName: "tps54302.pdf",
                taskName: "TPS54302 初步分析",
                chipName: "TPS54302",
                pageCount: 1
              }
            },
            {
              jobId: "job-recent-2",
              status: "partial",
              updatedAt: "2026-03-30T09:00:00.000Z",
              documentMeta: {
                fileName: "lmr51430.pdf",
                taskName: "LMR51430 初步分析",
                chipName: "LMR51430",
                pageCount: 1
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          buildSnapshot({
            jobId: "job-recent-2",
            status: "partial",
            warnings: ["仅提取到有限文本，以下结果适合初步分析，不适合直接下结论。"],
            documentMeta: {
              fileName: "lmr51430.pdf",
              taskName: "LMR51430 初步分析",
              chipName: "LMR51430",
              pageCount: 1
            },
            pdfUrl: "/api/analysis/file?jobId=job-recent-2",
            followUpMessages: [
              {
                id: "follow-restore-1",
                question: "主要限制是什么？",
                answer: "建议优先回查输入范围与封装热阻。",
                claims: [],
                citations: [],
                warnings: [],
                usedSources: ["datasheet"],
                createdAt: "2026-03-30T09:10:00.000Z"
              }
            ],
            analysis: {
              summary: "LMR51430 已恢复结果。",
              review: "建议优先检查输入范围和封装散热。",
              keyParameters: [
                { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }
              ],
              evidence: [
                {
                  id: "ev-package",
                  label: "封装",
                  page: 4,
                  quote: "Package options SOT-23-THN",
                  rect: { left: 18, top: 30, width: 42, height: 9 }
                }
              ]
            }
          })
      });

    render(<Workspace />);

    expect(await screen.findByRole("button", { name: "打开最近任务 TPS54302 初步分析" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开最近任务 LMR51430 初步分析" }));

    expect(await screen.findByText("仅提取到有限文本，以下结果适合初步分析，不适合直接下结论。")).toBeInTheDocument();
    expect(screen.queryByText("LMR51430 已恢复结果。")).not.toBeInTheDocument();
    expect(screen.getByText("主要限制是什么？")).toBeInTheDocument();
    expect(screen.getByText("建议优先回查输入范围与封装热阻。")).toBeInTheDocument();
    expect(screen.getByTitle("PDF 预览")).toHaveAttribute("src", "/api/analysis/file?jobId=job-recent-2#page=4");
  });

  test("continues polling when a processing job is restored from the url", async () => {
    window.history.pushState(null, "", "/?jobId=job-processing");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-processing",
          status: "processing",
          warnings: [],
          documentMeta: {
            fileName: "slow.pdf",
            taskName: "slow 初步分析",
            chipName: "slow",
            pageCount: 43
          },
          pdfUrl: "/api/analysis/file?jobId=job-processing",
          followUpMessages: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-processing",
          status: "complete",
          warnings: [],
          documentMeta: {
            fileName: "slow.pdf",
            taskName: "slow 初步分析",
            chipName: "slow",
            pageCount: 43
          },
          pdfUrl: "/api/analysis/file?jobId=job-processing",
          followUpMessages: [],
          analysis: {
            summary: "slow 已完成真实解析。",
            review: "done",
            keyParameters: [],
            evidence: []
          }
        })
      });

    render(<Workspace pollIntervalMs={1} maxPollAttempts={2} />);

    expect(await screen.findByText("slow 已完成真实解析。")).toBeInTheDocument();
    expect(screen.getByText("43")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("shows the restored processing job page count from snapshot document meta before analysis finishes", async () => {
    window.history.pushState(null, "", "/?jobId=job-processing");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-processing",
          status: "processing",
          warnings: [],
          documentMeta: {
            fileName: "slow.pdf",
            taskName: "slow 初步分析",
            chipName: "slow",
            pageCount: 43
          },
          pdfUrl: "/api/analysis/file?jobId=job-processing",
          followUpMessages: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-processing",
          status: "processing",
          warnings: [],
          documentMeta: {
            fileName: "slow.pdf",
            taskName: "slow 初步分析",
            chipName: "slow",
            pageCount: 43
          },
          pdfUrl: "/api/analysis/file?jobId=job-processing",
          followUpMessages: []
        })
      });

    const { container } = render(<Workspace pollIntervalMs={1} maxPollAttempts={1} />);

    expect(await screen.findByText("Intelligent Analysis")).toBeInTheDocument();
    const toolbar = container.querySelector(".canvas-toolbar");
    expect(toolbar?.textContent?.replace(/\s+/g, "")).toContain("第1页/43");
    expect(toolbar?.textContent?.replace(/\s+/g, "")).not.toContain("/1");
  });

  test("keeps the result-ready timeline step pending for partial results that have no displayable summary", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "partial",
      warnings: ["仅提取到有限文本，以下结果适合初步分析，不适合直接下结论。"],
      analysis: {
        summary: "",
        review: "",
        keyParameters: [],
        evidence: []
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "partial-empty.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("部分结果")).toBeInTheDocument();
    const resultReadyStep = screen.getByText("Result Ready").closest(".timeline-step");
    expect(resultReadyStep).not.toBeNull();
    expect(resultReadyStep).not.toHaveClass("is-done");
  });

  test("switches to stacked layout classes on narrow screens instead of leaving only the rail visible", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });

    render(<Workspace currentUser={{ username: "tester", displayName: "Atlas User" }} />);

    expect(await screen.findByText("支持单个 datasheet PDF")).toBeInTheDocument();
    expect(document.querySelector(".app-shell")).not.toBeNull();
    expect(document.querySelector(".rail-column")).not.toBeNull();
    expect(document.querySelector(".control-column")).not.toBeNull();
    expect(document.querySelector(".canvas-column")).not.toBeNull();
    expect(document.querySelector(".dialog-column")).not.toBeNull();
  });

  test("shows clearer recent task timing text and processing elapsed time", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jobs: [
          {
            jobId: "job-recent-1",
            status: "processing",
            updatedAt: "2026-03-30T17:09:00.000Z",
            documentMeta: {
              fileName: "processing.pdf",
              taskName: "processing 初步分析",
              chipName: "processing",
              pageCount: 8
            }
          }
        ]
      })
    });

    render(<Workspace />);

    expect(await screen.findByText(/更新于/)).toBeInTheDocument();
  });

  test("renders localized parameter labels while keeping review actions functional", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [
          { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" },
          { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }
        ],
        evidence: [
          {
            id: "ev-input",
            label: "输入电压范围",
            page: 1,
            quote: "VIN operating range 4.5 V to 36 V",
            rect: { left: 14, top: 18, width: 46, height: 10 }
          },
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect((await screen.findAllByRole("heading", { name: "LMR51430" })).length).toBeGreaterThan(0);

    expect(screen.getAllByText("输入电压").length).toBeGreaterThan(0);
    expect(screen.getAllByText("封装").length).toBeGreaterThan(0);
    expect(screen.queryByText("Input voltage")).not.toBeInTheDocument();
    expect(screen.queryByText("Package")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认参数 Package" })).toBeInTheDocument();
  });

  test("renders DigiKey-style RF parameter names inside the dialog column", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "SKY85755-11 已按 DigiKey 的 RF Front End (LNA + PA) 类别完成真实解析。",
        review: "建议优先确认 RF Type、Frequency、Features 和 Package / Case。",
        keyParameters: [
          { name: "RF Type", value: "WLAN", evidenceId: "ev-rf-type", status: "confirmed" },
          { name: "Frequency", value: "5 GHz", evidenceId: "ev-frequency", status: "confirmed" },
          {
            name: "Features",
            value: "Transmit gain: 32 dB; Receive gain: 14 dB",
            evidenceId: "ev-features",
            status: "confirmed"
          },
          { name: "Package / Case", value: "QFN 16-pin, 3 x 3 mm", evidenceId: "ev-package-case", status: "needs_review" }
        ],
        evidence: [
          {
            id: "ev-rf-type",
            label: "RF Type",
            page: 1,
            quote: "5 GHz WLAN Front-End Module",
            rect: { left: 12, top: 16, width: 42, height: 8 }
          },
          {
            id: "ev-frequency",
            label: "Frequency",
            page: 1,
            quote: "5 GHz WLAN Front-End Module",
            rect: { left: 14, top: 24, width: 42, height: 8 }
          },
          {
            id: "ev-features",
            label: "Features",
            page: 2,
            quote: "Transmit gain: 32 dB Receive gain: 14 dB",
            rect: { left: 18, top: 32, width: 48, height: 10 }
          },
          {
            id: "ev-package-case",
            label: "Package / Case",
            page: 4,
            quote: "QFN 16-pin, 3 x 3 mm",
            rect: { left: 20, top: 38, width: 40, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "tmp-SKY85755-11.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("SKY85755-11 已按 DigiKey 的 RF Front End (LNA + PA) 类别完成真实解析。")).toBeInTheDocument();
    expect(screen.getAllByText("RF Type").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Frequency").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Features").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Package / Case").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "确认参数 Package / Case" })).toBeInTheDocument();
    expect(screen.queryByText("输入电压")).not.toBeInTheDocument();
    expect(screen.queryByText("封装")).not.toBeInTheDocument();
  });

  test("flags low-confidence parameters for user review and allows confirmation", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [{ name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }],
        evidence: [
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect((await screen.findAllByRole("heading", { name: "LMR51430" })).length).toBeGreaterThan(0);

    expect(screen.getByText("待确认")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认参数 Package" }));

    expect(await screen.findByText("已确认")).toBeInTheDocument();
  });

  test("lets the user correct a low-confidence parameter and keeps the corrected value in chat", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [{ name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }],
        evidence: [
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect((await screen.findAllByRole("heading", { name: "LMR51430" })).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "修改参数 Package" }));
    fireEvent.change(screen.getByLabelText("修改参数 Package"), { target: { value: "SOT-23-THN-6" } });
    fireEvent.click(screen.getByRole("button", { name: "保存参数 Package" }));

    const packageLabel = screen.getAllByText("封装").find((node) => node.closest(".dialog-parameter-row"));
    const packageRow = packageLabel?.closest(".dialog-parameter-row");
    expect(packageRow).not.toBeNull();
    expect(await within(packageRow as HTMLElement).findByText("SOT-23-THN-6")).toBeInTheDocument();
    expect(screen.getByText("用户已修正")).toBeInTheDocument();
    expect(screen.getByText("参数修正已记录，可作为后续经验样本。")).toBeInTheDocument();
  });

  test("surfaces a failed confirm writeback and lets the user retry with the canonical snapshot", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [{ name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }],
        evidence: [
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: "job not found"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-1",
          status: "complete",
          warnings: [],
          analysis: {
            summary: "LMR51430 已完成真实解析。",
            review: "建议优先检查输入范围和封装散热。",
            keyParameters: [
              { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "confirmed" }
            ],
            evidence: [
              {
                id: "ev-package",
                label: "封装",
                page: 4,
                quote: "Package options SOT-23-THN",
                rect: { left: 18, top: 30, width: 42, height: 9 }
              }
            ],
            events: []
          }
        })
      });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect((await screen.findAllByRole("heading", { name: "LMR51430" })).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "确认参数 Package" }));

    expect(await screen.findByText("已确认")).toBeInTheDocument();
    expect(
      await screen.findByText("写回失败，当前改动仅保留在本地界面。请重试。")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试写回参数 Package" }));

    await waitFor(() => {
      expect(screen.queryByText("写回失败，当前改动仅保留在本地界面。请重试。")).not.toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("surfaces a failed edit writeback and retries without reopening the editor", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [{ name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }],
        evidence: [
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: "job not found"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-1",
          status: "complete",
          warnings: [],
          analysis: {
            summary: "LMR51430 已完成真实解析。",
            review: "建议优先检查输入范围和封装散热。",
            keyParameters: [
              { name: "Package", value: "SOT-23-THN-6", evidenceId: "ev-package", status: "user_corrected" }
            ],
            evidence: [
              {
                id: "ev-package",
                label: "封装",
                page: 4,
                quote: "Package options SOT-23-THN",
                rect: { left: 18, top: 30, width: 42, height: 9 }
              }
            ],
            events: []
          }
        })
      });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect((await screen.findAllByRole("heading", { name: "LMR51430" })).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "修改参数 Package" }));
    fireEvent.change(screen.getByLabelText("修改参数 Package"), { target: { value: "SOT-23-THN-6" } });
    fireEvent.click(screen.getByRole("button", { name: "保存参数 Package" }));

    const packageLabel = screen.getAllByText("封装").find((node) => node.closest(".dialog-parameter-row"));
    const packageRow = packageLabel?.closest(".dialog-parameter-row");
    expect(packageRow).not.toBeNull();
    expect(await within(packageRow as HTMLElement).findByText("SOT-23-THN-6")).toBeInTheDocument();
    expect(
      await screen.findByText("写回失败，当前改动仅保留在本地界面。请重试。")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("修改参数 Package")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重试写回参数 Package" }));

    await waitFor(() => {
      expect(screen.queryByText("写回失败，当前改动仅保留在本地界面。请重试。")).not.toBeInTheDocument();
    });
    expect(screen.getByText("用户已修正")).toBeInTheDocument();
  });

  test("shows partial-result messaging when the parser only extracts limited text", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "partial",
      warnings: ["仅提取到有限文本，以下结果适合初步分析，不适合直接下结论。"],
      analysis: {
        summary: "当前文档只提取到部分文本，先给出可验证的初步分析结果。",
        review: "建议优先确认标题页、特性列表和封装页。",
        keyParameters: [{ name: "Document pages", value: "1", evidenceId: "ev-pages", status: "confirmed" }],
        evidence: [
          {
            id: "ev-pages",
            label: "文档页数",
            page: 1,
            quote: "1 page",
            rect: { left: 12, top: 16, width: 26, height: 8 }
          }
        ],
        sourceAttribution: {
          mode: "llm_first",
          llmTarget: "custom/gpt-4.1",
          documentPath: "pdf_direct",
          pipelineMode: "staged"
        }
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "partial.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(
      await screen.findByText("仅提取到有限文本，以下结果适合初步分析，不适合直接下结论。")
    ).toBeInTheDocument();
    expect(screen.getByText("部分结果")).toBeInTheDocument();
    expect(screen.getByText("运行路径：custom/gpt-4.1 · PDF direct · staged（结果未完成）")).toBeInTheDocument();
    expect(
      screen.queryByText("当前文档只提取到部分文本，先给出可验证的初步分析结果。")
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "主要参数" })).not.toBeInTheDocument();
  });

  test("shows actionable text-layer guidance when analysis fails on a scanned pdf", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "failed",
      warnings: ["当前 PDF 未能提取到可用文本，请先上传带文本层的数据手册。"],
      analysis: {
        summary: "SCANNED 当前未能提取到可用文本。",
        review: "建议优先检查 PDF 是否为扫描件，或换一份带文本层的数据手册后重试。",
        keyParameters: [],
        evidence: [],
        sourceAttribution: {
          mode: "failed",
          llmTarget: "custom/gpt-4.1",
          documentPath: "unknown",
          pipelineMode: "single"
        }
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "scanned.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("解析失败")).toBeInTheDocument();
    expect(
      screen.getAllByText("当前 PDF 未能提取到可用文本，请先上传带文本层的数据手册。").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("运行路径：custom/gpt-4.1 · 路径未知 · single（诊断信息）")).toBeInTheDocument();
    expect(screen.getByText("SCANNED 当前未能提取到可用文本。")).toBeInTheDocument();
    expect(
      screen.getByText("建议优先检查 PDF 是否为扫描件，或换一份带文本层的数据手册后重试。")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("继续提问")).not.toBeInTheDocument();
  });

  test("surfaces export actions inside the task thread and records the exported artifact", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [
          { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" },
          { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }
        ],
        evidence: [
          {
            id: "ev-input",
            label: "输入电压范围",
            page: 1,
            quote: "VIN operating range 4.5 V to 36 V",
            rect: { left: 14, top: 18, width: 46, height: 10 }
          },
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("导出给下游继续使用")).toBeInTheDocument();
    expect(screen.getByText("CSV 只包含已确认或已修正的参数，避免把待确认值直接写入下游。")).toBeInTheDocument();
    expect(screen.getByText("已确认参数 1 个")).toBeInTheDocument();
    expect(screen.getByText("人工修正 0 次")).toBeInTheDocument();
    expect(screen.getByText("CSV 可导出")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出当前任务 JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出当前任务 HTML" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出已确认参数 CSV" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "导出已确认参数 CSV" }));

    expect(await screen.findByText("已导出 LMR51430-参数表.csv，可继续用于下游整理。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/audit",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  test("disables csv export until the user confirms at least one parameter", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议先确认封装信息。",
        keyParameters: [{ name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }],
        evidence: [
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByRole("button", { name: "导出已确认参数 CSV" })).toBeDisabled();
    expect(screen.getByText("先确认至少一个参数，再导出干净的参数表。")).toBeInTheDocument();
    expect(screen.getByText("已确认参数 0 个")).toBeInTheDocument();
    expect(screen.getByText("人工修正 0 次")).toBeInTheDocument();
    expect(screen.getByText("CSV 暂不可导出")).toBeInTheDocument();
  });

  test("updates export stats immediately after an edit action", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议先确认封装信息。",
        keyParameters: [
          { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" },
          { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }
        ],
        evidence: [
          {
            id: "ev-input",
            label: "输入电压范围",
            page: 1,
            quote: "VIN operating range 4.5 V to 36 V",
            rect: { left: 14, top: 18, width: 46, height: 10 }
          },
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () =>
        buildSnapshot({
          jobId: "job-1",
          status: "complete",
          warnings: [],
          analysis: {
            summary: "LMR51430 已完成真实解析。",
            review: "建议先确认封装信息。",
            keyParameters: [
              { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" },
              { name: "Package", value: "SOT-23-THN-6", evidenceId: "ev-package", status: "user_corrected" }
            ],
            evidence: [
              {
                id: "ev-input",
                label: "输入电压范围",
                page: 1,
                quote: "VIN operating range 4.5 V to 36 V",
                rect: { left: 14, top: 18, width: 46, height: 10 }
              },
              {
                id: "ev-package",
                label: "封装",
                page: 4,
                quote: "Package options SOT-23-THN",
                rect: { left: 18, top: 30, width: 42, height: 9 }
              }
            ],
            events: [
              {
                id: "evt-1",
                type: "parameter_corrected",
                summary: "Package corrected",
                createdAt: "2026-03-30T10:00:00.000Z",
                parameterName: "Package",
                evidenceId: "ev-package"
              }
            ]
          }
        })
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("已确认参数 1 个")).toBeInTheDocument();
    expect(screen.getByText("人工修正 0 次")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "修改参数 Package" }));
    fireEvent.change(screen.getByLabelText("修改参数 Package"), { target: { value: "SOT-23-THN-6" } });
    fireEvent.click(screen.getByRole("button", { name: "保存参数 Package" }));

    expect(await screen.findByText("已确认参数 2 个")).toBeInTheDocument();
    expect(screen.getByText("CSV 可导出")).toBeInTheDocument();
    expect(await screen.findByText("人工修正 1 次")).toBeInTheDocument();
    expect(screen.getByText("已确认参数 2 个")).toBeInTheDocument();
  });

  test("adds lightweight trust cues for review-needed parameters and evidence overlays", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueAnalysisJobResponses({
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [{ name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }],
        evidence: [
          {
            id: "ev-package",
            label: "封装",
            page: 4,
            quote: "Package options SOT-23-THN",
            rect: { left: 18, top: 30, width: 42, height: 9 }
          }
        ]
      }
    });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect((await screen.findAllByRole("heading", { name: "LMR51430" })).length).toBeGreaterThan(0);

    expect(screen.getByText("待确认")).toBeInTheDocument();
    expect(screen.getByText("建议回查原文后再确认或修改")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "定位到证据" }));

    expect(screen.queryByText("当前高亮用于快速定位，不代表像素级精确框。")).not.toBeInTheDocument();
  });

  test("polls the analysis job until a completed result is available", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobs: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-1",
          status: "processing",
          warnings: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-1",
          status: "processing",
          warnings: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-1",
          status: "complete",
          warnings: [],
          analysis: {
            summary: "LMR51430 已完成真实解析。",
            review: "建议优先检查输入范围和封装散热。",
            keyParameters: [{ name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" }],
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
      });

    render(<Workspace />);

    const file = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect((await screen.findAllByRole("heading", { name: "LMR51430" })).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("shows a delayed-job message instead of treating a slow analysis as a failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueLongProcessingResponses(2);

    render(<Workspace pollIntervalMs={1} maxPollAttempts={2} />);

    const file = new File(["pdf"], "slow.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("Intelligent Analysis")).toBeInTheDocument();
    expect(
      await screen.findByText("解析时间比预期更长，但任务还在后台继续。你不需要重传 PDF，可以继续等待当前任务。")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "继续等待当前任务" })).toBeInTheDocument();
    expect(screen.queryByText("解析失败")).not.toBeInTheDocument();
  });

  test("keeps already-earned processing progress visible when a slow job becomes delayed", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-1",
          status: "processing",
          warnings: [],
          followUpMessages: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          buildProcessingSnapshot({
            analysis: {
              summary: "",
              review: "",
              sourceAttribution: {
                mode: "llm_first",
                llmTarget: "custom/gpt-4.1",
                documentPath: "pdf_direct",
                pipelineMode: "staged"
              },
              keyParameters: [
                { name: "Document pages", value: "7", evidenceId: "ev-pages", status: "confirmed" }
              ],
              evidence: [
                {
                  id: "ev-pages",
                  label: "文档页数",
                  page: 1,
                  quote: "7 pages",
                  rect: { left: 12, top: 16, width: 26, height: 8 }
                }
              ]
            }
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          buildProcessingSnapshot({
            analysis: {
              summary: "",
              review: "",
              sourceAttribution: {
                mode: "llm_first",
                llmTarget: "custom/gpt-4.1",
                documentPath: "pdf_direct",
                pipelineMode: "staged"
              },
              keyParameters: [
                { name: "Document pages", value: "7", evidenceId: "ev-pages", status: "confirmed" }
              ],
              evidence: [
                {
                  id: "ev-pages",
                  label: "文档页数",
                  page: 1,
                  quote: "7 pages",
                  rect: { left: 12, top: 16, width: 26, height: 8 }
                }
              ]
            }
          })
      });

    render(<Workspace pollIntervalMs={1} maxPollAttempts={2} />);

    const file = new File(["pdf"], "slow-progress.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(
      await screen.findByText("解析时间比预期更长，但任务还在后台继续。你不需要重传 PDF，可以继续等待当前任务。")
    ).toBeInTheDocument();
    expect(screen.getByText("已完成器件识别与模板选择")).toBeInTheDocument();
    expect(screen.getByText("已生成首批关键参数")).toBeInTheDocument();
  });

  test("lets the user resume waiting for a delayed analysis job without re-uploading the pdf", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueLongProcessingResponses(2, {
      status: "complete",
      warnings: [],
      analysis: {
        summary: "LMR51430 已完成真实解析。",
        review: "建议优先检查输入范围和封装散热。",
        keyParameters: [{ name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" }],
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
    });

    render(<Workspace pollIntervalMs={1} maxPollAttempts={2} />);

    const file = new File(["pdf"], "slow.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    fireEvent.click(await screen.findByRole("button", { name: "继续等待当前任务" }));

    expect(await screen.findByText("LMR51430 已完成真实解析。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  test("disables resume while delayed polling is already running and prevents concurrent resume calls", async () => {
    let resolveResumeFetch!: (value: {
      ok: boolean;
      json: () => Promise<{
        jobId: string;
        status: "complete";
        warnings: [];
        analysis: {
          summary: string;
          review: string;
          keyParameters: Array<{ name: string; value: string; evidenceId: string; status: "confirmed" }>;
          evidence: Array<{
            id: string;
            label: string;
            page: number;
            quote: string;
            rect: { left: number; top: number; width: number; height: number };
          }>;
        };
      }>;
    }) => void;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueLongProcessingResponses(2);
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveResumeFetch = resolve as typeof resolveResumeFetch;
        })
    );

    render(<Workspace pollIntervalMs={1} maxPollAttempts={2} />);

    const file = new File(["pdf"], "slow.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    const resumeButton = await screen.findByRole("button", { name: "继续等待当前任务" });

    fireEvent.click(resumeButton);
    expect(await screen.findByRole("button", { name: "继续等待中..." })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "继续等待中..." }));
    expect(fetchMock).toHaveBeenCalledTimes(5);

    resolveResumeFetch({
      ok: true,
      json: async () => ({
        jobId: "job-1",
        status: "complete",
        warnings: [],
        analysis: {
          summary: "LMR51430 已完成真实解析。",
          review: "建议优先检查输入范围和封装散热。",
          keyParameters: [
            { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input", status: "confirmed" }
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
    });

    expect(await screen.findByText("LMR51430 已完成真实解析。")).toBeInTheDocument();
  });

  test("shows a missing-job degraded state when resume polling can no longer find the backend job", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] })
    });
    queueLongProcessingResponses(2);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "job not found"
      })
    });

    render(<Workspace pollIntervalMs={1} maxPollAttempts={2} />);

    const file = new File(["pdf"], "slow.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    fireEvent.click(await screen.findByRole("button", { name: "继续等待当前任务" }));

    expect(
      (await screen.findAllByText("后台任务记录不存在，可能已被清理。请重新上传 PDF 发起新任务。")).length
    ).toBeGreaterThan(0);
  });

  test("ignores stale polling results from an older upload after a newer upload starts", async () => {
    let resolveFirstPoll!: (value: {
      ok: boolean;
      json: () => Promise<{
        jobId: string;
        status: "complete";
        warnings: [];
        analysis: {
          summary: string;
          review: string;
          keyParameters: Array<{ name: string; value: string; evidenceId: string; status: "confirmed" }>;
          evidence: Array<{
            id: string;
            label: string;
            page: number;
            quote: string;
            rect: { left: number; top: number; width: number; height: number };
          }>;
        };
      }>;
    }) => void;

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-1",
          status: "processing",
          warnings: []
        })
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstPoll = resolve as typeof resolveFirstPoll;
          })
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-2",
          status: "processing",
          warnings: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: "job-2",
          status: "complete",
          warnings: [],
          analysis: {
            summary: "TPS54302 已完成真实解析。",
            review: "第二次上传的结果。",
            keyParameters: [
              { name: "Input voltage", value: "4.5 V to 28 V", evidenceId: "ev-input-2", status: "confirmed" }
            ],
            evidence: [
              {
                id: "ev-input-2",
                label: "输入电压范围",
                page: 1,
                quote: "VIN operating range 4.5 V to 28 V",
                rect: { left: 14, top: 18, width: 46, height: 10 }
              }
            ]
          }
        })
      });

    render(<Workspace />);

    const firstFile = new File(["pdf"], "lmr51430-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [firstFile] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));
    expect(await screen.findByText("已接收文档 lmr51430-datasheet.pdf")).toBeInTheDocument();

    const secondFile = new File(["pdf"], "tps54302-datasheet.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("上传数据手册 PDF"), { target: { files: [secondFile] } });
    fireEvent.click(screen.getByRole("button", { name: "上传 PDF 并分析" }));

    expect(await screen.findByText("TPS54302 已完成真实解析。")).toBeInTheDocument();

    resolveFirstPoll({
      ok: true,
      json: async () => ({
        jobId: "job-1",
        status: "complete",
        warnings: [],
        analysis: {
          summary: "LMR51430 已完成真实解析。",
          review: "第一次上传的旧结果。",
          keyParameters: [
            { name: "Input voltage", value: "4.5 V to 36 V", evidenceId: "ev-input-1", status: "confirmed" }
          ],
          evidence: [
            {
              id: "ev-input-1",
              label: "输入电压范围",
              page: 1,
              quote: "VIN operating range 4.5 V to 36 V",
              rect: { left: 14, top: 18, width: 46, height: 10 }
            }
          ]
        }
      })
    });

    await waitFor(() => {
      expect(screen.getByText("TPS54302 已完成真实解析。")).toBeInTheDocument();
    });
    expect(screen.queryByText("第一次上传的旧结果。")).not.toBeInTheDocument();
  });
});
