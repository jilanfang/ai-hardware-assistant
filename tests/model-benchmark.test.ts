import { describe, expect, test } from "vitest";

import {
  buildBenchmarkSummary,
  buildProviderModelId,
  evaluateBenchmarkQuality,
  normalizeBenchmarkScore,
  type BenchmarkQualityScenario
} from "@/lib/model-benchmark";

const scenario: BenchmarkQualityScenario = {
  id: "upf5755_pdf_report",
  baseline: {
    provider: "lyapi",
    model: "gemini-3.1-pro-preview",
    score: 100
  },
  requiredFacts: [
    { id: "freq", points: 15, mode: "all", phrases: ["5.15", "5.85"] },
    { id: "wifi6", points: 15, mode: "any", phrases: ["802.11ax", "WiFi 6"] },
    { id: "power", points: 20, mode: "all", phrases: ["17 dBm", "21 dBm", "22 dBm"] },
    { id: "nf", points: 10, mode: "all", phrases: ["2.5 dB"] }
  ],
  hallucinationChecks: [
    {
      id: "external-feedback-without-evidence",
      penalty: 25,
      patterns: ["公开讨论", "用户反馈", "论坛", "口碑"],
      allowIfAnyOf: ["不能访问互联网", "无法进行在线检索", "不能伪造", "未提供任何外部搜索结果"]
    }
  ]
};

describe("model benchmark scoring", () => {
  test("forces the configured baseline to 100", () => {
    const quality = evaluateBenchmarkQuality(scenario, {
      provider: "lyapi",
      model: "gemini-3.1-pro-preview",
      text: "5.15 5.85 802.11ax 17 dBm 21 dBm 22 dBm 2.5 dB"
    });

    expect(quality.score).toBe(100);
    expect(quality.normalizedScore).toBe(100);
  });

  test("rewards fact coverage and penalizes unsupported external-feedback claims", () => {
    const grounded = evaluateBenchmarkQuality(scenario, {
      provider: "lyapi",
      model: "gpt-4o",
      text: "UPF5755 supports 5.15 to 5.85 GHz, 802.11ax, 17 dBm, 21 dBm, 22 dBm, and 2.5 dB NF."
    });
    const hallucinated = evaluateBenchmarkQuality(scenario, {
      provider: "lyapi",
      model: "gemini-3-flash-preview",
      text: "基于公开讨论和用户反馈，这颗芯片口碑不错。5.15 to 5.85 GHz, 802.11ax, 17 dBm, 21 dBm, 22 dBm, 2.5 dB."
    });

    expect(grounded.score).toBeGreaterThan(hallucinated.score);
    expect(hallucinated.penalties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "external-feedback-without-evidence", points: 25 })
      ])
    );
  });

  test("does not penalize explicit honesty about missing external evidence", () => {
    const honest = evaluateBenchmarkQuality(scenario, {
      provider: "vectorengine",
      model: "gpt-5.4",
      text: "由于当前未提供任何外部搜索结果，不能伪造论坛或用户反馈。5.15 5.85 802.11ax 17 dBm 21 dBm 22 dBm 2.5 dB"
    });

    expect(honest.penalties).toHaveLength(0);
    expect(honest.score).toBeGreaterThan(0);
  });

  test("normalizes non-baseline scores against the configured baseline ceiling", () => {
    expect(normalizeBenchmarkScore(87, scenario.baseline.score)).toBe(87);
    expect(normalizeBenchmarkScore(120, scenario.baseline.score)).toBe(100);
    expect(normalizeBenchmarkScore(-5, scenario.baseline.score)).toBe(0);
  });

  test("uses provider/model as the stable benchmark target id", () => {
    expect(buildProviderModelId("lyapi", "gpt-4o")).toBe("lyapi/gpt-4o");
    expect(buildProviderModelId("vectorengine", "gemini-3.1-pro-preview")).toBe(
      "vectorengine/gemini-3.1-pro-preview"
    );
  });

  test("builds response and quality ranking around provider/model runs", () => {
    const summary = buildBenchmarkSummary(
      scenario,
      [
        {
          provider: "lyapi",
          model: "gemini-3.1-pro-preview",
          response: {
            ok: true,
            status: 200,
            elapsedMs: 55592,
            textLength: 3528
          },
          qualityInput: {
            text: "5.15 5.85 802.11ax 17 dBm 21 dBm 22 dBm 2.5 dB"
          }
        },
        {
          provider: "lyapi",
          model: "gpt-4o",
          response: {
            ok: true,
            status: 200,
            elapsedMs: 14902,
            textLength: 3117
          },
          qualityInput: {
            text: "5.15 5.85 802.11ax 17 dBm 21 dBm 22 dBm 2.5 dB"
          }
        },
        {
          provider: "vectorengine",
          model: "gpt-4.1",
          response: {
            ok: false,
            status: 524,
            elapsedMs: 120000,
            textLength: 0
          },
          qualityInput: {
            text: ""
          }
        }
      ]
    );

    expect(summary.baseline.targetId).toBe("lyapi/gemini-3.1-pro-preview");
    expect(summary.runs[0].targetId).toBe("lyapi/gemini-3.1-pro-preview");
    expect(summary.responseRanking[0].targetId).toBe("lyapi/gpt-4o");
    expect(summary.qualityRanking[0].targetId).toBe("lyapi/gemini-3.1-pro-preview");
    expect(summary.runs[2].quality.score).toBe(0);
  });
});
