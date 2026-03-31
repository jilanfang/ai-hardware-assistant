import { describe, expect, test, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";

import { generateAnalysis } from "@/lib/analysis";
import { analyzePdfBuffer } from "@/lib/server-analysis";
import type { LlmProvider, SearchProvider } from "@/lib/providers";
import type { ParameterDraft, ReportClaim, UploadedPdf } from "@/lib/types";

const uploadedPdf: UploadedPdf = {
  id: "pdf-1",
  taskName: "LMR51430 first pass",
  chipName: "LMR51430",
  fileName: "lmr51430-datasheet.pdf",
  pageCount: 26,
  objectUrl: "blob:pdf-1"
};

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ANALYSIS_PIPELINE_MODE;
});

function createLlmProvider(): LlmProvider {
  return {
    classifyIdentity: async ({ chipName, publicContext }) => ({
      canonicalPartNumber: chipName,
      manufacturer: chipName === "S55643-51Q" ? "Samsung" : "TestMaker",
      deviceClass: chipName === "S55643-51Q" ? "Cellular PAM / PA" : "Power",
      parameterTemplateId: chipName === "S55643-51Q" ? "cellular-3g4g5g" : "power",
      focusChecklist: ["首页", "Features", "Electrical Characteristics"],
      publicContext,
      confidence: 0.88
    }),
    synthesizeReport: async ({ chipName, identity, publicContext, preparation }) => ({
      executiveSummary: `${chipName} 已生成 LLM-first 教学式报告。`,
      deviceIdentity: {
        canonicalPartNumber: identity.canonicalPartNumber,
        manufacturer: identity.manufacturer,
        deviceClass: identity.deviceClass,
        parameterTemplateId: identity.parameterTemplateId,
        confidence: identity.confidence
      },
      keyParameters: [
        ...(preparation.localCandidates[0]
          ? [
              {
                id: "claim-local-1",
                label: preparation.localCandidates[0].name,
                value: preparation.localCandidates[0].value,
                sourceType: "datasheet" as const,
                citations: [
                  {
                    id: "cite-local-1",
                    sourceType: "datasheet" as const,
                    page: preparation.localCandidates[0].page,
                    quote: preparation.localCandidates[0].quote
                  }
                ]
              }
            ]
          : []),
        {
          id: "claim-review-1",
          label: "Reading priority",
          value: "先看首页、feature list 和电气特性表",
          sourceType: "review" as const,
          citations: []
        }
      ],
      designFocus: [],
      risks: [],
      openQuestions: [],
      publicNotes: publicContext.map((item, index) => ({
        id: `public-${index + 1}`,
        label: item.title,
        body: item.snippet,
        title: item.title,
        sourceType: "public" as const,
        citations: [
          {
            id: `public-citation-${index + 1}`,
            sourceType: "public" as const,
            url: item.url,
            title: item.title,
            snippet: item.snippet
          }
        ]
      })),
      citations: [],
      sections: [
        {
          id: "device_identity",
          title: "器件身份",
          body: `${identity.manufacturer} ${identity.canonicalPartNumber}`,
          sourceType: "review" as const,
          citations: []
        },
        {
          id: "how_to_read_this_datasheet",
          title: "怎么读这份 Datasheet",
          body: "先确认定位，再看限制条件、电气特性、控制接口、封装与布局。",
          sourceType: "review" as const,
          citations: []
        },
        {
          id: "intern_action_list",
          title: "实习生下一步动作",
          body: "先核对 test condition 与脚注，再确认封装和热设计。",
          sourceType: "review" as const,
          citations: []
        }
      ],
      claims: []
    }),
    answerFollowUp: async ({ question, report, publicContext, preparation }) => ({
      answer: `围绕“${question}”，请先回查 ${report.keyParameters[0]?.label ?? "主报告"}。`,
      claims: [...report.keyParameters.slice(0, 1), ...publicContext.slice(0, 1).map((item, index) => ({
        id: `follow-public-${index + 1}`,
        label: item.title,
        title: item.title,
        body: item.snippet,
        sourceType: "public" as const,
        citations: [
          {
            id: `follow-public-cite-${index + 1}`,
            sourceType: "public" as const,
            url: item.url,
            title: item.title,
            snippet: item.snippet
          }
        ]
      }))],
      citations: report.keyParameters.slice(0, 1).flatMap((claim) => claim.citations),
      usedSources: publicContext.length ? ["datasheet", "public"] : ["datasheet"],
      followUpWarnings: preparation.documentMeta.extractionMethod === "none" ? ["当前没有 ODL 精确证据。"] : [],
      sourceAttribution: {
        mode: preparation.documentMeta.extractionMethod === "opendataloader" ? "llm_first_with_odl" : "llm_first"
      }
    }),
    extractKeyParameters: async ({ preparation }) =>
      preparation.localCandidates[0]
        ? [
            {
              name: preparation.localCandidates[0].name,
              value: preparation.localCandidates[0].value,
              sourceType: "datasheet" as const,
              citations: [
                {
                  id: "fast-cite-local-1",
                  sourceType: "datasheet" as const,
                  page: preparation.localCandidates[0].page,
                  quote: preparation.localCandidates[0].quote
                }
              ],
              producer: "gpt-4o" as const
            }
          ]
        : []
  };
}

