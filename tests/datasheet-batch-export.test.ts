import { describe, expect, test } from "vitest";

import {
  buildBatchParametersCsv,
  buildBatchSummaryCsv,
  flattenSummaryValue,
  pickBatchSummaryText
} from "@/lib/datasheet-batch-export";
import type { AnalysisResult } from "@/lib/types";

describe("datasheet batch export helpers", () => {
  test("flattens nested summary objects into readable text instead of object tags", () => {
    expect(
      flattenSummaryValue([
        {
          title: "Overview",
          body: "WiFi FEM"
        },
        {
          summary: "Need thermal review"
        }
      ])
    ).toBe("WiFi FEM | Need thermal review");
  });

  test("prefers report executive summary and falls back to readable review text", () => {
    const analysis: AnalysisResult = {
      summary: "",
      review: "",
      keyParameters: [],
      evidence: [],
      report: {
        executiveSummary: "",
        deviceIdentity: {
          canonicalPartNumber: "RF7459A",
          manufacturer: "Qorvo",
          deviceClass: "PAM",
          parameterTemplateId: "cellular-3g4g5g",
          confidence: 0.9
        },
        keyParameters: [],
        designFocus: [],
        risks: [],
        openQuestions: [],
        publicNotes: [],
        citations: [],
        sections: [
          {
            id: "what_this_part_is_for",
            title: "这颗器件是做什么的",
            body: "Multi-band PAM for LTE",
            sourceType: "review",
            citations: []
          },
          {
            id: "risks_and_gotchas",
            title: "风险与易错点",
            body: "Thermal path matters",
            sourceType: "review",
            citations: []
          }
        ],
        claims: []
      }
    };

    expect(pickBatchSummaryText(analysis)).toBe("Multi-band PAM for LTE | Thermal path matters");
  });

  test("builds CSV rows without object string leakage", () => {
    const summaryCsv = buildBatchSummaryCsv([
      {
        chip_name: "RF7459A",
        source_file: "RF7459A.pdf",
        status: "complete",
        template_id: "cellular-3g4g5g",
        canonical_part_number: "RF7459A",
        manufacturer: "Qorvo",
        device_class: "PAM",
        report_key_parameter_count: 3,
        final_key_parameter_count: 2,
        summary: "Multi-band PAM | Thermal path matters"
      }
    ]);
    const parameterCsv = buildBatchParametersCsv([
      {
        chip_name: "RF7459A",
        source_file: "RF7459A.pdf",
        template_id: "cellular-3g4g5g",
        parameter_name: "Supported bands",
        parameter_value: "B1, B3",
        status: "needs_review",
        extracted_by: "gemini_report_pass",
        confidence: "review",
        confidence_reason: "仅报告命中",
        source_pages: "1|2",
        source_quote: "Bands B1, B3"
      }
    ]);

    expect(summaryCsv).not.toContain("[object Object]");
    expect(parameterCsv).toContain('"B1, B3"');
  });
});
