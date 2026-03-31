import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import { buildBenchmarkSummary, type BenchmarkQualityScenario } from "../lib/model-benchmark";

type RelayTarget = {
  provider: string;
  model: string;
  baseUrl: string;
  mode: "gemini" | "responses";
  apiKeyEnv: string;
};

type BenchmarkScenarioFile = {
  id: string;
  pdfPath: string;
  prompt: string;
  baseline: BenchmarkQualityScenario["baseline"];
  requiredFacts: BenchmarkQualityScenario["requiredFacts"];
  hallucinationChecks: BenchmarkQualityScenario["hallucinationChecks"];
  targets: RelayTarget[];
};

type RawRun = {
  provider: string;
  model: string;
  mode: "gemini" | "responses";
  response: {
    ok: boolean;
    status: number;
    elapsedMs: number;
    textLength: number;
  };
  qualityInput: {
    text: string;
  };
  rawPreview: string;
  textPreview: string;
};

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]) {
  let scenarioPath: string | null = null;
  let outputPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--scenario") {
      scenarioPath = argv[index + 1] ? resolve(argv[index + 1]) : null;
      index += 1;
      continue;
    }

    if (arg.startsWith("--scenario=")) {
      scenarioPath = resolve(arg.slice("--scenario=".length));
      continue;
    }

    if (arg === "--output") {
      outputPath = argv[index + 1] ? resolve(argv[index + 1]) : null;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output=")) {
      outputPath = resolve(arg.slice("--output=".length));
    }
  }

  if (!scenarioPath) {
    throw new Error("usage: npm run benchmark:model -- --scenario <scenario.json> [--output <artifact.json>]");
  }

  return { scenarioPath, outputPath };
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`missing ${name}`);
  }

  return value;
}

function toBase64(path: string) {
  return Buffer.from(readFileSync(path)).toString("base64");
}

async function runGeminiTarget(target: RelayTarget, scenario: BenchmarkScenarioFile, pdfBase64: string) {
  const startedAtMs = Date.now();
  const response = await fetch(
    `${target.baseUrl.replace(/\/+$/, "")}/v1beta/models/${encodeURIComponent(target.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": requireEnv(target.apiKeyEnv)
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: scenario.prompt
              },
              {
                inline_data: {
                  mime_type: "application/pdf",
                  data: pdfBase64
                }
              }
            ]
          }
        ]
      })
    }
  );

  const raw = await response.text();
  const text = (() => {
    try {
      const parsed = JSON.parse(raw) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };
      return parsed.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? "").join("\n") ?? "";
    } catch {
      return "";
    }
  })();

  return {
    provider: target.provider,
    model: target.model,
    response: {
      ok: response.ok,
      status: response.status,
      elapsedMs: Date.now() - startedAtMs,
      textLength: text.length
    },
    qualityInput: {
      text
    },
    rawPreview: raw.trimStart().slice(0, 2000),
    textPreview: text.slice(0, 4000)
  };
}

async function runResponsesTarget(target: RelayTarget, scenario: BenchmarkScenarioFile, pdfBase64: string) {
  const startedAtMs = Date.now();
  const response = await fetch(`${target.baseUrl.replace(/\/+$/, "")}/v1/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${requireEnv(target.apiKeyEnv)}`
    },
    body: JSON.stringify({
      model: target.model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: scenario.prompt
            },
            {
              type: "input_file",
              filename: basename(scenario.pdfPath),
              file_data: `data:application/pdf;base64,${pdfBase64}`
            }
          ]
        }
      ]
    })
  });

  const raw = await response.text();
  const text = (() => {
    try {
      const parsed = JSON.parse(raw) as {
        output?: Array<{
          content?: Array<{
            text?: string;
          }>;
        }>;
      };
      return parsed.output?.flatMap((item) => item.content ?? []).map((part) => part.text ?? "").join("\n") ?? "";
    } catch {
      return "";
    }
  })();

  return {
    provider: target.provider,
    model: target.model,
    response: {
      ok: response.ok,
      status: response.status,
      elapsedMs: Date.now() - startedAtMs,
      textLength: text.length
    },
    qualityInput: {
      text
    },
    rawPreview: raw.trimStart().slice(0, 2000),
    textPreview: text.slice(0, 4000)
  };
}

async function main() {
  loadDotEnvLocal();
  const { scenarioPath, outputPath } = parseArgs(process.argv.slice(2));
  const scenario = JSON.parse(readFileSync(scenarioPath, "utf8")) as BenchmarkScenarioFile;
  const pdfPath = resolve(scenario.pdfPath);
  const pdfBase64 = toBase64(pdfPath);
  const qualityScenario: BenchmarkQualityScenario = {
    id: scenario.id,
    baseline: scenario.baseline,
    requiredFacts: scenario.requiredFacts,
    hallucinationChecks: scenario.hallucinationChecks
  };

  const rawRuns: RawRun[] = [];
  for (const target of scenario.targets) {
    const run =
      target.mode === "gemini"
        ? await runGeminiTarget(target, { ...scenario, pdfPath }, pdfBase64)
        : await runResponsesTarget(target, { ...scenario, pdfPath }, pdfBase64);
    rawRuns.push({
      provider: run.provider,
      model: run.model,
      mode: target.mode,
      response: run.response,
      qualityInput: run.qualityInput,
      rawPreview: run.rawPreview,
      textPreview: run.textPreview
    });
  }

  const summary = buildBenchmarkSummary(
    qualityScenario,
    rawRuns.map((run) => ({
      provider: run.provider,
      model: run.model,
      response: run.response,
      qualityInput: run.qualityInput
    }))
  );

  const artifact = {
    scenario: {
      id: scenario.id,
      pdfPath,
      prompt: scenario.prompt,
      baseline: scenario.baseline
    },
    generatedAt: new Date().toISOString(),
    runs: summary.runs.map((run) => {
      const raw = rawRuns.find((candidate) => candidate.provider === run.provider && candidate.model === run.model);
      return {
        ...run,
        mode: raw?.mode ?? null,
        textPreview: raw?.textPreview ?? "",
        rawPreview: raw?.rawPreview ?? ""
      };
    }),
    responseRanking: summary.responseRanking.map((run) => ({
      targetId: run.targetId,
      elapsedMs: run.response.elapsedMs,
      ok: run.response.ok,
      status: run.response.status
    })),
    qualityRanking: summary.qualityRanking.map((run) => ({
      targetId: run.targetId,
      score: run.quality.score,
      normalizedScore: run.quality.normalizedScore,
      penalties: run.quality.penalties
    }))
  };

  const finalOutputPath =
    outputPath ?? resolve(process.cwd(), "artifacts", `${scenario.id}-${new Date().toISOString().slice(0, 10)}.json`);
  mkdirSync(resolve(finalOutputPath, ".."), { recursive: true });
  writeFileSync(finalOutputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath: finalOutputPath, runCount: artifact.runs.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