function createDualStageLlmProvider(options: {
  fastParameters?: ParameterDraft[];
  fullReportParameters?: ReportClaim[];
  arbitrationResult?: {
    recommendedValue: string;
    decision: "prefer_fast" | "prefer_report" | "keep_both_needs_review" | "insufficient_evidence";
    reason: string;
    reviewSourceLabel: string;
  } | null;
} = {}): LlmProvider {
  return {
    classifyIdentity: async ({ chipName, publicContext }) => ({
      canonicalPartNumber: chipName,
      manufacturer: "TestMaker",
      deviceClass: "Power",
      parameterTemplateId: "power",
      focusChecklist: ["首页", "Features", "Electrical Characteristics"],
      publicContext,
      confidence: 0.9
    }),
    extractKeyParameters: async () =>
      options.fastParameters ?? [
        {
          name: "Input voltage",
          value: "4.5V to 36V",
          sourceType: "datasheet",
          citations: [
            {
              id: "fast-vin-cite",
              sourceType: "datasheet",
              page: 1,
              quote: "Input voltage 4.5V to 36V"
            }
          ],
          producer: "gpt-4o"
        }
      ],
    synthesizeReport: async ({ identity }) => ({
      executiveSummary: `${identity.canonicalPartNumber} 完整报告已生成。`,
      deviceIdentity: {
        canonicalPartNumber: identity.canonicalPartNumber,
        manufacturer: identity.manufacturer,
        deviceClass: identity.deviceClass,
        parameterTemplateId: identity.parameterTemplateId,
        confidence: identity.confidence
      },
      keyParameters:
        options.fullReportParameters ?? [
          {
            id: "report-vin",
            label: "Input voltage",
            value: "4.5V to 36V",
            sourceType: "datasheet",
            citations: [
              {
                id: "report-vin-cite",
                sourceType: "datasheet",
                page: 1,
                quote: "Input voltage 4.5V to 36V"
              }
            ]
          }
        ],
      designFocus: [],
      risks: [],
      openQuestions: [],
      publicNotes: [],
      citations: [],
      sections: [],
      claims: []
    }),
    answerFollowUp: async ({ question }) => ({
      answer: `answer:${question}`,
      claims: [],
      citations: [],
      usedSources: ["datasheet"],
      followUpWarnings: [],
      sourceAttribution: {
        mode: "llm_first"
      }
    }),
    arbitrateParameterConflict: async ({ fieldName }) =>
      options.arbitrationResult
        ? {
            fieldName,
            ...options.arbitrationResult
          }
        : null
  };
}

const searchProvider: SearchProvider = {
  searchPartContext: async ({ sku }) =>
    sku
      ? [
          {
            id: "public-1",
            title: `${sku} public note`,
            url: `https://example.com/${encodeURIComponent(sku)}`,
            snippet: `${sku} public market context`,
            sourceType: "public"
          }
        ]
      : []
};

