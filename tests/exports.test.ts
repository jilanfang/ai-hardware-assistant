import { describe, expect, test } from "vitest";

import { generateAnalysis } from "@/lib/analysis";
import { buildAnalysisHtml, buildAnalysisJson, buildParameterTable, buildReportPdf, buildReportWord } from "@/lib/exports";
import type { AnalysisResult, UploadedPdf } from "@/lib/types";

const uploadedPdf: UploadedPdf = {
  id: "pdf-1",
  taskName: "LMR51430 first pass",
  chipName: "LMR51430",
  fileName: "lmr51430-datasheet.pdf",
  pageCount: 26,
  objectUrl: "blob:pdf-1"
};

describe("export builders", () => {
  test("builds downloadable report artifacts, a full parameter table, and a grounded json export", () => {
    const analysis = generateAnalysis(uploadedPdf);

    const reportPdf = buildReportPdf(uploadedPdf, analysis);
    const reportWord = buildReportWord(uploadedPdf, analysis);
    const parameterTable = buildParameterTable(uploadedPdf, analysis);
    const analysisJson = buildAnalysisJson(uploadedPdf, analysis);

    expect(reportPdf.fileName).toBe("LMR51430-芯片评估报告.pdf");
    expect(reportWord.fileName).toBe("LMR51430-芯片评估报告.doc");
    expect(parameterTable.fileName).toBe("LMR51430-参数表.csv");
    expect(analysisJson.fileName).toBe("LMR51430-任务结果.json");
    expect(reportPdf.content).toContain("芯片评估报告");
    expect(reportPdf.content).toContain("任务：");
    expect(reportPdf.content).toContain("快速总结");
    expect(parameterTable.content.split("\n")[0]).toBe("参数,值,状态");
    expect(parameterTable.content).not.toContain("evidenceId");
    expect(analysisJson.content).toContain('"chipName": "LMR51430"');
    expect(analysisJson.content).toContain('"parameterRows"');
  });

  test("exports all parameters in csv with explicit chinese status labels", () => {
    const analysis: AnalysisResult = {
      ...generateAnalysis(uploadedPdf),
      keyParameters: [
        {
          name: "Input voltage",
          value: "4.5V to 36V",
          evidenceId: "ev-input",
          status: "confirmed"
        },
        {
          name: "Package",
          value: "SOT-23-THN",
          evidenceId: "ev-package",
          status: "needs_review"
        }
      ]
    };

    const parameterTable = buildParameterTable(uploadedPdf, analysis);

    expect(parameterTable.content.split("\n")[0]).toBe("参数,值,状态");
    expect(parameterTable.content).toContain("输入电压,4.5V to 36V,已确认");
    expect(parameterTable.content).toContain("封装,SOT-23-THN,待确认");
  });

  test("localizes parameter labels in exported report bodies and parameter tables", () => {
    const analysis: AnalysisResult = {
      ...generateAnalysis(uploadedPdf),
      keyParameters: [
        {
          name: "Document pages",
          value: "26",
          evidenceId: "ev-pages",
          status: "confirmed"
        },
        {
          name: "Input voltage",
          value: "4.5V to 36V",
          evidenceId: "ev-input",
          status: "confirmed"
        }
      ]
    };

    const reportPdf = buildReportPdf(uploadedPdf, analysis);
    const parameterTable = buildParameterTable(uploadedPdf, analysis);

    expect(reportPdf.content).toContain("文档页数: 26");
    expect(reportPdf.content).toContain("输入电压: 4.5V to 36V");
    expect(reportPdf.content).not.toContain("Document pages: 26");
    expect(parameterTable.content).toContain("文档页数,26,已确认");
  });

  test("includes evidence references in the grounded json export", () => {
    const analysis: AnalysisResult = {
      ...generateAnalysis(uploadedPdf),
      keyParameters: [
        {
          name: "Input voltage",
          value: "4.5V to 36V",
          evidenceId: "ev-input",
          status: "confirmed"
        }
      ],
      evidence: [
        {
          id: "ev-input",
          label: "输入电压范围",
          page: 1,
          quote: "VIN operating range 4.5V to 36V",
          rect: { left: 14, top: 18, width: 46, height: 10 }
        }
      ]
    };

    const analysisJson = buildAnalysisJson(uploadedPdf, analysis);

    expect(analysisJson.content).toContain('"name": "输入电压"');
    expect(analysisJson.content).toContain('"page": 1');
    expect(analysisJson.content).toContain('"quote": "VIN operating range 4.5V to 36V"');
  });

  test("includes hybrid identity/report/source attribution in json export", () => {
    const analysis: AnalysisResult = {
      ...generateAnalysis(uploadedPdf),
      identity: {
        canonicalPartNumber: "LMR51430",
        manufacturer: "Texas Instruments",
        deviceClass: "DC-DC",
        parameterTemplateId: "dc-dc",
        focusChecklist: ["Input voltage"],
        publicContext: [
          {
            id: "public-1",
            title: "LMR51430 overview",
            url: "https://example.com/lmr51430",
            snippet: "Buck regulator overview",
            sourceType: "public"
          }
        ],
        confidence: 0.91
      },
      report: {
        executiveSummary: "这是最终报告摘要。",
        deviceIdentity: {
          canonicalPartNumber: "LMR51430",
          manufacturer: "Texas Instruments",
          deviceClass: "DC-DC",
          parameterTemplateId: "dc-dc",
          confidence: 0.91
        },
        keyParameters: [
          {
            id: "claim-1",
            label: "Voltage - Input (Max)",
            value: "36 V",
            sourceType: "datasheet",
            citations: [
              {
                id: "cite-1",
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
            id: "section-1",
            title: "最终报告",
            body: "这是最终报告摘要。",
            sourceType: "review",
            citations: []
          }
        ],
        claims: [
          {
            id: "claim-1",
            label: "Voltage - Input (Max)",
            value: "36 V",
            sourceType: "datasheet",
            citations: [
              {
                id: "cite-1",
                sourceType: "datasheet",
                page: 1,
                quote: "VIN operating range 4.5 V to 36 V"
              }
            ]
          }
        ]
      },
      preparationMeta: {
        pageCount: 26,
        textCoverage: 500,
        extractionMethod: "opendataloader",
        localCandidateCount: 3,
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
        llmProvider: "mock-llm",
        llmTarget: "mock-llm/report-model",
        searchProvider: "mock-search",
        documentPath: "pdf_direct",
        pipelineMode: "single"
      }
    };

    const analysisJson = buildAnalysisJson(uploadedPdf, analysis);

    expect(analysisJson.content).toContain('"identity"');
    expect(analysisJson.content).toContain('"reportSections"');
    expect(analysisJson.content).toContain('"sourceAttribution"');
    expect(analysisJson.content).toContain('"mode": "llm_first_with_odl"');
    expect(analysisJson.content).toContain('"llmTarget": "mock-llm/report-model"');
    expect(analysisJson.content).toContain('"documentPath": "pdf_direct"');
    expect(analysisJson.content).toContain('"pipelineMode": "single"');
  });

  test("includes follow-up transcript and public notes in unified json export", () => {
    const analysis: AnalysisResult = {
      ...generateAnalysis(uploadedPdf),
      sourceAttribution: {
        mode: "llm_first",
        llmTarget: "custom/gpt-4.1",
        documentPath: "pdf_direct",
        pipelineMode: "single"
      },
      report: {
        executiveSummary: "这是最终报告摘要。",
        deviceIdentity: {
          canonicalPartNumber: "LMR51430",
          manufacturer: "Texas Instruments",
          deviceClass: "DC-DC",
          parameterTemplateId: "dc-dc",
          confidence: 0.91
        },
        keyParameters: [],
        designFocus: [],
        risks: [],
        openQuestions: [],
        publicNotes: [
          {
            id: "public-note-1",
            label: "Public note",
            body: "外部资料只作补充。",
            sourceType: "public",
            citations: [
              {
                id: "cite-public-1",
                sourceType: "public",
                url: "https://example.com/lmr51430",
                title: "LMR51430 note",
                snippet: "Public snippet"
              }
            ]
          }
        ],
        citations: [],
        sections: [],
        claims: []
      }
    };

    const analysisJson = buildAnalysisJson(uploadedPdf, analysis, [
      {
        id: "follow-1",
        question: "最先看哪几个参数？",
        answer: "先看输入范围、输出电流和热设计。",
        claims: [],
        citations: [],
        warnings: ["当前为近似引用。"],
        usedSources: ["datasheet", "review"],
        sourceAttribution: {
          mode: "llm_first"
        },
        createdAt: "2026-03-30T08:00:00.000Z"
      }
    ]);

    expect(analysisJson.content).toContain('"followUpTranscript"');
    expect(analysisJson.content).toContain('"最先看哪几个参数？"');
    expect(analysisJson.content).toContain('"publicNotes"');
  });

  test("builds an html export from the unified document view model", () => {
    const analysis: AnalysisResult = {
      ...generateAnalysis(uploadedPdf),
      sourceAttribution: {
        mode: "llm_first",
        llmTarget: "custom/gpt-4.1",
        documentPath: "pdf_direct",
        pipelineMode: "single"
      },
      report: {
        executiveSummary: "这是最终报告摘要。",
        deviceIdentity: {
          canonicalPartNumber: "LMR51430",
          manufacturer: "Texas Instruments",
          deviceClass: "DC-DC",
          parameterTemplateId: "dc-dc",
          confidence: 0.91
        },
        keyParameters: [],
        designFocus: [],
        risks: [
          {
            id: "risk-1",
            label: "Absolute maximum",
            body: "不要把 Absolute Maximum 当正常工作条件。",
            sourceType: "review",
            citations: []
          }
        ],
        openQuestions: [],
        publicNotes: [],
        citations: [],
        sections: [
          {
            id: "how_to_read_this_datasheet",
            title: "怎么读这份 Datasheet",
            body: "先看首页，再看工作条件和电气参数。",
            sourceType: "review",
            citations: []
          },
          {
            id: "implementation_constraints",
            title: "工艺与落地约束",
            body: "封装散热、焊盘接地和贴片工艺需要单独复核。",
            sourceType: "review",
            citations: []
          }
        ],
        claims: []
      }
    };

    const html = buildAnalysisHtml(uploadedPdf, analysis, [
      {
        id: "follow-1",
        question: "最先看哪几个参数？",
        answer: "先看输入范围、输出电流和热设计。",
        claims: [],
        citations: [],
        warnings: [],
        usedSources: ["datasheet"],
        sourceAttribution: {
          mode: "llm_first"
        },
        createdAt: "2026-03-30T08:00:00.000Z"
      }
    ]);

    expect(html.fileName).toBe("LMR51430-任务结果.html");
    expect(html.mimeType).toBe("text/html");
    expect(html.content).toContain("<html");
    expect(html.content).toContain("怎么读这份 Datasheet");
    expect(html.content).toContain("工艺与落地约束");
    expect(html.content).toContain("封装散热、焊盘接地和贴片工艺需要单独复核。");
    expect(html.content).toContain("最先看哪几个参数？");
    expect(html.content).toContain("不要把 Absolute Maximum 当正常工作条件。");
    expect(html.content).toContain("处理记录");
    expect(html.content).toContain("PDF direct");
    expect(html.content).toContain("处理阶段：single");
    expect(html.content).not.toContain("custom/gpt-4.1");
  });

  test("uses the same status semantics across pdf, word, html, and json exports", () => {
    const analysis: AnalysisResult = {
      ...generateAnalysis(uploadedPdf),
      keyParameters: [
        {
          name: "Input voltage",
          value: "4.5V to 36V",
          evidenceId: "ev-input",
          status: "confirmed"
        },
        {
          name: "Package",
          value: "SOT-23-THN",
          evidenceId: "ev-package",
          status: "needs_review"
        },
        {
          name: "Output current",
          value: "300mA",
          evidenceId: "ev-out",
          status: "user_corrected"
        }
      ]
    };

    const reportPdf = buildReportPdf(uploadedPdf, analysis);
    const reportWord = buildReportWord(uploadedPdf, analysis);
    const analysisHtml = buildAnalysisHtml(uploadedPdf, analysis);
    const analysisJson = buildAnalysisJson(uploadedPdf, analysis);

    expect(reportPdf.content).toContain("输入电压: 4.5V to 36V（已确认）");
    expect(reportWord.content).toContain("封装: SOT-23-THN（待确认）");
    expect(analysisHtml.content).toContain("<td>人工修正</td>");
    expect(analysisJson.content).toContain('"status": "user_corrected"');
    expect(analysisJson.content).toContain('"statusLabel": "人工修正"');
  });

  test("uses pdf chipName for csv export instead of deriving context from the summary", () => {
    const analysis: AnalysisResult = {
      ...generateAnalysis(uploadedPdf),
      summary: "This summary should not decide the export file name.",
      keyParameters: [
        {
          name: "Input voltage",
          value: "4.5V to 36V",
          evidenceId: "ev-input",
          status: "confirmed"
        }
      ]
    };

    const parameterTable = buildParameterTable(uploadedPdf, analysis);

    expect(parameterTable.fileName).toBe("LMR51430-参数表.csv");
  });
});
