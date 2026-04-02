import type {
  AnalysisDocumentViewModel,
  AnalysisResult,
  ExportArtifact,
  FollowUpMessage,
  UploadedPdf
} from "@/lib/types";
import { displayParameterName } from "@/lib/parameter-labels";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function exportStatusLabel(status: AnalysisDocumentViewModel["parameterRows"][number]["status"]) {
  if (status === "confirmed") return "已确认";
  if (status === "user_corrected") return "人工修正";
  return "待确认";
}

function exportRuntimeSummary(sourceAttribution: AnalysisResult["sourceAttribution"] | null) {
  if (!sourceAttribution?.documentPath || !sourceAttribution?.pipelineMode) {
    return null;
  }

  const documentPath =
    sourceAttribution.documentPath === "pdf_direct"
      ? "PDF direct"
      : sourceAttribution.documentPath === "image_fallback"
        ? "Image fallback"
        : "路径未知";

  return [`文档路径：${documentPath}`, `处理阶段：${sourceAttribution.pipelineMode}`].join("\n");
}

export function buildAnalysisDocumentViewModel(
  pdf: UploadedPdf,
  analysis: AnalysisResult,
  followUpMessages: FollowUpMessage[] = []
): AnalysisDocumentViewModel {
  return {
    taskMeta: {
      taskName: pdf.taskName,
      chipName: pdf.chipName,
      sourceFile: pdf.fileName,
      pageCount: pdf.pageCount
    },
    identity: analysis.identity ?? null,
    executiveSummary: analysis.report?.executiveSummary ?? analysis.summary,
    reportSections: analysis.report?.sections ?? [],
    parameterRows: analysis.keyParameters.map((item) => {
      const evidence = analysis.evidence.find((entry) => entry.id === item.evidenceId);

      return {
        name: displayParameterName(item.name),
        value: item.value,
        status: item.status,
        statusLabel: exportStatusLabel(item.status),
        evidence: evidence
          ? {
              label: evidence.label,
              page: evidence.page,
              quote: evidence.quote
            }
          : null
      };
    }),
    publicNotes: analysis.report?.publicNotes ?? [],
    followUpTranscript: followUpMessages,
    sourceAttribution: analysis.sourceAttribution ?? null,
    events: analysis.events ?? []
  };
}

function reportBody(viewModel: AnalysisDocumentViewModel, analysis: AnalysisResult) {
  const parameterLines = viewModel.parameterRows
    .map((item) => `- ${item.name}: ${item.value}（${item.statusLabel}）`)
    .join("\n");
  const runtimeAttribution = exportRuntimeSummary(viewModel.sourceAttribution);
  const reportSections = viewModel.reportSections.length
    ? viewModel.reportSections.map((section) => `${section.title}\n${section.body}`).join("\n\n")
    : null;
  const followUpSections = viewModel.followUpTranscript.length
    ? viewModel.followUpTranscript
        .map((message) => `Q: ${message.question}\nA: ${message.answer}`)
        .join("\n\n")
    : null;

  return [
    `芯片评估报告`,
    ``,
    `任务：${viewModel.taskMeta.taskName}`,
    `芯片：${viewModel.taskMeta.chipName}`,
    `源文件：${viewModel.taskMeta.sourceFile}`,
    ``,
    `快速总结`,
    viewModel.executiveSummary,
    ``,
    `工程评价`,
    analysis.review,
    ...(runtimeAttribution ? ["", "运行路径", runtimeAttribution] : []),
    ...(reportSections ? ["", "证据化报告", reportSections] : []),
    ``,
    `主要参数`,
    parameterLines,
    ...(followUpSections ? ["", "追问记录", followUpSections] : [])
  ].join("\n");
}

export function buildReportPdf(
  pdf: UploadedPdf,
  analysis: AnalysisResult,
  followUpMessages: FollowUpMessage[] = []
): ExportArtifact {
  return {
    fileName: `${pdf.chipName}-芯片评估报告.pdf`,
    mimeType: "application/pdf",
    content: reportBody(buildAnalysisDocumentViewModel(pdf, analysis, followUpMessages), analysis)
  };
}

export function buildReportWord(
  pdf: UploadedPdf,
  analysis: AnalysisResult,
  followUpMessages: FollowUpMessage[] = []
): ExportArtifact {
  return {
    fileName: `${pdf.chipName}-芯片评估报告.doc`,
    mimeType: "application/msword",
    content: reportBody(buildAnalysisDocumentViewModel(pdf, analysis, followUpMessages), analysis)
  };
}