describe("generateAnalysis", () => {
  test("creates a deterministic first-pass analysis with evidence anchors", () => {
    const result = generateAnalysis(uploadedPdf);

    expect(result.summary).toContain("LMR51430");
    expect(result.review).toBeTruthy();
    expect(result.keyParameters).toHaveLength(4);
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ page: 1 }),
        expect.objectContaining({ page: 4 })
      ])
    );
  });

  test("recognizes the real UPF5755 sample and returns WLAN front-end specific copy", () => {
    const result = generateAnalysis({
      id: "pdf-upf",
      taskName: "UPF5755 first pass",
      chipName: "UPF5755",
      fileName: "case0-202307UPF5755 datasheet V1.2.pdf",
      pageCount: 7,
      objectUrl: "blob:upf"
    });

    expect(result.summary).toContain("UPF5755");
    expect(result.summary).toContain("5.15 to 5.85GHz");
  });

  test("recognizes the real SKY85755-11 sample and returns WLAN front-end specific copy", () => {
    const result = generateAnalysis({
      id: "pdf-sky",
      taskName: "SKY85755-11 first pass",
      chipName: "SKY85755-11",
      fileName: "case0-SKY85755-11_204471F.pdf",
      pageCount: 13,
      objectUrl: "blob:sky"
    });

    expect(result.summary).toContain("SKY85755-11");
    expect(result.summary).toContain("5 GHz WLAN Front-End Module");
  });
});

