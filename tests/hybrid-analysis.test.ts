import { describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
  analyzePdfBuffer,
  classifyDocumentIdentity,
  prepareDocumentForAnalysis,
  synthesizeEvidenceReport
} from "@/lib/server-analysis";
import { getParameterTemplate } from "@/lib/parameter-templates";
import type { LlmProvider, SearchProvider } from "@/lib/providers";

const s55643Text = `S55643-51Q
Samsung
AgiPAMTM NR MMMB PAM for NR/LTE/3G
PRELIMINARY
Features
52 MHz RFFE bus
Maximum Linear Output Power (PC2) 31 dBm
Table 1. Supported bands
Mode Bands NR n1/2/3/5/7/8/20/28/38/40/41/66/71 LTE B1/2/3/4/5/7/8/12/13/14/17/18/19/20/21/25/26/28/30/32/34/38/39/40/41/42/43/48/66/68/71 WCDMA B1/2/4/5/8 CDMA2000 BC0/BC1/BC10 TD-SCDMA B34/39
Package Size 4.0 mm x 6.8 mm x 0.746 mm`;

const s55643Pages = [
  `Samsung
S55643-51Q
AgiPAMTM NR MMMB PAM for NR/LTE/3G
PRELIMINARY
Electrical Characteristics | Table 1
Supported Bands`,
  `Features
52 MHz RFFE bus
Maximum Linear Output Power (PC2) 31 dBm
Table 1. Supported bands
Mode Bands NR n1/2/3/5/7/8/20/28/38/40/41/66/71 LTE B1/2/3/4/5/7/8/12/13/14/17/18/19/20/21/25/26/28/30/32/34/38/39/40/41/42/43/48/66/68/71
WCDMA B1/2/4/5/8
CDMA2000 BC0/BC1/BC10
TD-SCDMA B34/39`,
  `Package Size 4.0 mm x 6.8 mm x 0.746 mm
PRELIMINARY
column-left    column-right
Table continues on next page`
];