export function buildParameterTable(
  pdf: UploadedPdf,
  analysis: AnalysisResult,
  followUpMessages: FollowUpMessage[] = []
): ExportArtifact {
  const rows = buildAnalysisDocumentViewModel(pdf, analysis, followUpMessages).parameterRows
    .map((item) => `${item.name},${item.value},${item.statusLabel}`);

  return {
    fileName: `${pdf.chipName}-参数表.csv`,
    mimeType: "text/csv",
    content: ["参数,值,状态", ...rows].join("\n")
  };
}

export function buildAnalysisJson(
  pdf: UploadedPdf,
  analysis: AnalysisResult,
  followUpMessages: FollowUpMessage[] = []
): ExportArtifact {
  const viewModel = buildAnalysisDocumentViewModel(pdf, analysis, followUpMessages);

  return {
    fileName: `${pdf.chipName}-任务结果.json`,
    mimeType: "application/json",
    content: JSON.stringify(viewModel, null, 2)
  };
}

export function buildAnalysisHtml(
  pdf: UploadedPdf,
  analysis: AnalysisResult,
  followUpMessages: FollowUpMessage[] = []
): ExportArtifact {
  const viewModel = buildAnalysisDocumentViewModel(pdf, analysis, followUpMessages);
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(viewModel.taskMeta.chipName)} 任务结果</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #111827; }
      h1, h2, h3 { margin: 0 0 12px; }
      section { margin: 0 0 28px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
      .muted { color: #6b7280; }
      .card { padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 12px; }
    </style>
  </head>
  <body>
    <section>
      <h1>${escapeHtml(viewModel.taskMeta.chipName)} Datasheet 阅读结果</h1>
      <p class="muted">任务：${escapeHtml(viewModel.taskMeta.taskName)} | 文件：${escapeHtml(viewModel.taskMeta.sourceFile)}</p>
      <p>${escapeHtml(viewModel.executiveSummary)}</p>
    </section>
    <section>
      <h2>报告正文</h2>
      ${viewModel.reportSections.map((section) => `<div class="card"><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.body)}</p></div>`).join("")}
    </section>
    ${viewModel.sourceAttribution ? `
    <section>
      <h2>处理记录</h2>
      <div class="card">
        ${exportRuntimeSummary(viewModel.sourceAttribution)
          ?.split("\n")
          .map((line) => `<p>${escapeHtml(line)}</p>`)
          .join("") ?? ""}
      </div>
    </section>` : ""}
    <section>
      <h2>关键参数表</h2>
      <table>
        <thead><tr><th>参数</th><th>值</th><th>状态</th><th>证据</th></tr></thead>
        <tbody>
          ${viewModel.parameterRows
            .map(
              (row) =>
                `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.statusLabel)}</td><td>${row.evidence ? `P${row.evidence.page}: ${escapeHtml(row.evidence.quote)}` : ""}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    </section>
    <section>
      <h2>风险与待确认项</h2>
      ${(analysis.report?.risks ?? [])
        .concat(analysis.report?.openQuestions ?? [])
        .map((claim) => `<div class="card"><h3>${escapeHtml(claim.title ?? claim.label)}</h3><p>${escapeHtml(claim.body ?? claim.value ?? "")}</p></div>`)
        .join("")}
    </section>
    <section>
      <h2>Public Notes</h2>
      ${viewModel.publicNotes.map((claim) => `<div class="card"><h3>${escapeHtml(claim.title ?? claim.label)}</h3><p>${escapeHtml(claim.body ?? claim.value ?? "")}</p></div>`).join("")}
    </section>
    <section>
      <h2>追问记录</h2>
      ${viewModel.followUpTranscript
        .map(
          (message) =>
            `<div class="card"><h3>${escapeHtml(message.question)}</h3><p>${escapeHtml(message.answer)}</p>${message.warnings.length ? `<p class="muted">${escapeHtml(message.warnings.join("；"))}</p>` : ""}</div>`
        )
        .join("")}
    </section>
  </body>
</html>`;

  return {
    fileName: `${pdf.chipName}-任务结果.html`,
    mimeType: "text/html",
    content: html
  };
}