describe("analyzePdfBuffer", () => {
  test("fails directly when no llm provider is configured", async () => {
    const result = await analyzePdfBuffer({
      fileName: "empty.pdf",
      taskName: "Empty first pass",
      chipName: "Empty",
      buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
    });

    expect(result.status).toBe("failed");
    expect(result.analysis.sourceAttribution).toEqual(
      expect.objectContaining({
        mode: "failed",
        llmTarget: null,
        documentPath: "unknown",
        pipelineMode: "single"
      })
    );
    expect(result.warnings[0]).toContain("LLM provider");
  });

  test("returns a complete llm-first result without any local parser fallback", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "lmr51430-datasheet.pdf",
        taskName: "LMR51430 first pass",
        chipName: "LMR51430",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: createLlmProvider(),
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.sourceAttribution).toEqual(
      expect.objectContaining({
        mode: "llm_first",
        llmTarget: "custom/gpt-4.1",
        documentPath: "pdf_direct",
        pipelineMode: "single"
      })
    );
    expect(result.analysis.report?.publicNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "public"
        })
      ])
    );
    expect(result.analysis.evidence).toEqual([]);
  });

  test("uses odl as the only allowed local enhancement path", async () => {
    process.env.ANALYSIS_ENABLE_ODL = "true";

    const result = await analyzePdfBuffer(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q first pass",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: createLlmProvider(),
        searchProvider,
        opendataloaderExtractor: async () => ({
          text:
            "S55643-51Q Samsung AgiPAMTM NR MMMB PAM for NR/LTE/3G 52 MHz RFFE bus Maximum Linear Output Power (PC2) 31 dBm Table 1. Supported bands NR n1/2/3/5/7",
          pageTexts: [
            "S55643-51Q Samsung AgiPAMTM NR MMMB PAM for NR/LTE/3G",
            "52 MHz RFFE bus Maximum Linear Output Power (PC2) 31 dBm",
            "Table 1. Supported bands NR n1/2/3/5/7"
          ],
          pageCount: 26
        })
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.sourceAttribution).toEqual(
      expect.objectContaining({
        mode: "llm_first_with_odl"
      })
    );
    expect(result.analysis.preparationMeta).toEqual(
      expect.objectContaining({
        extractionMethod: "opendataloader",
        pageCount: 26
      })
    );
    expect(result.analysis.evidence.length).toBeGreaterThan(0);
    expect(result.analysis.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "RFFE bus"
        })
      ])
    );

    delete process.env.ANALYSIS_ENABLE_ODL;
  });

  test("does not fall back to pdfjs or system text when odl is unavailable", async () => {
    process.env.ANALYSIS_ENABLE_ODL = "true";

    const result = await analyzePdfBuffer(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q first pass",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: createLlmProvider(),
        searchProvider,
        opendataloaderExtractor: async () => {
          throw new Error("java not found");
        },
        pdfTextExtractor: async () => ({
          text: "legacy fallback should stay unused",
          pageTexts: ["legacy fallback should stay unused"],
          pageCount: 1
        }),
        systemTextExtractor: async () => "legacy fallback should stay unused"
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.sourceAttribution).toEqual(
      expect.objectContaining({
        mode: "llm_first"
      })
    );
    expect(result.analysis.preparationMeta).toEqual(
      expect.objectContaining({
        extractionMethod: "none",
        pageCount: 1
      })
    );
    expect(result.analysis.evidence).toEqual([]);

    delete process.env.ANALYSIS_ENABLE_ODL;
  });

  test("still records real page count when odl is disabled but the pdf page reader succeeds", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "UPF5337.pdf",
        taskName: "UPF5337 first pass",
        chipName: "UPF5337",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: createLlmProvider(),
        searchProvider,
        pdfTextExtractor: async () => ({
          text: "ignored",
          pageTexts: ["ignored"],
          pageCount: 12
        })
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.preparationMeta).toEqual(
      expect.objectContaining({
        extractionMethod: "none",
        pageCount: 12
      })
    );
  });

  test("emits observability logs for the main analysis pipeline", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await analyzePdfBuffer(
      {
        fileName: "observe.pdf",
        taskName: "observe first pass",
        chipName: "observe",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: createLlmProvider(),
        searchProvider,
        pdfTextExtractor: async () => ({
          text: "observe sample",
          pageTexts: ["observe sample"],
          pageCount: 3
        })
      }
    );

    expect(result.status).toBe("complete");
    const lines = infoSpy.mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => line.includes("analysis.pipeline.started"))).toBe(true);
    expect(lines.some((line) => line.includes('"llmTarget":"custom/gpt-4.1"'))).toBe(true);
    expect(lines.some((line) => line.includes('"documentPath":"unknown"'))).toBe(true);
    expect(lines.some((line) => line.includes("analysis.preparation.completed"))).toBe(true);
    expect(lines.some((line) => line.includes("analysis.stage.completed"))).toBe(true);
    expect(lines.some((line) => line.includes("analysis.pipeline.completed"))).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("emits runtime attribution fields on staged partial observability logs", async () => {
    process.env.ANALYSIS_PIPELINE_MODE = "staged";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const result = await analyzePdfBuffer(
      {
        fileName: "observe-partial.pdf",
        taskName: "observe partial first pass",
        chipName: "observe-partial",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: {
          ...createDualStageLlmProvider(),
          synthesizeReport: async () =>
            new Promise(() => {
              return undefined;
            })
        },
        searchProvider,
        llmTimeoutMs: 1
      }
    );

    expect(result.status).toBe("partial");
    const lines = infoSpy.mock.calls.map((call) => String(call[0]));
    const partialLine = lines.find((line) => line.includes("analysis.pipeline.partial"));
    expect(partialLine).toBeDefined();
    expect(partialLine).toContain('"stage":"synthesize_report"');
    expect(partialLine).toContain('"llmTarget":"custom/gpt-4.1"');
    expect(partialLine).toContain('"documentPath":"pdf_direct"');
    expect(partialLine).toContain('"pipelineMode":"staged"');
  });

  test("fails instead of hanging forever when llm classification times out", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "timeout.pdf",
        taskName: "timeout first pass",
        chipName: "timeout",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: {
          classifyIdentity: () => new Promise(() => undefined),
          synthesizeReport: async () => {
            throw new Error("should not run");
          },
          answerFollowUp: async () => {
            throw new Error("should not run");
          }
        },
        searchProvider,
        pdfTextExtractor: async () => ({
          text: "timeout sample",
          pageTexts: ["timeout sample"],
          pageCount: 7
        })
      }
    );

    expect(result.status).toBe("failed");
    expect(result.warnings[0]).toContain("超时");
    expect(result.analysis.preparationMeta).toEqual(
      expect.objectContaining({
        pageCount: 7
      })
    );
  }, 95_000);

  test("supports a real datasheet sample through llm-first smoke path", async () => {
    const pdfBytes = new Uint8Array(readFileSync("/Users/jilanfang/Datasheet/S55643-51Q.pdf"));

    const result = await analyzePdfBuffer(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: pdfBytes
      },
      {
        llmProvider: createLlmProvider(),
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.identity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "S55643-51Q"
      })
    );
    expect(result.analysis.report?.executiveSummary).toContain("S55643-51Q");
  });

  test("reconciles final identity from report.deviceIdentity instead of stale classified identity", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "202307UPF5755 datasheet V1.2.pdf",
        taskName: "UPF5755 回归",
        chipName: "UPF5755",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: {
          classifyIdentity: async ({ publicContext }) => ({
            canonicalPartNumber: "UPF5755",
            manufacturer: "UPMicro",
            deviceClass: "Unknown",
            parameterTemplateId: "wifi",
            focusChecklist: ["首页", "Features"],
            publicContext,
            confidence: 0.82
          }),
          synthesizeReport: async ({ publicContext }) => ({
            executiveSummary: "UPF5755 已生成报告。",
            deviceIdentity: {
              canonicalPartNumber: "UPF5755",
              manufacturer: "UPMicro (昂璞微)",
              deviceClass: "Wi-Fi Front End Module (FEM)",
              parameterTemplateId: "wifi",
              confidence: 0.91
            },
            keyParameters: [],
            designFocus: [],
            risks: [],
            openQuestions: [],
            publicNotes: publicContext.map((item, index) => ({
              id: `public-${index + 1}`,
              label: item.title,
              value: "",
              title: item.title,
              body: item.snippet,
              sourceType: "public" as const,
              citations: []
            })),
            citations: [],
            sections: [
              {
                id: "device_identity",
                title: "器件身份",
                body: "UPMicro UPF5755 Wi-Fi Front End Module (FEM)",
                sourceType: "review" as const,
                citations: []
              }
            ],
            claims: []
          }),
          answerFollowUp: async ({ question }) => ({
            answer: `针对“${question}”的追问已生成。`,
            claims: [],
            citations: [],
            usedSources: ["datasheet"],
            followUpWarnings: [],
            sourceAttribution: {
              mode: "llm_first"
            }
          })
        },
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.identity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro (昂璞微)",
        deviceClass: "Wi-Fi Front End Module (FEM)",
        parameterTemplateId: "wifi"
      })
    );
    expect(result.analysis.report?.deviceIdentity.deviceClass).toBe("Wi-Fi Front End Module (FEM)");
    expect(result.analysis.identity?.deviceClass).toBe(result.analysis.report?.deviceIdentity.deviceClass);
    expect(result.analysis.identity?.manufacturer).toBe(result.analysis.report?.deviceIdentity.manufacturer);
  });

  test("reconciles external rf fem template ids back into internal wifi template ids", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "202307UPF5755 datasheet V1.2.pdf",
        taskName: "UPF5755 外部模板回归",
        chipName: "UPF5755",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: {
          classifyIdentity: async ({ publicContext }) => ({
            canonicalPartNumber: "UPF5755",
            manufacturer: "UPMicro",
            deviceClass: "Unknown",
            parameterTemplateId: "generic-fallback",
            focusChecklist: ["首页", "Features"],
            publicContext,
            confidence: 0.82
          }),
          synthesizeReport: async ({ identity }) => ({
            executiveSummary: "UPF5755 已生成报告。",
            deviceIdentity: {
              canonicalPartNumber: identity.canonicalPartNumber,
              manufacturer: "UPMicro (昂璞微)",
              deviceClass: "Wi-Fi Front End Module (FEM)",
              parameterTemplateId: "rf-fem-5ghz",
              confidence: 0.91
            },
            keyParameters: [],
            designFocus: [],
            risks: [],
            openQuestions: [],
            publicNotes: [],
            citations: [],
            sections: [],
            claims: []
          }),
          answerFollowUp: async ({ question }) => ({
            answer: `answer:${question}`,
            claims: [],
            citations: [],
            usedSources: ["review"],
            followUpWarnings: [],
            sourceAttribution: {
              mode: "llm_first"
            }
          })
        },
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.identity).toEqual(
      expect.objectContaining({
        parameterTemplateId: "wifi"
      })
    );
  });

  test("prefers wifi final template when report device class clearly describes a wifi 6 fem but report template drifts to cellular", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "202307UPF5755 datasheet V1.2.pdf",
        taskName: "UPF5755 模板防抖",
        chipName: "UPF5755",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: {
          classifyIdentity: async ({ publicContext }) => ({
            canonicalPartNumber: "UPF5755",
            manufacturer: "UPMicro",
            deviceClass: "Unknown",
            parameterTemplateId: "generic-fallback",
            focusChecklist: ["首页", "Features"],
            publicContext,
            confidence: 0.82
          }),
          synthesizeReport: async ({ identity }) => ({
            executiveSummary: "UPF5755 是一款 5GHz Wi-Fi 6 / 802.11ax 前端模组，支持 HE160 与 VHT80。",
            deviceIdentity: {
              canonicalPartNumber: identity.canonicalPartNumber,
              manufacturer: "UPMicro (昂璞微)",
              deviceClass: "5GHz Wi-Fi 6 Front-End Module (FEM)",
              parameterTemplateId: "cellular-3g4g5g",
              confidence: 0.91
            },
            keyParameters: [
              {
                id: "wifi-protocol",
                label: "RF Type",
                value: "802.11ax / Wi-Fi 6",
                sourceType: "datasheet",
                citations: [
                  {
                    id: "wifi-protocol-cite",
                    page: 1,
                    quote: "5GHz 802.11ax WiFi 6 Front End Module"
                  } as never
                ]
              },
              {
                id: "wifi-bw",
                label: "Bandwidth Capability",
                value: "HE160 / VHT80",
                sourceType: "review",
                citations: []
              }
            ],
            designFocus: [],
            risks: [],
            openQuestions: [],
            publicNotes: [],
            citations: [],
            sections: [],
            claims: []
          }),
          answerFollowUp: async ({ question }) => ({
            answer: `answer:${question}`,
            claims: [],
            citations: [],
            usedSources: ["review"],
            followUpWarnings: [],
            sourceAttribution: {
              mode: "llm_first"
            }
          })
        },
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.identity).toEqual(
      expect.objectContaining({
        deviceClass: "5GHz Wi-Fi 6 Front-End Module (FEM)",
        parameterTemplateId: "wifi"
      })
    );
  });

  test("returns a partial middle-state result after fast parameters are ready but before full report is ready", async () => {
    process.env.ANALYSIS_PIPELINE_MODE = "staged";
    const result = await analyzePdfBuffer(
      {
        fileName: "LMR51430.pdf",
        taskName: "LMR51430 first pass",
        chipName: "LMR51430",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: {
          ...createDualStageLlmProvider(),
          synthesizeReport: async () =>
            new Promise(() => {
              return undefined;
            })
        },
        searchProvider,
        llmTimeoutMs: 1
      }
    );

    expect(result.status).toBe("partial");
    expect(result.analysis.sourceAttribution).toEqual(
      expect.objectContaining({
        mode: "llm_first",
        llmTarget: "custom/gpt-4.1",
        documentPath: "pdf_direct",
        pipelineMode: "staged"
      })
    );
    expect(result.analysis.summary).toBe("");
    expect(result.analysis.report).toBeNull();
    expect(result.analysis.keyParameters).toEqual([
      expect.objectContaining({
        name: "Input voltage",
        status: "needs_review"
      })
    ]);
    expect(result.analysis.parameterReconciliation).toEqual(
      expect.objectContaining({
        fastPassCompleted: true,
        fullReportCompleted: false
      })
    );
  });

  test("preserves full runtime attribution on a completed staged result", async () => {
    process.env.ANALYSIS_PIPELINE_MODE = "staged";
    const result = await analyzePdfBuffer(
      {
        fileName: "LMR51430.pdf",
        taskName: "LMR51430 completed staged pass",
        chipName: "LMR51430",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: createDualStageLlmProvider(),
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.sourceAttribution).toEqual(
      expect.objectContaining({
        mode: "llm_first",
        llmProvider: "custom",
        llmTarget: "custom/gpt-4.1",
        searchProvider: "custom",
        documentPath: "pdf_direct",
        pipelineMode: "staged"
      })
    );
  });

  test("marks conflicting fast/report parameters as needs_review and records arbitration output", async () => {
    process.env.ANALYSIS_PIPELINE_MODE = "staged";
    const result = await analyzePdfBuffer(
      {
        fileName: "LMR51430.pdf",
        taskName: "LMR51430 first pass",
        chipName: "LMR51430",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: createDualStageLlmProvider({
          fastParameters: [
            {
              name: "Input voltage",
              value: "4.5V to 36V",
              sourceType: "datasheet",
              citations: [{ id: "fast-vin-cite", sourceType: "datasheet", page: 1, quote: "Input voltage 4.5V to 36V" }],
              producer: "gpt-4o"
            }
          ],
          fullReportParameters: [
            {
              id: "report-vin",
              label: "Input voltage",
              value: "5V to 36V",
              sourceType: "datasheet",
              citations: [{ id: "report-vin-cite", sourceType: "datasheet", page: 2, quote: "Input voltage 5V to 36V" }]
            }
          ],
          arbitrationResult: {
            recommendedValue: "5V to 36V",
            decision: "prefer_report",
            reason: "报告路径证据页更完整。",
            reviewSourceLabel: "DeepSeek Arbitration"
          }
        }),
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.keyParameters).toEqual([
      expect.objectContaining({
        name: "Input voltage",
        value: "5V to 36V",
        status: "needs_review",
        provenance: expect.objectContaining({
          extractedBy: "system_arbitrated"
        })
      })
    ]);
    expect(result.analysis.parameterReconciliation).toEqual(
      expect.objectContaining({
        conflictCount: 1,
        arbitrationNotes: [
          expect.objectContaining({
            fieldName: "Input voltage",
            decision: "prefer_report"
          })
        ]
      })
    );
  });

  test("single pipeline mode skips fast parameters and arbitration", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "LMR51430.pdf",
        taskName: "LMR51430 single pass",
        chipName: "LMR51430",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: {
          classifyIdentity: async ({ publicContext }) => ({
            canonicalPartNumber: "LMR51430",
            manufacturer: "Texas Instruments",
            deviceClass: "Power",
            parameterTemplateId: "power",
            focusChecklist: ["Input voltage"],
            publicContext,
            confidence: 0.9
          }),
          extractKeyParameters: async () => {
            throw new Error("single mode should not call extractKeyParameters");
          },
          arbitrateParameterConflict: async () => {
            throw new Error("single mode should not call arbitrateParameterConflict");
          },
          synthesizeReport: async ({ identity }) => ({
            executiveSummary: `${identity.canonicalPartNumber} 单模型报告已生成。`,
            deviceIdentity: {
              canonicalPartNumber: identity.canonicalPartNumber,
              manufacturer: identity.manufacturer,
              deviceClass: identity.deviceClass,
              parameterTemplateId: identity.parameterTemplateId,
              confidence: identity.confidence
            },
            keyParameters: [
              {
                id: "report-vin",
                label: "Input voltage",
                value: "4.5V to 36V",
                sourceType: "datasheet",
                citations: [
                  {
                    id: "report-vin-cite",
                    sourceType: "datasheet",
                    page: 1,
                    quote: "Input voltage 4.5V to 36V"
                  }
                ]
              }
            ],
            designFocus: [],
            risks: [],
            openQuestions: [],
            publicNotes: [],
            citations: [],
            sections: [],
            claims: []
          }),
          answerFollowUp: async ({ question }) => ({
            answer: `answer:${question}`,
            claims: [],
            citations: [],
            usedSources: ["datasheet"],
            followUpWarnings: [],
            sourceAttribution: {
              mode: "llm_first"
            }
          })
        },
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.summary).toContain("单模型报告已生成");
    expect(result.analysis.parameterReconciliation).toBeNull();
    expect(result.analysis.fastParametersReadyAt).toBeNull();
    expect(result.analysis.fullReportReadyAt).toEqual(expect.any(String));
    expect(result.analysis.keyParameters).toEqual([
      expect.objectContaining({
        name: "Input voltage",
        value: "4.5V to 36V"
      })
    ]);
  });

  test("keeps datasheet report parameters when citation sourceType is omitted but page evidence exists", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "SKY85755-11.pdf",
        taskName: "SKY85755-11 回归",
        chipName: "SKY85755-11",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: {
          classifyIdentity: async ({ publicContext }) => ({
            canonicalPartNumber: "SKY85755-11",
            manufacturer: "Skyworks Solutions, Inc.",
            deviceClass: "5 GHz WLAN Front-End Module (FEM)",
            parameterTemplateId: "wifi",
            focusChecklist: ["首页", "Features"],
            publicContext,
            confidence: 0.9
          }),
          extractKeyParameters: async () => [],
          synthesizeReport: async ({ identity }) => ({
            executiveSummary: "SKY85755-11 已生成报告。",
            deviceIdentity: {
              canonicalPartNumber: identity.canonicalPartNumber,
              manufacturer: identity.manufacturer,
              deviceClass: identity.deviceClass,
              parameterTemplateId: identity.parameterTemplateId,
              confidence: identity.confidence
            },
            keyParameters: [
              {
                id: "wifi-rf-type",
                label: "RF Type",
                value: "802.11ax (Wi-Fi 6)",
                sourceType: "datasheet",
                citations: [
                  {
                    id: "wifi-rf-type-cite",
                    page: 1,
                    quote: "802.11ax"
                  } as never
                ]
              }
            ],
            designFocus: [],
            risks: [],
            openQuestions: [],
            publicNotes: [],
            citations: [],
            sections: [],
            claims: []
          }),
          answerFollowUp: async ({ question }) => ({
            answer: `answer:${question}`,
            claims: [],
            citations: [],
            usedSources: ["datasheet"],
            followUpWarnings: [],
            sourceAttribution: {
              mode: "llm_first"
            }
          })
        },
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.report?.keyParameters).toHaveLength(1);
    expect(result.analysis.keyParameters).toEqual([
      expect.objectContaining({
        name: "RF Type",
        value: "802.11ax (Wi-Fi 6)"
      })
    ]);
  });

  test("keeps datasheet report parameters as needs_review when fast pass is empty and report citations have no usable page evidence", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "GD25Q128ESIGR.pdf",
        taskName: "GD25Q128ESIGR 回归",
        chipName: "GD25Q128E",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: {
          classifyIdentity: async ({ publicContext }) => ({
            canonicalPartNumber: "GD25Q128E",
            manufacturer: "GigaDevice",
            deviceClass: "Serial NOR Flash",
            parameterTemplateId: "serial-flash",
            focusChecklist: ["首页", "Features"],
            publicContext,
            confidence: 0.95
          }),
          extractKeyParameters: async () => [],
          synthesizeReport: async ({ identity }) => ({
            executiveSummary: "GD25Q128E 已生成报告。",
            deviceIdentity: {
              canonicalPartNumber: identity.canonicalPartNumber,
              manufacturer: identity.manufacturer,
              deviceClass: identity.deviceClass,
              parameterTemplateId: identity.parameterTemplateId,
              confidence: identity.confidence
            },
            keyParameters: [
              {
                id: "flash-density",
                label: "Memory Size / Density",
                value: "128M-bit (16M-Byte)",
                sourceType: "datasheet",
                citations: [
                  {
                    quote: "",
                    url: "",
                    title: "",
                    snippet: ""
                  } as never
                ]
              }
            ],
            designFocus: [],
            risks: [],
            openQuestions: [],
            publicNotes: [],
            citations: [],
            sections: [],
            claims: []
          }),
          answerFollowUp: async ({ question }) => ({
            answer: `answer:${question}`,
            claims: [],
            citations: [],
            usedSources: ["datasheet"],
            followUpWarnings: [],
            sourceAttribution: {
              mode: "llm_first"
            }
          })
        },
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.report?.keyParameters).toHaveLength(1);
    expect(result.analysis.keyParameters).toEqual([
      expect.objectContaining({
        name: "Memory Size / Density",
        value: "128M-bit (16M-Byte)",
        status: "needs_review",
        provenance: expect.objectContaining({
          extractedBy: "gemini_report_pass"
        })
      })
    ]);
  });

  test("keeps review-only report parameters when fast pass is empty and labels match serial-flash template fields", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "GD25Q128ESIGR.pdf",
        taskName: "GD25Q128ESIGR review-only 回归",
        chipName: "GD25Q128E",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: {
          classifyIdentity: async ({ publicContext }) => ({
            canonicalPartNumber: "GD25Q128E",
            manufacturer: "GigaDevice",
            deviceClass: "Serial NOR Flash",
            parameterTemplateId: "serial-flash",
            focusChecklist: ["首页", "Features"],
            publicContext,
            confidence: 0.95
          }),
          extractKeyParameters: async () => [],
          synthesizeReport: async ({ identity }) => ({
            executiveSummary: "GD25Q128E 已生成报告。",
            deviceIdentity: {
              canonicalPartNumber: identity.canonicalPartNumber,
              manufacturer: identity.manufacturer,
              deviceClass: identity.deviceClass,
              parameterTemplateId: identity.parameterTemplateId,
              confidence: identity.confidence
            },
            keyParameters: [
              {
                id: "flash-density-review",
                label: "Memory Size / Density",
                value: "128M-bit (16M-Byte)",
                sourceType: "review",
                citations: []
              },
              {
                id: "flash-clock-review",
                label: "Max Clock Frequency",
                value: "133MHz",
                sourceType: "review",
                citations: []
              },
              {
                id: "flash-risk-review",
                label: "Document Risk",
                value: "Spec may change",
                sourceType: "review",
                citations: []
              }
            ],
            designFocus: [],
            risks: [],
            openQuestions: [],
            publicNotes: [],
            citations: [],
            sections: [],
            claims: []
          }),
          answerFollowUp: async ({ question }) => ({
            answer: `answer:${question}`,
            claims: [],
            citations: [],
            usedSources: ["review"],
            followUpWarnings: [],
            sourceAttribution: {
              mode: "llm_first"
            }
          })
        },
        searchProvider
      }
    );

    expect(result.status).toBe("complete");
    expect(result.analysis.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Memory Size / Density",
          value: "128M-bit (16M-Byte)",
          status: "needs_review"
        }),
        expect.objectContaining({
          name: "Max Clock Frequency",
          value: "133MHz",
          status: "needs_review"
        })
      ])
    );
    expect(result.analysis.keyParameters).toHaveLength(2);
  });
});