function createMockProviders() {
  const searchProvider: SearchProvider = {
    searchPartContext: async () => [
      {
        id: "public-1",
        title: "Samsung S55643-51Q overview",
        url: "https://example.com/s55643-51q",
        snippet: "Samsung cellular PAM for NR/LTE/3G",
        sourceType: "public"
      }
    ]
  };

  const llmProvider: LlmProvider = {
    classifyIdentity: async () => ({
      canonicalPartNumber: "S55643-51Q",
      manufacturer: "Samsung",
      deviceClass: "Cellular PAM / PA",
      parameterTemplateId: "cellular-3g4g5g",
      focusChecklist: ["RFFE bus", "Maximum Linear Output Power", "Supported bands", "Package"],
      publicContext: [
        {
          id: "public-1",
          title: "Samsung S55643-51Q overview",
          url: "https://example.com/s55643-51q",
          snippet: "Samsung cellular PAM for NR/LTE/3G",
          sourceType: "public"
        }
      ],
      confidence: 0.94
    }),
    synthesizeReport: async () => ({
      executiveSummary: "S55643-51Q 是一颗面向 NR/LTE/3G 的蜂窝 PAM，当前证据足够支持第一轮器件归类。",
      deviceIdentity: {
        canonicalPartNumber: "S55643-51Q",
        manufacturer: "Samsung",
        deviceClass: "Cellular PAM / PA",
        parameterTemplateId: "cellular-3g4g5g",
        confidence: 0.94
      },
      keyParameters: [
        {
          id: "claim-rffe",
          label: "RFFE bus",
          value: "52 MHz",
          sourceType: "datasheet",
          citations: [
            {
              id: "cite-rffe",
              sourceType: "datasheet",
              page: 2,
              quote: "52 MHz RFFE bus"
            }
          ]
        },
        {
          id: "claim-power",
          label: "Maximum Linear Output Power",
          value: "31 dBm",
          sourceType: "datasheet",
          citations: [
            {
              id: "cite-power",
              sourceType: "datasheet",
              page: 2,
              quote: "Maximum Linear Output Power (PC2) 31 dBm"
            }
          ]
        },
        {
          id: "claim-public-conflict",
          label: "Maximum Linear Output Power",
          value: "32 dBm",
          sourceType: "public",
          citations: [
            {
              id: "cite-public-conflict",
              sourceType: "public",
              url: "https://example.com/s55643-51q",
              title: "Samsung S55643-51Q overview",
              snippet: "Marketing copy mentions 32 dBm"
            }
          ]
        },
        {
          id: "claim-uncited",
          label: "Uncited claim",
          value: "Should downgrade",
          sourceType: "datasheet",
          citations: []
        }
      ],
      designFocus: [
        {
          id: "focus-1",
          label: "Band coverage",
          title: "Band coverage",
          body: "优先核对 NR/LTE/WCDMA/CDMA2000/TD-SCDMA 支持范围。",
          sourceType: "datasheet",
          citations: [
            {
              id: "cite-bands",
              sourceType: "datasheet",
              page: 2,
              quote:
                "Mode Bands NR n1/2/3/5/7/8/20/28/38/40/41/66/71 LTE B1/2/3/4/5/7/8/12/13/14/17/18/19/20/21/25/26/28/30/32/34/38/39/40/41/42/43/48/66/68/71"
            }
          ]
        }
      ],
      risks: [
        {
          id: "risk-1",
          label: "Public conflict",
          title: "Public conflict",
          body: "公网资料出现 32 dBm 表述，但 datasheet 当前证据为 31 dBm，应以 datasheet 为准。",
          sourceType: "public",
          citations: [
            {
              id: "cite-risk-public",
              sourceType: "public",
              url: "https://example.com/s55643-51q",
              title: "Samsung S55643-51Q overview",
              snippet: "Marketing copy mentions 32 dBm"
            }
          ]
        }
      ],
      openQuestions: [],
      publicNotes: [
        {
          id: "public-note-1",
          label: "Public context",
          title: "Public context",
          body: "公网概述可辅助理解器件定位，但不能覆盖 datasheet 冲突事实。",
          sourceType: "public",
          citations: [
            {
              id: "cite-public-note",
              sourceType: "public",
              url: "https://example.com/s55643-51q",
              title: "Samsung S55643-51Q overview",
              snippet: "Samsung cellular PAM for NR/LTE/3G"
            }
          ]
        }
      ],
      citations: [],
      sections: [],
      claims: []
    }),
    answerFollowUp: async ({ question, report, publicContext, preparation }) => ({
      answer: `针对“${question}”，优先看 ${report.keyParameters.map((item) => item.label).join("、")}。`,
      claims: [...report.keyParameters, ...report.publicNotes],
      citations: [...report.keyParameters.flatMap((claim) => claim.citations), ...report.publicNotes.flatMap((claim) => claim.citations)],
      usedSources: publicContext.length ? ["datasheet", "public"] : ["datasheet"],
      followUpWarnings: preparation.documentMeta.extractionMethod === "none" ? ["当前为近似引用。"] : [],
      sourceAttribution: {
        mode: preparation.documentMeta.extractionMethod === "opendataloader" ? "llm_first_with_odl" : "llm_first"
      }
    })
  };

  return { llmProvider, searchProvider };
}

