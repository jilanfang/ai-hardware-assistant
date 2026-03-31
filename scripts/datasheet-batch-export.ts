import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { analyzePdfBuffer } from "../lib/server-analysis";
import { buildAnalysisJson } from "../lib/exports";
import {
  buildBatchParameterRows,
  buildBatchParametersCsv,
  buildBatchSummaryCsv,
  buildBatchSummaryRow
} from "../lib/datasheet-batch-export";
import type { UploadedPdf } from "../lib/types";

type BatchSpec = {
  chipName: string;
  filePath: string;
  taskName: string;
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
  const specs: BatchSpec[] = [];
  let outputDir: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--output-dir") {
      outputDir = argv[index + 1] ? resolve(argv[index + 1]) : null;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output-dir=")) {
      outputDir = resolve(arg.slice("--output-dir=".length));
      continue;
    }

    const separatorIndex = arg.indexOf("::");
    if (separatorIndex > 0) {
      const chipName = arg.slice(0, separatorIndex).trim();
      const filePath = resolve(arg.slice(separatorIndex + 2).trim());
      specs.push({
        chipName,
        filePath,
        taskName: `${chipName} 批量分析`
      });
      continue;
    }

    const filePath = resolve(arg);
    const chipName = basename(filePath).replace(/\.pdf$/i, "");
    specs.push({
      chipName,
      filePath,
      taskName: `${chipName} 批量分析`
    });
  }

  if (!specs.length) {
    throw new Error(
      "usage: npm run datasheet:batch -- [--output-dir <dir>] \"UPF5337::/abs/path/file.pdf\" \"S55643-51Q::/abs/path/file.pdf\""
    );
  }

  return {
    outputDir:
      outputDir ??
      resolve(process.cwd(), "artifacts", `datasheet-batch-${new Date().toISOString().slice(0, 10)}`),
    specs
  };
}

async function main() {
  loadDotEnvLocal();
  const { outputDir, specs } = parseArgs(process.argv.slice(2));
  mkdirSync(outputDir, { recursive: true });

  const summaryRows = [];
  const parameterRows = [];

  for (const spec of specs) {
    const buffer = new Uint8Array(readFileSync(spec.filePath));
    const result = await analyzePdfBuffer({
      fileName: basename(spec.filePath),
      taskName: spec.taskName,
      chipName: spec.chipName,
      buffer
    });

    const uploadedPdf: UploadedPdf = {
      id: `batch-${spec.chipName}`,
      taskName: spec.taskName,
      chipName: spec.chipName,
      fileName: basename(spec.filePath),
      pageCount: result.analysis.preparationMeta?.pageCount ?? 1,
      objectUrl: ""
    };

    const analysisJson = buildAnalysisJson(uploadedPdf, result.analysis);
    writeFileSync(join(outputDir, analysisJson.fileName), analysisJson.content, "utf8");

    summaryRows.push(
      buildBatchSummaryRow({
        chipName: spec.chipName,
        sourceFile: basename(spec.filePath),
        result
      })
    );
    parameterRows.push(
      ...buildBatchParameterRows({
        chipName: spec.chipName,
        sourceFile: basename(spec.filePath),
        result
      })
    );

    console.log(
      JSON.stringify({
        chipName: spec.chipName,
        status: result.status,
        templateId: result.analysis.identity?.parameterTemplateId ?? null,
        reportKeyParameterCount: result.analysis.report?.keyParameters.length ?? 0,
        finalKeyParameterCount: result.analysis.keyParameters.length
      })
    );
  }

  writeFileSync(join(outputDir, "batch-summary.csv"), buildBatchSummaryCsv(summaryRows), "utf8");
  writeFileSync(join(outputDir, "batch-parameters.csv"), buildBatchParametersCsv(parameterRows), "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