describe("hybrid pdf analysis pipeline", () => {
  test("returns an empty preparation when odl enhancement is disabled", async () => {
    const preparation = await prepareDocumentForAnalysis(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        pdfTextExtractor: async () => ({
          text: s55643Text,
          pageTexts: s55643Pages,
          pageCount: 26
        }),
        systemTextExtractor: async () => null
      }
    );

    expect(preparation.identityCandidates).toEqual(
      expect.objectContaining({
        sku: "S55643-51Q",
        manufacturer: null,
        documentTitle: null
      })
    );
    expect(preparation.documentMeta).toEqual(
      expect.objectContaining({
        pageCount: 26,
        extractionMethod: "none"
      })
    );
    expect(preparation.localCandidates).toEqual([]);
    expect(preparation.complexityFlags).toEqual(
      expect.objectContaining({
        twoColumn: false,
        tableHeavy: false,
        watermarkHeavy: false,
        crossPageTableLikely: false,
        lowTextReliability: true
      })
    );
  });

  test("classifies S55643-51Q into the cellular-pam template with mock providers", async () => {
    const preparation = await prepareDocumentForAnalysis(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        pdfTextExtractor: async () => ({
          text: s55643Text,
          pageTexts: s55643Pages,
          pageCount: 26
        }),
        systemTextExtractor: async () => null
      }
    );
    const { llmProvider, searchProvider } = createMockProviders();

    const identity = await classifyDocumentIdentity({
      pdfBuffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]),
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q 初步分析",
      chipName: "S55643-51Q",
      preparation,
      llmProvider,
      searchProvider
    });

    expect(identity.canonicalPartNumber).toBe("S55643-51Q");
    expect(identity.manufacturer).toBe("Samsung");
    expect(identity.parameterTemplateId).toBe("cellular-3g4g5g");
    expect(identity.publicContext).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceType: "public" })])
    );
  });

  test("passes raw pdf context into direct-first classification and report synthesis", async () => {
    const classifyCalls: Array<Record<string, unknown>> = [];
    const synthesizeCalls: Array<Record<string, unknown>> = [];
    const preparation = await prepareDocumentForAnalysis(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        pdfTextExtractor: async () => ({
          text: s55643Text,
          pageTexts: s55643Pages,
          pageCount: 26
        }),
        systemTextExtractor: async () => null
      }
    );
    const llmProvider: LlmProvider = {
      classifyIdentity: async (input) => {
        classifyCalls.push(input as unknown as Record<string, unknown>);
        return {
          canonicalPartNumber: "S55643-51Q",
          manufacturer: "Samsung",
          deviceClass: "Cellular PAM / PA",
          parameterTemplateId: "cellular-3g4g5g",
          focusChecklist: ["RFFE bus"],
          publicContext: [],
          confidence: 0.91
        };
      },
      synthesizeReport: async (input) => {
        synthesizeCalls.push(input as unknown as Record<string, unknown>);
        return {
          executiveSummary: "summary",
          deviceIdentity: {
            canonicalPartNumber: "S55643-51Q",
            manufacturer: "Samsung",
            deviceClass: "Cellular PAM / PA",
            parameterTemplateId: "cellular-3g4g5g",
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
        };
      },
      answerFollowUp: async ({ question }) => {
        return {
          answer: `针对“${question}”的追问已生成。`,
          claims: [],
          citations: [],
          usedSources: ["datasheet"],
          followUpWarnings: [],
          sourceAttribution: {
            mode: "llm_first"
          }
        };
      }
    };

    const identity = await classifyDocumentIdentity({
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q 初步分析",
      chipName: "S55643-51Q",
      pdfBuffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]),
      preparation,
      llmProvider
    });

    await synthesizeEvidenceReport({
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q 初步分析",
      chipName: "S55643-51Q",
      pdfBuffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]),
      preparation,
      identity,
      parameterTemplate: getParameterTemplate(identity.parameterTemplateId),
      publicContext: [],
      llmProvider
    });

    expect(classifyCalls[0]).toEqual(
      expect.objectContaining({
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        pdfBuffer: expect.any(Uint8Array),
        preparation: expect.objectContaining({
          identityCandidates: expect.objectContaining({
            sku: "S55643-51Q"
          })
        })
      })
    );
    expect(synthesizeCalls[0]).toEqual(
      expect.objectContaining({
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        pdfBuffer: expect.any(Uint8Array),
        identity: expect.objectContaining({
          parameterTemplateId: "cellular-3g4g5g"
        })
      })
    );
  });

  test("preserves a usable pdf buffer for llm stages even if local extraction detaches the original buffer", async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 49, 10]);
    let classifyBufferLength = 0;
    let synthesizeBufferLength = 0;

    const result = await analyzePdfBuffer(
      {
        fileName: "detached-buffer.pdf",
        taskName: "Detached buffer analysis",
        chipName: "DetachedBuffer",
        buffer: pdfBytes
      },
      {
        pdfTextExtractor: async (input) => {
          structuredClone(input.buffer.buffer, { transfer: [input.buffer.buffer] });
          return {
            text: "DetachedBuffer serial flash memory Features Package WSON-8",
            pageTexts: ["DetachedBuffer serial flash memory Features Package WSON-8"],
            pageCount: 1
          };
        },
        systemTextExtractor: async () => null,
        llmProvider: {
          classifyIdentity: async (input) => {
            classifyBufferLength = input.pdfBuffer.byteLength;
            return {
              canonicalPartNumber: "DetachedBuffer",
              manufacturer: "TestMaker",
              deviceClass: "Serial Flash Memory",
              parameterTemplateId: "generic-fallback",
              focusChecklist: ["Feature list", "Package"],
              publicContext: [],
              confidence: 0.8
            };
          },
          synthesizeReport: async (input) => {
            synthesizeBufferLength = input.pdfBuffer.byteLength;
            return {
              executiveSummary: "DetachedBuffer report",
              deviceIdentity: {
                canonicalPartNumber: "DetachedBuffer",
                manufacturer: "TestMaker",
                deviceClass: "Serial Flash Memory",
                parameterTemplateId: "generic-fallback",
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
            };
          },
          answerFollowUp: async ({ question }) => {
            return {
              answer: `针对“${question}”的追问已生成。`,
              claims: [],
              citations: [],
              usedSources: ["datasheet"],
              followUpWarnings: [],
              sourceAttribution: {
                mode: "llm_first"
              }
            };
          }
        }
      }
    );

    expect(classifyBufferLength).toBeGreaterThan(0);
    expect(synthesizeBufferLength).toBeGreaterThan(0);
    expect(result.analysis.sourceAttribution).toEqual(
      expect.objectContaining({
        mode: "llm_first"
      })
    );
    expect(result.analysis.identity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "DetachedBuffer"
      })
    );
    expect(result.analysis.report?.executiveSummary).toContain("DetachedBuffer");
  });

  test("emits an in-flight fast-parameter snapshot before the full report resolves", async () => {
    let resolveReport!: (value: Awaited<ReturnType<NonNullable<LlmProvider["synthesizeReport"]>>>) => void;
    const onProgress = vi.fn();

    const analysisPromise = analyzePdfBuffer(
      {
        fileName: "upf5755.pdf",
        taskName: "UPF5755 fast-pass",
        chipName: "UPF5755",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        pdfTextExtractor: async () => ({
          text: "UPF5755 WiFi 6 front end module Package LGA 3mm x 3mm x 0.55mm",
          pageTexts: [
            "UPF5755 WiFi 6 front end module Compact profile package: LGA 3mm x 3mm x 0.55mm; 16-pin configuration",
            "Supply voltage VCC 4.75 5.0 5.25 V"
          ],
          pageCount: 7
        }),
        systemTextExtractor: async () => null,
        llmProvider: {
          classifyIdentity: async () => ({
            canonicalPartNumber: "UPF5755",
            manufacturer: "UPMicro",
            deviceClass: "Wi-Fi Front End Module (FEM)",
            parameterTemplateId: "generic-fallback",
            focusChecklist: ["Input voltage", "Package"],
            publicContext: [],
            confidence: 0.82
          }),
          extractKeyParameters: async () => [
            {
              name: "Input voltage",
              value: "4.75 to 5.25 V",
              sourceType: "datasheet",
              citations: [
                {
                  id: "cite-vcc",
                  sourceType: "datasheet",
                  page: 2,
                  quote: "Supply voltage VCC 4.75 5.0 5.25 V"
                }
              ],
              producer: "gpt-4o"
            }
          ],
          synthesizeReport: async () =>
            new Promise((resolve) => {
              resolveReport = resolve;
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
        onProgress
      }
    );

    await vi.waitFor(() => {
      expect(onProgress).toHaveBeenCalledTimes(1);
    });

    expect(onProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: "processing",
        warnings: ["参数初稿已生成，完整报告仍在整理。"],
        analysis: expect.objectContaining({
          summary: "",
          report: null,
          fastParametersReadyAt: expect.any(String),
          fullReportReadyAt: null,
          keyParameters: [
            expect.objectContaining({
              name: "Input voltage",
              status: "needs_review"
            })
          ],
          parameterReconciliation: expect.objectContaining({
            fastPassCompleted: true,
            fullReportCompleted: false
          }),
          preparationMeta: expect.objectContaining({
            pageCount: 7
          })
        })
      })
    );

    resolveReport({
      executiveSummary: "UPF5755 report ready",
      deviceIdentity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "Wi-Fi Front End Module (FEM)",
        parameterTemplateId: "generic-fallback",
        confidence: 0.82
      },
      keyParameters: [],
      designFocus: [],
      risks: [],
      openQuestions: [],
      publicNotes: [],
      citations: [],
      sections: [],
      claims: []
    });

    const result = await analysisPromise;
    expect(result.status).toBe("complete");
    expect(result.analysis.fullReportReadyAt).toEqual(expect.any(String));
  });

  test("synthesizes a cited report and downgrades uncited datasheet claims with public notes disabled by default", async () => {
    const preparation = await prepareDocumentForAnalysis(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        pdfTextExtractor: async () => ({
          text: s55643Text,
          pageTexts: s55643Pages,
          pageCount: 26
        }),
        systemTextExtractor: async () => null
      }
    );
    const { llmProvider, searchProvider } = createMockProviders();
    const identity = await classifyDocumentIdentity({
      pdfBuffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]),
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q 初步分析",
      chipName: "S55643-51Q",
      preparation,
      llmProvider,
      searchProvider
    });
    const parameterTemplate = getParameterTemplate(identity.parameterTemplateId);

    const report = await synthesizeEvidenceReport({
      pdfBuffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]),
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q 初步分析",
      chipName: "S55643-51Q",
      preparation,
      identity,
      parameterTemplate,
      publicContext: identity.publicContext,
      llmProvider
    });

    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "RFFE bus",
          value: "52 MHz",
          sourceType: "datasheet",
          citations: expect.arrayContaining([
            expect.objectContaining({
              sourceType: "datasheet",
              page: 2,
              quote: expect.stringContaining("52 MHz")
            })
          ])
        }),
        expect.objectContaining({
          label: "Maximum Linear Output Power",
          value: "31 dBm",
          sourceType: "datasheet"
        })
      ])
    );

    const uncitedClaim = report.claims.find((claim) => claim.label === "Uncited claim");
    expect(uncitedClaim?.sourceType).toBe("review");
    expect(report.publicNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "public"
        })
      ])
    );
  });

  test("includes public notes only when public search is explicitly enabled", async () => {
    process.env.ANALYSIS_ENABLE_PUBLIC_SEARCH = "true";
    const preparation = await prepareDocumentForAnalysis(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        pdfTextExtractor: async () => ({
          text: s55643Text,
          pageTexts: s55643Pages,
          pageCount: 26
        }),
        systemTextExtractor: async () => null
      }
    );
    const { llmProvider, searchProvider } = createMockProviders();
    const identity = await classifyDocumentIdentity({
      pdfBuffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]),
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q 初步分析",
      chipName: "S55643-51Q",
      preparation,
      llmProvider,
      searchProvider
    });
    const parameterTemplate = getParameterTemplate(identity.parameterTemplateId);

    const report = await synthesizeEvidenceReport({
      pdfBuffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]),
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q 初步分析",
      chipName: "S55643-51Q",
      preparation,
      identity,
      parameterTemplate,
      publicContext: identity.publicContext,
      llmProvider
    });

    expect(report.publicNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "public",
          citations: expect.arrayContaining([
            expect.objectContaining({
              sourceType: "public",
              url: "https://example.com/s55643-51q"
            })
          ])
        })
      ])
    );
    delete process.env.ANALYSIS_ENABLE_PUBLIC_SEARCH;
  });

  test("fails when no llm provider is configured instead of degrading to local extraction", async () => {
    const result = await analyzePdfBuffer(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        pdfTextExtractor: async () => ({
          text: s55643Text,
          pageTexts: s55643Pages,
          pageCount: 26
        }),
        systemTextExtractor: async () => null
      }
    );

    expect(result.status).toBe("failed");
    expect(result.analysis.identity).toBeNull();
    expect(result.analysis.report).toBeNull();
    expect(result.analysis.preparationMeta).toEqual(
      expect.objectContaining({
        pageCount: 26,
        extractionMethod: "none"
      })
    );
    expect(result.analysis.sourceAttribution).toEqual(
      expect.objectContaining({
        mode: "failed"
      })
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("LLM")])
    );
  });

  test("preparation on the real S55643-51Q sample only produces enhancement when odl is enabled", async () => {
    process.env.ANALYSIS_ENABLE_ODL = "true";
    const pdfBytes = new Uint8Array(readFileSync("/Users/jilanfang/Datasheet/S55643-51Q.pdf"));

    const preparation = await prepareDocumentForAnalysis(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: pdfBytes
      },
      {
        opendataloaderExtractor: async () => ({
          text: s55643Text,
          pageTexts: s55643Pages,
          pageCount: 43
        })
      }
    );

    expect(preparation.identityCandidates.sku).toBe("S55643-51Q");
    expect(preparation.documentMeta.pageCount).toBe(43);
    expect(preparation.localCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "RFFE bus", value: "52 MHz" }),
        expect.objectContaining({ name: "Maximum Linear Output Power", value: "31 dBm" }),
        expect.objectContaining({ name: "Supported bands", value: expect.stringContaining("NR n1/2/3/5/7") })
      ])
    );
    expect(preparation.complexityFlags).toEqual(
      expect.objectContaining({
        tableHeavy: true,
        watermarkHeavy: true
      })
    );
    delete process.env.ANALYSIS_ENABLE_ODL;
  });

  test("uses OpenDataLoader as the only local extractor when available", async () => {
    process.env.ANALYSIS_ENABLE_ODL = "true";
    const result = await analyzePdfBuffer(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        opendataloaderExtractor: async () => ({
          text: s55643Text,
          pageTexts: s55643Pages,
          pageCount: 26
        }),
        pdfTextExtractor: async () => ({
          text: "weaker fallback text",
          pageTexts: ["weaker fallback text"],
          pageCount: 1
        }),
        systemTextExtractor: async () => null
      }
    );

    expect(result.status).toBe("failed");
    expect(result.analysis.preparationMeta).toEqual(
      expect.objectContaining({
        extractionMethod: "opendataloader",
        pageCount: 26
      })
    );
    expect(result.analysis.evidence).toEqual([]);
    delete process.env.ANALYSIS_ENABLE_ODL;
  });

  test("does not fall back to pdfjs when OpenDataLoader is unavailable", async () => {
    process.env.ANALYSIS_ENABLE_ODL = "true";
    const result = await analyzePdfBuffer(
      {
        fileName: "LMR51430.pdf",
        taskName: "LMR51430 初步分析",
        chipName: "LMR51430",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        opendataloaderExtractor: async () => {
          throw new Error("java not found");
        },
        pdfTextExtractor: async () => ({
          text:
            "LMR51430 36-V synchronous buck converter VIN operating range 4.5 V to 36 V 3-A output current Package options SOT-23-THN",
          pageTexts: [
            "LMR51430 36-V synchronous buck converter VIN operating range 4.5 V to 36 V",
            "3-A output current Package options SOT-23-THN"
          ],
          pageCount: 2
        }),
        systemTextExtractor: async () => null
      }
    );

    expect(result.status).toBe("failed");
    expect(result.analysis.preparationMeta).toEqual(
      expect.objectContaining({
        extractionMethod: "none",
        pageCount: 2
      })
    );
    delete process.env.ANALYSIS_ENABLE_ODL;
  });

  test("skips OpenDataLoader entirely when ANALYSIS_ENABLE_ODL is false", async () => {
    process.env.ANALYSIS_ENABLE_ODL = "false";
    let odlCalls = 0;

    const result = await analyzePdfBuffer(
      {
        fileName: "LMR51430.pdf",
        taskName: "LMR51430 初步分析",
        chipName: "LMR51430",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        opendataloaderExtractor: async () => {
          odlCalls += 1;
          return {
            text: s55643Text,
            pageTexts: s55643Pages,
            pageCount: 26
          };
        },
        pdfTextExtractor: async () => ({
          text:
            "LMR51430 36-V synchronous buck converter VIN operating range 4.5 V to 36 V 3-A output current Package options SOT-23-THN",
          pageTexts: [
            "LMR51430 36-V synchronous buck converter VIN operating range 4.5 V to 36 V",
            "3-A output current Package options SOT-23-THN"
          ],
          pageCount: 2
        }),
        systemTextExtractor: async () => null
      }
    );

    expect(odlCalls).toBe(0);
    expect(result.status).toBe("failed");
    expect(result.analysis.preparationMeta).toEqual(
      expect.objectContaining({
        extractionMethod: "none",
        pageCount: 2
      })
    );
    delete process.env.ANALYSIS_ENABLE_ODL;
  });

  test("calls search provider by default in llm-first mode", async () => {
    delete process.env.ANALYSIS_ENABLE_PUBLIC_SEARCH;
    let searchCalls = 0;
    const searchProvider: SearchProvider = {
      searchPartContext: async () => {
        searchCalls += 1;
        return [
          {
            id: "public-1",
            title: "public",
            url: "https://example.com/public",
            snippet: "public",
            sourceType: "public"
          }
        ];
      }
    };

    const result = await analyzePdfBuffer(
      {
        fileName: "S55643-51Q.pdf",
        taskName: "S55643-51Q 初步分析",
        chipName: "S55643-51Q",
        buffer: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])
      },
      {
        llmProvider: createMockProviders().llmProvider,
        searchProvider,
        pdfTextExtractor: async () => ({
          text: s55643Text,
          pageTexts: s55643Pages,
          pageCount: 26
        }),
        systemTextExtractor: async () => null
      }
    );

    expect(searchCalls).toBeGreaterThan(0);
    expect(result.analysis.report?.publicNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "public"
        })
      ])
    );
  });
});
