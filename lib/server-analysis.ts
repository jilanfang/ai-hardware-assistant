import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

import { addInitialAnalysisMetadata } from "@/lib/analysis-audit";
import { logAnalysisEvent } from "@/lib/analysis-observability";
import { readPdfPageCount } from "@/lib/pdf-page-count";
import { getParameterTemplate } from "@/lib/parameter-templates";
import { resolveConfiguredProviders, type LlmProvider, type SearchProvider } from "@/lib/providers";
import type {
  ArbitrationDecision,
  AnalysisJobResult,
  AnalysisResult,
  ClaimCitation,
  DocumentPreparation,
  EvidenceTarget,
  FollowUpResponse,
  IdentityClassification,
  ParameterArbitrationNote,
  ParameterConflict,
  ParameterDraft,
  ParameterItem,
  ParameterReconciliation,
  PublicContext,
  ReportClaim,
  ReportOutput
} from "@/lib/types";

type AnalyzePdfInput = {
  fileName: string;
  taskName: string;
  chipName: string;
  buffer: Uint8Array;
};

type AnalyzePdfDependencies = {
  opendataloaderExtractor?: (input: AnalyzePdfInput) => Promise<{ text: string; pageTexts: string[]; pageCount?: number } | null>;
  pdfTextExtractor?: (input: AnalyzePdfInput) => Promise<{ text: string; pageTexts: string[]; pageCount?: number } | null>;
  systemTextExtractor?: (input: AnalyzePdfInput) => Promise<string | null>;
  llmProvider?: LlmProvider | null;
  searchProvider?: SearchProvider | null;
  llmTimeoutMs?: number;
  onProgress?: (snapshot: AnalysisJobResult) => void;
};

const ODL_TIMEOUT_MS = 12_000;
const LLM_TIMEOUT_MS = 90_000;
const GENERIC_LLM_FAILURE = "LLM 主分析链路失败，当前不会再退回本地 parser，请检查 provider、模型配置或稍后重试。";
const MISSING_PROVIDER_FAILURE = "未配置可用 LLM provider，当前系统已切换为 LLM-first，因而不会再退回本地抽取。";
const LLM_TIMEOUT_FAILURE = "LLM 主分析链路超时，当前任务已停止。请稍后重试，或检查 provider / base URL 是否稳定。";

function elapsedMs(startedAtMs: number) {
  return Math.max(0, Date.now() - startedAtMs);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => (value ?? "").trim()).filter(Boolean))];
}

function emptyPreparation(input: AnalyzePdfInput): DocumentPreparation {
  return {
    identityCandidates: {
      sku: input.chipName || null,
      manufacturer: null,
      documentTitle: null,
      aliases: uniqueStrings([input.chipName, input.fileName.replace(/\.pdf$/i, "")])
    },
    documentMeta: {
      fileName: input.fileName,
      pageCount: 0,
      textCoverage: 0,
      extractionMethod: "none"
    },
    pagePackets: [],
    localCandidates: [],
    complexityFlags: {
      twoColumn: false,
      tableHeavy: false,
      imageHeavy: false,
      watermarkHeavy: false,
      crossPageTableLikely: false,
      lowTextReliability: true
    }
  };
}

function inferSku(text: string, chipName: string, fileName: string) {
  const candidates = [
    chipName,
    fileName.replace(/\.pdf$/i, ""),
    ...(text.match(/\b[A-Z]{1,6}\d[A-Z0-9\-]{2,}\b/g) ?? [])
  ];

  return uniqueStrings(candidates)[0] ?? chipName ?? null;
}

function inferManufacturer(text: string) {
  const patterns = [
    /\b(Texas Instruments|TI)\b/i,
    /\b(Samsung)\b/i,
    /\b(Skyworks)\b/i,
    /\b(Winbond)\b/i,
    /\b(UPMicro|昂璞微|Shanghai UPMicro Microelectronics)\b/i,
    /\b(Analog Devices|ADI)\b/i,
    /\b(Infineon)\b/i,
    /\b(Qorvo)\b/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return normalizeWhitespace(match[1]);
    }
  }

  return null;
}

function inferDocumentTitle(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  const candidate = lines.find((line) => /module|datasheet|pam|front end|regulator|converter|amplifier|flash|wifi|wlan|lte|5g/i.test(line));
  return candidate ? normalizeWhitespace(candidate) : null;
}

function detectSectionHints(pageText: string) {
  const hints: string[] = [];
  if (/feature/i.test(pageText)) hints.push("features");
  if (/absolute maximum/i.test(pageText)) hints.push("absolute-maximum");
  if (/recommended operating/i.test(pageText)) hints.push("recommended-operating");
  if (/electrical characteristic/i.test(pageText)) hints.push("electrical-characteristics");
  if (/pin description|pin configuration|pin assignment/i.test(pageText)) hints.push("pinout");
  if (/layout|land pattern|application circuit/i.test(pageText)) hints.push("layout");
  if (/table/i.test(pageText)) hints.push("table");
  if (/figure|graph|typical/i.test(pageText)) hints.push("graph");
  if (!hints.length && /preliminary|datasheet/i.test(pageText)) hints.push("cover");
  return hints;
}

function detectComplexityFlags(text: string, pageTexts: string[]) {
  const merged = `${text}\n${pageTexts.join("\n")}`;
  return {
    twoColumn: /column[- ]left|column[- ]right|two column/i.test(merged),
    tableHeavy: (merged.match(/\btable\b/gi)?.length ?? 0) >= 2,
    imageHeavy: /figure|block diagram|application circuit|timing diagram/i.test(merged),
    watermarkHeavy: /preliminary|confidential|draft/i.test(merged),
    crossPageTableLikely: /table continues on next page|continued on next page/i.test(merged),
    lowTextReliability: normalizeWhitespace(text).length < 400
  };
}

function collectLocalCandidates(text: string, pageTexts: string[]) {
  const patterns = [
    {
      name: "RFFE bus",
      matchers: [/\b(\d+(?:\.\d+)?)\s*MHz\s+RFFE\s+bus\b/i]
    },
    {
      name: "Maximum Linear Output Power",
      matchers: [
        /Maximum\s+Linear\s+Output\s+Power(?:\s*\(.*?\))?\s*(\d+(?:\.\d+)?)\s*dBm/i,
        /\bup to\s*(\d+(?:\.\d+)?)\s*dBm\b/i
      ]
    },
    {
      name: "Supported bands",
      matchers: [/Table\s*\d+\.?\s*Supported bands[\s\S]{0,400}?((?:NR|LTE|WCDMA|CDMA2000|TD-SCDMA)[\s\S]{0,260})/i]
    },
    {
      name: "Package",
      matchers: [/Package(?: Size)?\s*([0-9.]+\s*mm\s*x\s*[0-9.]+\s*mm(?:\s*x\s*[0-9.]+\s*mm)?)/i]
    },
    {
      name: "Voltage - Input (Max)",
      matchers: [/input voltage(?: up to| max)?\s*(\d+(?:\.\d+)?)\s*V\b/i]
    },
    {
      name: "Current - Output",
      matchers: [/\b(\d+(?:\.\d+)?)\s*-\s*A\s+output current\b/i, /output current\s*(\d+(?:\.\d+)?)\s*A\b/i]
    },
    {
      name: "Frequency - Switching",
      matchers: [/switching frequency(?: up to)?\s*(\d+(?:\.\d+)?)\s*(kHz|MHz)\b/i]
    }
  ] as const;

  const results: DocumentPreparation["localCandidates"] = [];

  for (const pattern of patterns) {
    let found = false;
    for (let pageIndex = 0; pageIndex < pageTexts.length && !found; pageIndex += 1) {
      const pageText = pageTexts[pageIndex] ?? "";
      for (const matcher of pattern.matchers) {
        const match = pageText.match(matcher);
        if (!match) continue;

        const value =
          pattern.name === "Supported bands"
            ? normalizeWhitespace(match[1] ?? match[0])
            : pattern.name === "Frequency - Switching"
              ? `${match[1]} ${match[2]}`
              : pattern.name === "Maximum Linear Output Power"
                ? `${match[1]} dBm`
                : pattern.name === "RFFE bus"
                  ? `${match[1]} MHz`
                  : pattern.name === "Voltage - Input (Max)"
                    ? `${match[1]} V`
                    : pattern.name === "Current - Output"
                      ? `${match[1]} A`
                      : normalizeWhitespace(match[1] ?? match[0]);

        results.push({
          name: pattern.name,
          value,
          page: pageIndex + 1,
          quote: normalizeWhitespace(match[0]),
          confidence: 0.7
        });
        found = true;
        break;
      }
    }
  }

  return results;
}

function buildOdlEvidence(preparation: DocumentPreparation): EvidenceTarget[] {
  return preparation.localCandidates.map((candidate, index) => ({
    id: `ev-${index + 1}`,
    label: candidate.name,
    page: candidate.page,
    quote: candidate.quote,
    rect: {
      left: 12,
      top: 16 + index * 8,
      width: Math.min(72, Math.max(24, candidate.quote.length * 0.9)),
      height: 10
    }
  }));
}

function buildParameterItems(report: ReportOutput, evidence: EvidenceTarget[]) {
  return report.keyParameters.map((claim, index): ParameterItem => {
    const citation = claim.citations.find((entry) => entry.sourceType === "datasheet" && typeof entry.page === "number");
    const evidenceId =
      citation && evidence.find((item) => item.page === citation.page && item.quote === citation.quote)?.id
        ? evidence.find((item) => item.page === citation.page && item.quote === citation.quote)?.id ?? `llm-${index + 1}`
        : `llm-${index + 1}`;

    return {
      name: claim.label,
      value: claim.value ?? claim.body ?? "",
      evidenceId,
      status: claim.sourceType === "review" ? "needs_review" : "confirmed"
    };
  });
}

function hasDatasheetCitation(draft: ParameterDraft) {
  return (
    draft.sourceType === "datasheet" &&
    draft.citations.some(
      (entry) =>
        entry.sourceType === "datasheet" ||
        (typeof entry.page === "number" && (!("sourceType" in entry) || !entry.sourceType))
    )
  );
}

function buildParameterItemFromDraft(
  draft: ParameterDraft,
  evidence: EvidenceTarget[],
  extractedBy: ParameterItem["provenance"] extends infer _T ? "gpt4o_fast_pass" | "gemini_report_pass" | "system_reconciled" | "system_arbitrated" : never,
  status: ParameterItem["status"],
  confidenceReason: string
): ParameterItem {
  const citation = draft.citations.find((entry) => entry.sourceType === "datasheet" && typeof entry.page === "number");
  const fallbackCitation =
    citation ??
    draft.citations.find((entry) => typeof entry.page === "number" && (!("sourceType" in entry) || !entry.sourceType));
  const evidenceId =
    fallbackCitation && evidence.find((item) => item.page === fallbackCitation.page && item.quote === fallbackCitation.quote)?.id
      ? evidence.find((item) => item.page === fallbackCitation.page && item.quote === fallbackCitation.quote)?.id ?? `draft-${draft.name}`
      : `draft-${draft.name}`;

  return {
    name: draft.name,
    value: draft.value,
    evidenceId,
    status,
    provenance: {
      extractedBy,
      confidence: status === "confirmed" ? "high" : "review",
      confidenceReason,
      sourcePages: fallbackCitation?.page ? [fallbackCitation.page] : [],
      sourceQuote: fallbackCitation?.quote ?? ""
    }
  };
}

function normalizeDraftValue(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function keyParameterDraftFromClaim(claim: ReportClaim, producer: ParameterDraft["producer"]): ParameterDraft {
  return {
    name: claim.label,
    value: claim.value ?? claim.body ?? "",
    sourceType: claim.sourceType,
    citations: claim.citations,
    producer
  };
}

function isCoreTemplateField(name: string, identity: IdentityClassification) {
  return getParameterTemplate(identity.parameterTemplateId).fields.some((field) => field.name === name);
}

async function reconcileParameterDrafts(input: {
  fastDrafts: ParameterDraft[];
  reportDrafts: ParameterDraft[];
  evidence: EvidenceTarget[];
  llmProvider: LlmProvider;
  fileName: string;
  taskName: string;
  chipName: string;
  preparation: DocumentPreparation;
  identity: IdentityClassification;
}): Promise<{
  items: ParameterItem[];
  reconciliation: ParameterReconciliation;
}> {
  if (input.fastDrafts.length === 0) {
    return {
      items: input.reportDrafts
        .filter((draft) => draft.sourceType === "datasheet" || isCoreTemplateField(draft.name, input.identity))
        .map((draft) =>
          buildParameterItemFromDraft(
            draft,
            input.evidence,
            "gemini_report_pass",
            draft.sourceType === "datasheet" && hasDatasheetCitation(draft) ? "confirmed" : "needs_review",
            draft.sourceType === "datasheet" && hasDatasheetCitation(draft)
              ? "当前阶段未拿到快参数结果，沿用完整报告参数。"
              : draft.sourceType === "datasheet"
                ? "当前阶段仅有完整报告参数，但 citation 不完整，建议人工复核。"
                : "当前阶段仅有完整报告中的模板字段推断，建议人工复核。"
          )
        ),
      reconciliation: {
        fastPassCompleted: false,
        fullReportCompleted: true,
        conflictCount: 0,
        conflicts: [],
        arbitrationNotes: [],
        missingFromFastPass: input.reportDrafts.map((draft) => draft.name),
        missingFromReportPass: []
      }
    };
  }

  const fastByName = new Map(input.fastDrafts.map((draft) => [draft.name, draft]));
  const reportByName = new Map(input.reportDrafts.map((draft) => [draft.name, draft]));
  const allNames = Array.from(new Set([...fastByName.keys(), ...reportByName.keys()]));
  const items: ParameterItem[] = [];
  const conflicts: ParameterConflict[] = [];
  const arbitrationNotes: ParameterArbitrationNote[] = [];
  const missingFromFastPass: string[] = [];
  const missingFromReportPass: string[] = [];

  for (const name of allNames) {
    const fastDraft = fastByName.get(name) ?? null;
    const reportDraft = reportByName.get(name) ?? null;

    if (fastDraft && reportDraft) {
      if (normalizeDraftValue(fastDraft.value) === normalizeDraftValue(reportDraft.value)) {
        items.push(
          buildParameterItemFromDraft(
            reportDraft,
            input.evidence,
            "system_reconciled",
            "confirmed",
            "快参数与完整报告结果一致。"
          )
        );
        continue;
      }

      conflicts.push({
        fieldName: name,
        fastValue: fastDraft.value,
        reportValue: reportDraft.value,
        fastCitations: fastDraft.citations,
        reportCitations: reportDraft.citations
      });

      const arbitration = await input.llmProvider.arbitrateParameterConflict?.({
        fileName: input.fileName,
        taskName: input.taskName,
        chipName: input.chipName,
        preparation: input.preparation,
        identity: input.identity,
        parameterTemplate: getParameterTemplate(input.identity.parameterTemplateId),
        fieldName: name,
        fastDraft,
        reportDraft
      });

      if (arbitration) {
        arbitrationNotes.push(arbitration);
      }

      const decision: ArbitrationDecision = arbitration?.decision ?? "keep_both_needs_review";
      const preferredDraft =
        decision === "prefer_fast" ? fastDraft : decision === "prefer_report" ? reportDraft : reportDraft;
      const preferredValue = arbitration?.recommendedValue ?? preferredDraft.value;

      items.push({
        ...buildParameterItemFromDraft(
          {
            ...preferredDraft,
            value: preferredValue
          },
          input.evidence,
          arbitration ? "system_arbitrated" : "system_reconciled",
          "needs_review",
          arbitration?.reason ?? "系统检测到参数冲突，等待人工确认。"
        ),
        status: "needs_review"
      });
      continue;
    }

    if (reportDraft) {
      missingFromFastPass.push(name);
      if (reportDraft.sourceType === "datasheet" && reportDraft.citations.length > 0) {
        items.push(
          buildParameterItemFromDraft(
            reportDraft,
            input.evidence,
            "gemini_report_pass",
            isCoreTemplateField(name, input.identity) ? "needs_review" : "needs_review",
            "仅完整报告命中该字段，建议人工复核。"
          )
        );
      }
      continue;
    }

    if (fastDraft) {
      missingFromReportPass.push(name);
      if (fastDraft.sourceType === "datasheet" && fastDraft.citations.length > 0) {
        items.push(
          buildParameterItemFromDraft(
            fastDraft,
            input.evidence,
            "gpt4o_fast_pass",
            "needs_review",
            "仅快参数阶段命中该字段，建议等待完整报告或人工复核。"
          )
        );
      }
    }
  }

  return {
    items,
    reconciliation: {
      fastPassCompleted: true,
      fullReportCompleted: true,
      conflictCount: conflicts.length,
      conflicts,
      arbitrationNotes,
      missingFromFastPass,
      missingFromReportPass
    }
  };
}

function summarizeRisks(report: ReportOutput) {
  return report.risks
    .slice(0, 3)
    .map((risk) => risk.body || risk.label)
    .filter(Boolean)
    .join("；");
}

function fallbackDeviceClassFromTemplate(templateId: string) {
  if (templateId === "wifi") return "WiFi Front End Module";
  if (templateId === "cellular-3g4g5g") return "Cellular PAM / PA";
  if (templateId === "rf-general") return "RF";
  if (templateId === "power") return "Power";
  if (templateId === "serial-flash") return "Serial NOR Flash";
  if (templateId === "audio") return "Audio";
  return "Generic";
}

function inferTemplateIdFromReportSignals(report: ReportOutput, identity: IdentityClassification) {
  const signalText = [
    report.deviceIdentity.deviceClass,
    report.executiveSummary,
    ...report.keyParameters.flatMap((claim) => [claim.label, claim.value, claim.body, claim.title]),
    identity.deviceClass
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasWifiProtocolSignals =
    /802\.11|wi[\s-]?fi|wlan|wifi 6|wi-fi 6|wifi 7|wi-fi 7|11ax|11ac|11be|he160|vht80/.test(signalText);
  const hasWifiRfRoleSignals =
    /\bfem\b|front[- ]end module|front end module|pdet|spdt|rx\/tx|rx tx|bypass|power detector/.test(signalText);
  const hasWifiBandSignals = /2\.4\s*ghz|2\.4g\b|5\s*ghz|5ghz|5\.15|5\.85|6\s*ghz|6ghz/.test(signalText);
  const hasCellularSignals =
    /5g\s*nr|\bnr\b|\blte\b|wcdma|td-scdma|cdma2000|3gpp|\brffe\b|\bhpue\b|carrier aggregation|\bca\b/.test(signalText);
  const hasFlashSignals = /serial flash|nor flash|spi nor|qspi|qpi|\bflash\b/.test(signalText);

  if (hasFlashSignals) return "serial-flash";
  if (hasWifiProtocolSignals && (hasWifiRfRoleSignals || hasWifiBandSignals || !hasCellularSignals)) return "wifi";
  if (hasCellularSignals) return "cellular-3g4g5g";
  return null;
}

function normalizeFinalTemplateId(value: string) {
  if (
    value === "wlan-fem" ||
    value === "wifi-fem" ||
    value === "rf-fem-2.4g" ||
    value === "rf-fem-5ghz" ||
    value === "rf-fem-template"
  ) {
    return "wifi";
  }
  if (value === "cellular-pam") {
    return "cellular-3g4g5g";
  }
  if (value === "dc-dc" || value === "ldo") {
    return "power";
  }
  if (value === "spi-nor" || value === "serial-nor-flash") {
    return "serial-flash";
  }
  return value;
}

function reconcileFinalIdentity(identity: IdentityClassification, report: ReportOutput): IdentityClassification {
  const normalizedReportTemplateId = normalizeFinalTemplateId(report.deviceIdentity.parameterTemplateId || identity.parameterTemplateId);
  const signalTemplateId = inferTemplateIdFromReportSignals(report, identity);
  const reportTemplateId =
    signalTemplateId === "wifi" && normalizedReportTemplateId === "cellular-3g4g5g"
      ? "wifi"
      : signalTemplateId && ["generic-fallback", "rf-general", "power"].includes(normalizedReportTemplateId)
          ? signalTemplateId
          : normalizedReportTemplateId;
  const reportDeviceClass = (report.deviceIdentity.deviceClass || "").trim();
  const reportManufacturer = (report.deviceIdentity.manufacturer || "").trim();
  const reportPart = (report.deviceIdentity.canonicalPartNumber || "").trim();

  return {
    canonicalPartNumber: reportPart || identity.canonicalPartNumber,
    manufacturer: reportManufacturer || identity.manufacturer,
    deviceClass:
      reportDeviceClass && reportDeviceClass.toLowerCase() !== "unknown"
        ? reportDeviceClass
        : fallbackDeviceClassFromTemplate(reportTemplateId),
    parameterTemplateId: reportTemplateId,
    focusChecklist: identity.focusChecklist,
    publicContext: identity.publicContext,
    confidence: report.deviceIdentity.confidence || identity.confidence
  };
}

function normalizeReportClaims(report: ReportOutput) {
  const allClaims = [
    ...report.keyParameters,
    ...report.designFocus,
    ...report.risks,
    ...report.openQuestions,
    ...report.publicNotes,
    ...report.claims
  ];
  const normalizedClaims: ReportClaim[] = [];
  const publicNotes: ReportClaim[] = [];

  for (const claim of allClaims) {
    if (claim.sourceType === "datasheet" && claim.citations.length === 0) {
      normalizedClaims.push({
        ...claim,
        sourceType: "review",
        citations: []
      });
      continue;
    }

    if (claim.sourceType === "public") {
      publicNotes.push(claim);
    }

    normalizedClaims.push(claim);
  }

  const datasheetValues = new Map<string, string>();
  for (const claim of normalizedClaims) {
    if (claim.sourceType === "datasheet" && claim.value) {
      datasheetValues.set(claim.label, claim.value);
    }
  }

  const finalKeyParameters = normalizedClaims
    .filter((claim) => typeof claim.value === "string" && claim.value.length > 0)
    .filter((claim) => {
      if (claim.sourceType !== "public") return true;
      const datasheetValue = datasheetValues.get(claim.label);
      return !datasheetValue || datasheetValue === claim.value;
    });

  const mergedPublicNotes = [
    ...publicNotes,
    ...normalizedClaims.filter(
      (claim) =>
        claim.sourceType === "public" &&
        Boolean(datasheetValues.get(claim.label)) &&
        datasheetValues.get(claim.label) !== claim.value
    )
  ].filter((claim, index, list) => list.findIndex((item) => item.id === claim.id) === index);

  return {
    ...report,
    keyParameters: finalKeyParameters,
    publicNotes: mergedPublicNotes,
    claims: normalizedClaims,
    citations: normalizedClaims.flatMap((claim) => claim.citations)
  };
}

function buildFailedResult(
  message: string,
  preparation: DocumentPreparation,
  runtime: {
    llmProvider: string | null;
    llmModel: string | null;
    pipelineMode: "single" | "staged" | null;
  } = {
    llmProvider: null,
    llmModel: null,
    pipelineMode: null
  }
): AnalysisJobResult {
  const llmTarget = runtime.llmProvider && runtime.llmModel ? `${runtime.llmProvider}/${runtime.llmModel}` : null;
  const documentPath = preparation.documentMeta.extractionMethod === "opendataloader" ? "pdf_direct" : "unknown";
  const analysis: AnalysisResult = {
    summary: message,
    review: message,
    keyParameters: [],
    evidence: [],
    identity: null,
    report: null,
    preparationMeta: {
      pageCount: preparation.documentMeta.pageCount,
      textCoverage: preparation.documentMeta.textCoverage,
      extractionMethod: preparation.documentMeta.extractionMethod,
      localCandidateCount: preparation.localCandidates.length,
      complexityFlags: preparation.complexityFlags
    },
    sourceAttribution: {
      mode: "failed",
      llmProvider: runtime.llmProvider,
      llmTarget,
      searchProvider: null,
      documentPath,
      pipelineMode: runtime.pipelineMode
    }
  };

  return {
    status: "failed",
    warnings: [message],
    analysis
  };
}

function buildRuntimeDocumentPath(input: {
  llmProvider: string | null;
  extractionMethod: DocumentPreparation["documentMeta"]["extractionMethod"];
  hasLlmProvider: boolean;
}): "pdf_direct" | "image_fallback" | "unknown" {
  if (!input.hasLlmProvider) {
    return "unknown";
  }

  if (input.extractionMethod === "opendataloader") {
    return "pdf_direct";
  }

  if (input.llmProvider === "openai" || input.llmProvider === "lyapi" || input.llmProvider === "vectorengine" || input.llmProvider === "custom") {
    return "pdf_direct";
  }

  if (input.llmProvider === "gemini") {
    return "pdf_direct";
  }

  return "unknown";
}

async function resolveWithTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const controller = new AbortController();
  const wrappedPromise = promiseFactory(controller.signal).catch((error) => {
    if (controller.signal.aborted) {
      return null as T | null;
    }

    throw error;
  });

  try {
    return await Promise.race([
      wrappedPromise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          controller.abort(new Error("timeout"));
          resolve(null);
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function extractTextWithOpenDataLoader(input: AnalyzePdfInput) {
  try {
    const { convert } = await import("@opendataloader/pdf");
    const tempDir = join(tmpdir(), `odl-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });
    const inputPath = join(tempDir, input.fileName);
    const outputDir = join(tempDir, "output");
    mkdirSync(outputDir, { recursive: true });
    await writeFile(inputPath, Buffer.from(input.buffer));

    try {
      await convert(inputPath, {
        outputDir,
        format: "json",
        quiet: true,
        readingOrder: "xycut",
        tableMethod: "cluster",
        useStructTree: true
      });

      const jsonPath = join(outputDir, `${basename(input.fileName, ".pdf")}.json`);
      const json = JSON.parse(readFileSync(jsonPath, "utf8")) as
        | {
            pages?: Array<{
              page?: number;
              blocks?: Array<{ text?: string }>;
              text?: string;
            }>;
            text?: string;
          }
        | Array<{
            ["page number"]?: number;
            content?: string;
            description?: string;
            type?: string;
          }>;

      const pageTextMap = new Map<number, string[]>();

      if (Array.isArray(json)) {
        for (const entry of json) {
          const pageNumber = typeof entry["page number"] === "number" ? entry["page number"] : 1;
          const content = normalizeWhitespace(entry.content ?? entry.description ?? "");
          if (!content) continue;
          pageTextMap.set(pageNumber, [...(pageTextMap.get(pageNumber) ?? []), content]);
        }
      } else {
        for (const [index, page] of (json.pages ?? []).entries()) {
          const blockText = page.blocks?.map((block) => normalizeWhitespace(block.text ?? "")).filter(Boolean).join("\n");
          const text = normalizeWhitespace(page.text ?? "");
          const pageNumber = page.page ?? index + 1;
          const content = blockText || text;
          if (!content) continue;
          pageTextMap.set(pageNumber, [...(pageTextMap.get(pageNumber) ?? []), content]);
        }
      }

      const pageTexts = [...pageTextMap.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([, entries]) => normalizeWhitespace(entries.join("\n")))
        .filter(Boolean);
      const text = normalizeWhitespace(Array.isArray(json) ? pageTexts.join("\n") : (json.text ?? pageTexts.join("\n")));

      if (!text) return null;

      return {
        text,
        pageTexts,
        pageCount: pageTexts.length
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  } catch {
    return null;
  }
}

export async function prepareDocumentForAnalysis(
  input: AnalyzePdfInput,
  dependencies: AnalyzePdfDependencies = {}
): Promise<DocumentPreparation> {
  const fallbackPageCount = (await Promise.resolve()
    .then(() => dependencies.pdfTextExtractor?.(input))
    .then((result) => result?.pageCount ?? null)
    .catch(() => null)) ?? (await readPdfPageCount(input.buffer)) ?? 1;

  if (process.env.ANALYSIS_ENABLE_ODL !== "true") {
    return {
      ...emptyPreparation(input),
      documentMeta: {
        ...emptyPreparation(input).documentMeta,
        pageCount: fallbackPageCount
      }
    };
  }

  const extraction = await resolveWithTimeout(
    async () =>
      Promise.resolve()
      .then(() => (dependencies.opendataloaderExtractor ?? extractTextWithOpenDataLoader)(input))
      .catch(() => null),
    ODL_TIMEOUT_MS
  );

  if (!extraction?.text) {
    return {
      ...emptyPreparation(input),
      documentMeta: {
        ...emptyPreparation(input).documentMeta,
        pageCount: fallbackPageCount
      }
    };
  }

  const pageTexts = extraction.pageTexts.filter(Boolean);
  const text = extraction.text;
  const titleSource = pageTexts.slice(0, 2).join("\n") || text;

  return {
    identityCandidates: {
      sku: inferSku(text, input.chipName, input.fileName),
      manufacturer: inferManufacturer(text),
      documentTitle: inferDocumentTitle(titleSource),
      aliases: uniqueStrings([input.chipName, input.fileName.replace(/\.pdf$/i, ""), inferSku(text, input.chipName, input.fileName)])
    },
    documentMeta: {
      fileName: input.fileName,
      pageCount: extraction.pageCount ?? pageTexts.length ?? fallbackPageCount,
      textCoverage: text.length,
      extractionMethod: "opendataloader"
    },
    pagePackets: pageTexts.map((pageText, index) => ({
      page: index + 1,
      text: pageText,
      sectionHints: detectSectionHints(pageText),
      isHardPage: /table|figure|preliminary|continued on next page|column/i.test(pageText)
    })),
    localCandidates: collectLocalCandidates(text, pageTexts),
    complexityFlags: detectComplexityFlags(text, pageTexts)
  };
}

export async function classifyDocumentIdentity(input: {
  pdfBuffer: Uint8Array;
  fileName: string;
  taskName: string;
  chipName: string;
  preparation?: DocumentPreparation;
  llmProvider: LlmProvider;
  searchProvider?: SearchProvider | null;
  signal?: AbortSignal;
}): Promise<IdentityClassification> {
  const preparation = input.preparation ?? emptyPreparation({
    fileName: input.fileName,
    taskName: input.taskName,
    chipName: input.chipName,
    buffer: input.pdfBuffer
  });

  const searchContext = input.searchProvider
    ? await input.searchProvider.searchPartContext({
        sku: preparation.identityCandidates.sku ?? input.chipName,
        manufacturer: preparation.identityCandidates.manufacturer
      })
    : [];

  const identity = await input.llmProvider.classifyIdentity({
    pdfBuffer: Uint8Array.from(input.pdfBuffer),
    fileName: input.fileName,
    taskName: input.taskName,
    chipName: input.chipName,
    preparation,
    publicContext: searchContext,
    signal: input.signal
  });

  return {
    ...identity,
    publicContext: identity.publicContext.length ? identity.publicContext : searchContext
  };
}

export async function synthesizeEvidenceReport(input: {
  pdfBuffer: Uint8Array;
  fileName: string;
  taskName: string;
  chipName: string;
  preparation?: DocumentPreparation;
  identity: IdentityClassification;
  publicContext: PublicContext[];
  llmProvider: LlmProvider;
  parameterTemplate?: ReturnType<typeof getParameterTemplate>;
  signal?: AbortSignal;
}): Promise<ReportOutput> {
  const preparation = input.preparation ?? emptyPreparation({
    fileName: input.fileName,
    taskName: input.taskName,
    chipName: input.chipName,
    buffer: input.pdfBuffer
  });
  const report = await input.llmProvider.synthesizeReport({
    pdfBuffer: Uint8Array.from(input.pdfBuffer),
    fileName: input.fileName,
    taskName: input.taskName,
    chipName: input.chipName,
    preparation,
    identity: input.identity,
    parameterTemplate: input.parameterTemplate ?? getParameterTemplate(input.identity.parameterTemplateId),
    publicContext: input.publicContext,
    signal: input.signal
  });

  return normalizeReportClaims(report);
}

export async function analyzePdfBuffer(
  input: AnalyzePdfInput,
  dependencies: AnalyzePdfDependencies = {}
): Promise<AnalysisJobResult> {
  const pipelineStartedAtMs = Date.now();
  const configured = resolveConfiguredProviders();
  const llmProvider = dependencies.llmProvider ?? configured.llmProvider;
  const searchProvider = dependencies.searchProvider ?? configured.searchProvider;
  const preparationBuffer = Uint8Array.from(input.buffer);
  const llmBuffer = Uint8Array.from(input.buffer);
  const llmTimeoutMs = dependencies.llmTimeoutMs ?? LLM_TIMEOUT_MS;
  const runtimeLlmProvider = configured.llmProviderName ?? (dependencies.llmProvider ? "custom" : null);
  const runtimeLlmModel = configured.llmModelName ?? (dependencies.llmProvider ? "gpt-4.1" : null);
  const runtimeLlmTarget = runtimeLlmProvider && runtimeLlmModel ? `${runtimeLlmProvider}/${runtimeLlmModel}` : null;
  const runtimeSearchProvider = searchProvider ? configured.searchProviderName ?? "custom" : null;
  logAnalysisEvent("analysis.pipeline.started", {
    fileName: input.fileName,
    taskName: input.taskName,
    chipName: input.chipName,
    llmProvider: runtimeLlmProvider,
    llmModel: configured.llmModelName ?? null,
    llmTarget: runtimeLlmTarget,
    documentPath: "unknown",
    pipelineMode: configured.pipelineMode,
    searchProvider: runtimeSearchProvider
  });
  const preparation = await prepareDocumentForAnalysis(
    {
      ...input,
      buffer: preparationBuffer
    },
    dependencies
  );
  const runtimeDocumentPath = buildRuntimeDocumentPath({
    llmProvider: runtimeLlmProvider,
    extractionMethod: preparation.documentMeta.extractionMethod,
    hasLlmProvider: Boolean(llmProvider)
  });
  const runtimeLogContext = {
    llmProvider: runtimeLlmProvider,
    llmTarget: runtimeLlmTarget,
    searchProvider: runtimeSearchProvider,
    documentPath: runtimeDocumentPath,
    pipelineMode: configured.pipelineMode
  };
  logAnalysisEvent("analysis.preparation.completed", {
    fileName: input.fileName,
    taskName: input.taskName,
    extractionMethod: preparation.documentMeta.extractionMethod,
    pageCount: preparation.documentMeta.pageCount,
    localCandidateCount: preparation.localCandidates.length,
    ...runtimeLogContext,
    elapsedMs: elapsedMs(pipelineStartedAtMs)
  });

  if (!llmProvider) {
    logAnalysisEvent(
      "analysis.pipeline.failed",
      {
        fileName: input.fileName,
        taskName: input.taskName,
        reason: "missing_llm_provider",
        ...runtimeLogContext,
        elapsedMs: elapsedMs(pipelineStartedAtMs)
      },
      "error"
    );
    return buildFailedResult(MISSING_PROVIDER_FAILURE, preparation, {
      llmProvider: runtimeLlmProvider,
      llmModel: runtimeLlmModel,
      pipelineMode: configured.pipelineMode
    });
  }

  try {
    const identityStartedAtMs = Date.now();
    const identity = await resolveWithTimeout(
      (signal) => classifyDocumentIdentity({
        pdfBuffer: Uint8Array.from(llmBuffer),
        fileName: input.fileName,
        taskName: input.taskName,
        chipName: input.chipName,
        preparation,
        llmProvider,
        searchProvider,
        signal
      }),
      llmTimeoutMs
    );
    if (!identity) {
      logAnalysisEvent(
        "analysis.pipeline.failed",
        {
          fileName: input.fileName,
          taskName: input.taskName,
          stage: "classify_identity",
          reason: "timeout",
          ...runtimeLogContext,
          elapsedMs: elapsedMs(identityStartedAtMs),
          totalElapsedMs: elapsedMs(pipelineStartedAtMs)
        },
        "error"
      );
      return buildFailedResult(LLM_TIMEOUT_FAILURE, preparation, {
        llmProvider: runtimeLlmProvider,
        llmModel: runtimeLlmModel,
        pipelineMode: configured.pipelineMode
      });
    }
    logAnalysisEvent("analysis.stage.completed", {
      fileName: input.fileName,
      taskName: input.taskName,
      stage: "classify_identity",
      parameterTemplateId: identity.parameterTemplateId,
      ...runtimeLogContext,
      elapsedMs: elapsedMs(identityStartedAtMs),
      totalElapsedMs: elapsedMs(pipelineStartedAtMs)
    });

    const evidence = preparation.documentMeta.extractionMethod === "opendataloader" ? buildOdlEvidence(preparation) : [];
    const parameterTemplate = getParameterTemplate(identity.parameterTemplateId);
    const useStagedPipeline = configured.pipelineMode === "staged";
    const reportProducer = configured.llmModelName ?? "llm";

    if (!useStagedPipeline) {
      const reportStartedAtMs = Date.now();
      const report = await resolveWithTimeout(
        (signal) => synthesizeEvidenceReport({
          pdfBuffer: Uint8Array.from(llmBuffer),
          fileName: input.fileName,
          taskName: input.taskName,
          chipName: input.chipName,
          preparation,
          identity,
          parameterTemplate,
          publicContext: identity.publicContext,
          llmProvider,
          signal
        }),
        llmTimeoutMs
      );
      if (!report) {
        logAnalysisEvent(
          "analysis.pipeline.failed",
          {
            fileName: input.fileName,
            taskName: input.taskName,
            stage: "synthesize_report",
            reason: "timeout",
            ...runtimeLogContext,
            pipelineMode: configured.pipelineMode,
            elapsedMs: elapsedMs(reportStartedAtMs),
            totalElapsedMs: elapsedMs(pipelineStartedAtMs)
          },
          "error"
        );
        return buildFailedResult(LLM_TIMEOUT_FAILURE, preparation, {
        llmProvider: runtimeLlmProvider,
        llmModel: runtimeLlmModel,
        pipelineMode: configured.pipelineMode
      });
      }

      logAnalysisEvent("analysis.stage.completed", {
        fileName: input.fileName,
        taskName: input.taskName,
        stage: "synthesize_report",
        ...runtimeLogContext,
        pipelineMode: configured.pipelineMode,
        claimCount: report.claims.length,
        keyParameterCount: report.keyParameters.length,
        elapsedMs: elapsedMs(reportStartedAtMs),
        totalElapsedMs: elapsedMs(pipelineStartedAtMs)
      });

      const finalIdentity = reconcileFinalIdentity(identity, report);
      const reportDrafts = report.keyParameters.map((claim) => keyParameterDraftFromClaim(claim, reportProducer));
      const singleModeItems =
        reportDrafts.length > 0
          ? reportDrafts
              .filter((draft) => draft.sourceType === "datasheet" || isCoreTemplateField(draft.name, identity))
              .map((draft) =>
                buildParameterItemFromDraft(
                  draft,
                  evidence,
                  "gemini_report_pass",
                  draft.sourceType === "datasheet" && hasDatasheetCitation(draft) ? "confirmed" : "needs_review",
                  draft.sourceType === "datasheet" && hasDatasheetCitation(draft)
                    ? "单模型完整报告已生成，当前参数可直接回查 datasheet。"
                    : "单模型完整报告已生成，但当前字段仍建议人工复核。"
                )
              )
          : buildParameterItems(report, evidence);

      const analysis: AnalysisResult = addInitialAnalysisMetadata(
        {
          pipelineMode: "single",
          summary: report.executiveSummary,
          review: summarizeRisks(report) || "当前结果来自单模型完整报告；datasheet 事实优先，公网补充已单独标记。",
          keyParameters: singleModeItems,
          evidence,
          identity: finalIdentity,
          report,
          parameterReconciliation: null,
          fastParametersReadyAt: null,
          fullReportReadyAt: new Date().toISOString(),
          preparationMeta: {
            pageCount: preparation.documentMeta.pageCount,
            textCoverage: preparation.documentMeta.textCoverage,
            extractionMethod: preparation.documentMeta.extractionMethod,
            localCandidateCount: preparation.localCandidates.length,
            complexityFlags: preparation.complexityFlags
          },
          sourceAttribution: {
            mode: preparation.documentMeta.extractionMethod === "opendataloader" ? "llm_first_with_odl" : "llm_first",
            ...runtimeLogContext,
            pipelineMode: "single"
          }
        },
        preparation.documentMeta.extractionMethod === "opendataloader" ? "opendataloader" : "gemini_report_pass"
      );

      logAnalysisEvent("analysis.pipeline.completed", {
        fileName: input.fileName,
        taskName: input.taskName,
        status: "complete",
        ...runtimeLogContext,
        pipelineMode: configured.pipelineMode,
        preparationMethod: preparation.documentMeta.extractionMethod,
        keyParameterCount: analysis.keyParameters.length,
        evidenceCount: analysis.evidence.length,
        totalElapsedMs: elapsedMs(pipelineStartedAtMs)
      });

      return {
        status: "complete",
        warnings: [],
        analysis
      };
    }

    const fastParameterStartedAtMs = Date.now();
    const fastDrafts = await resolveWithTimeout(
      async (signal) =>
        Promise.resolve(
        llmProvider.extractKeyParameters?.({
          pdfBuffer: Uint8Array.from(llmBuffer),
          fileName: input.fileName,
          taskName: input.taskName,
          chipName: input.chipName,
          preparation,
          identity,
          parameterTemplate,
          publicContext: identity.publicContext,
          signal
        }) ?? []
      ),
      llmTimeoutMs
    );
    if (!fastDrafts) {
      logAnalysisEvent(
        "analysis.pipeline.failed",
        {
          fileName: input.fileName,
          taskName: input.taskName,
          stage: "extract_fast_parameters",
          reason: "timeout",
          ...runtimeLogContext,
          elapsedMs: elapsedMs(fastParameterStartedAtMs),
          totalElapsedMs: elapsedMs(pipelineStartedAtMs)
        },
        "error"
      );
      return buildFailedResult(LLM_TIMEOUT_FAILURE, preparation, {
        llmProvider: runtimeLlmProvider,
        llmModel: runtimeLlmModel,
        pipelineMode: configured.pipelineMode
      });
    }
    logAnalysisEvent("analysis.stage.completed", {
      fileName: input.fileName,
      taskName: input.taskName,
      stage: "extract_fast_parameters",
      ...runtimeLogContext,
      keyParameterCount: fastDrafts.length,
      elapsedMs: elapsedMs(fastParameterStartedAtMs),
      totalElapsedMs: elapsedMs(pipelineStartedAtMs)
    });

    const fastParametersReadyAt = new Date().toISOString();
    if (fastDrafts.length > 0) {
      const fastPassAnalysis: AnalysisResult = addInitialAnalysisMetadata(
        {
          summary: "",
          review: "",
          pipelineMode: "staged",
          keyParameters: fastDrafts.map((draft) =>
            buildParameterItemFromDraft(
              draft,
              evidence,
              "gpt4o_fast_pass",
              "needs_review",
              "来自 4o 快参数初稿，完整报告仍在整理。"
            )
          ),
          evidence,
          identity,
          report: null,
          parameterReconciliation: {
            fastPassCompleted: true,
            fullReportCompleted: false,
            conflictCount: 0,
            conflicts: [],
            arbitrationNotes: [],
            missingFromFastPass: [],
            missingFromReportPass: []
          },
          fastParametersReadyAt,
          fullReportReadyAt: null,
          preparationMeta: {
            pageCount: preparation.documentMeta.pageCount,
            textCoverage: preparation.documentMeta.textCoverage,
            extractionMethod: preparation.documentMeta.extractionMethod,
            localCandidateCount: preparation.localCandidates.length,
            complexityFlags: preparation.complexityFlags
          },
          sourceAttribution: {
            mode: preparation.documentMeta.extractionMethod === "opendataloader" ? "llm_first_with_odl" : "llm_first",
            ...runtimeLogContext,
            pipelineMode: "staged"
          }
        },
        "gpt4o_fast_pass"
      );

      dependencies.onProgress?.({
        status: "processing",
        warnings: ["参数初稿已生成，完整报告仍在整理。"],
        analysis: fastPassAnalysis
      });
    }

    const reportStartedAtMs = Date.now();
    const report = await resolveWithTimeout(
      (signal) => synthesizeEvidenceReport({
        pdfBuffer: Uint8Array.from(llmBuffer),
        fileName: input.fileName,
        taskName: input.taskName,
        chipName: input.chipName,
        preparation,
        identity,
        parameterTemplate,
        publicContext: identity.publicContext,
        llmProvider,
        signal
      }),
      llmTimeoutMs
    );
    if (!report) {
      if (fastDrafts.length === 0) {
        logAnalysisEvent(
          "analysis.pipeline.failed",
          {
            fileName: input.fileName,
            taskName: input.taskName,
            stage: "synthesize_report",
            reason: "timeout_without_fast_parameters",
            ...runtimeLogContext,
            elapsedMs: elapsedMs(reportStartedAtMs),
            totalElapsedMs: elapsedMs(pipelineStartedAtMs)
          },
          "error"
        );
        return buildFailedResult(LLM_TIMEOUT_FAILURE, preparation, {
        llmProvider: runtimeLlmProvider,
        llmModel: runtimeLlmModel,
        pipelineMode: configured.pipelineMode
      });
      }

      logAnalysisEvent("analysis.pipeline.partial", {
        fileName: input.fileName,
        taskName: input.taskName,
        stage: "synthesize_report",
        reason: "timeout_after_fast_parameters",
        ...runtimeLogContext,
        elapsedMs: elapsedMs(reportStartedAtMs),
        totalElapsedMs: elapsedMs(pipelineStartedAtMs)
      });

      const partialAnalysis: AnalysisResult = addInitialAnalysisMetadata(
        {
          summary: "",
          review: "",
          pipelineMode: "staged",
          keyParameters: fastDrafts.map((draft) =>
            buildParameterItemFromDraft(
              draft,
              evidence,
              "gpt4o_fast_pass",
              "needs_review",
              "来自 4o 快参数初稿，完整报告仍在整理。"
            )
          ),
          evidence,
          identity,
          report: null,
          parameterReconciliation: {
            fastPassCompleted: true,
            fullReportCompleted: false,
            conflictCount: 0,
            conflicts: [],
            arbitrationNotes: [],
            missingFromFastPass: [],
            missingFromReportPass: []
          },
          fastParametersReadyAt,
          fullReportReadyAt: null,
          preparationMeta: {
            pageCount: preparation.documentMeta.pageCount,
            textCoverage: preparation.documentMeta.textCoverage,
            extractionMethod: preparation.documentMeta.extractionMethod,
            localCandidateCount: preparation.localCandidates.length,
            complexityFlags: preparation.complexityFlags
          },
          sourceAttribution: {
            mode: preparation.documentMeta.extractionMethod === "opendataloader" ? "llm_first_with_odl" : "llm_first",
            ...runtimeLogContext,
            pipelineMode: "staged"
          }
        },
        "gpt4o_fast_pass"
      );

      const partialResult = {
        status: "partial",
        warnings: ["参数初稿已生成，完整报告仍在整理。"],
        analysis: partialAnalysis
      } satisfies AnalysisJobResult;

      dependencies.onProgress?.(partialResult);
      return partialResult;
    }
    logAnalysisEvent("analysis.stage.completed", {
      fileName: input.fileName,
      taskName: input.taskName,
      stage: "synthesize_report",
      ...runtimeLogContext,
      claimCount: report.claims.length,
      keyParameterCount: report.keyParameters.length,
      elapsedMs: elapsedMs(reportStartedAtMs),
      totalElapsedMs: elapsedMs(pipelineStartedAtMs)
    });

    const finalIdentity = reconcileFinalIdentity(identity, report);
    const reportDrafts = report.keyParameters.map((claim) => keyParameterDraftFromClaim(claim, reportProducer));
    const reconciled = await reconcileParameterDrafts({
      fastDrafts,
      reportDrafts,
      evidence,
      llmProvider,
      fileName: input.fileName,
      taskName: input.taskName,
      chipName: input.chipName,
      preparation,
      identity
    });
    const analysis: AnalysisResult = addInitialAnalysisMetadata(
      {
        pipelineMode: "staged",
        summary: report.executiveSummary,
        review: summarizeRisks(report) || "主结论由 LLM-first 教学式报告生成；datasheet 事实优先，公网补充已单独标记。",
        keyParameters: reconciled.items,
        evidence,
        identity: finalIdentity,
        report,
        parameterReconciliation: reconciled.reconciliation,
        fastParametersReadyAt,
        fullReportReadyAt: new Date().toISOString(),
        preparationMeta: {
          pageCount: preparation.documentMeta.pageCount,
          textCoverage: preparation.documentMeta.textCoverage,
          extractionMethod: preparation.documentMeta.extractionMethod,
          localCandidateCount: preparation.localCandidates.length,
          complexityFlags: preparation.complexityFlags
        },
        sourceAttribution: {
          mode: preparation.documentMeta.extractionMethod === "opendataloader" ? "llm_first_with_odl" : "llm_first",
          ...runtimeLogContext
        }
      },
      preparation.documentMeta.extractionMethod === "opendataloader" ? "opendataloader" : "gemini_report_pass"
    );

    logAnalysisEvent("analysis.pipeline.completed", {
      fileName: input.fileName,
      taskName: input.taskName,
      status: "complete",
      ...runtimeLogContext,
      pipelineMode: configured.pipelineMode,
      preparationMethod: preparation.documentMeta.extractionMethod,
      keyParameterCount: analysis.keyParameters.length,
      evidenceCount: analysis.evidence.length,
      totalElapsedMs: elapsedMs(pipelineStartedAtMs)
    });
    return {
      status: "complete",
      warnings: [],
      analysis
    };
  } catch (error) {
    logAnalysisEvent(
      "analysis.pipeline.failed",
      {
        fileName: input.fileName,
        taskName: input.taskName,
        reason: error instanceof Error ? error.message : "unknown_error",
        ...runtimeLogContext,
        totalElapsedMs: elapsedMs(pipelineStartedAtMs)
      },
      "error"
    );
    return buildFailedResult(GENERIC_LLM_FAILURE, preparation, {
      llmProvider: runtimeLlmProvider,
      llmModel: runtimeLlmModel,
      pipelineMode: configured.pipelineMode
    });
  }
}

export async function answerAnalysisFollowUp(input: {
  pdfBuffer: Uint8Array;
  fileName: string;
  taskName: string;
  chipName: string;
  question: string;
  analysis: AnalysisResult;
  llmProvider?: LlmProvider | null;
}): Promise<FollowUpResponse> {
  const configured = resolveConfiguredProviders();
  const llmProvider = input.llmProvider ?? configured.llmProvider;

  if (!llmProvider) {
    throw new Error(MISSING_PROVIDER_FAILURE);
  }

  if (!input.analysis.identity || !input.analysis.report) {
    throw new Error("analysis context is incomplete for follow-up");
  }

  const preparation = emptyPreparation({
    fileName: input.fileName,
    taskName: input.taskName,
    chipName: input.chipName,
    buffer: input.pdfBuffer
  });

  const response = await llmProvider.answerFollowUp({
    pdfBuffer: Uint8Array.from(input.pdfBuffer),
    fileName: input.fileName,
    taskName: input.taskName,
    chipName: input.chipName,
    preparation,
    identity: input.analysis.identity,
    parameterTemplate: getParameterTemplate(input.analysis.identity.parameterTemplateId),
    report: input.analysis.report,
    keyParameters: input.analysis.keyParameters,
    publicContext: input.analysis.identity.publicContext,
    question: input.question
  });

  return {
    ...response,
    sourceAttribution: response.sourceAttribution ?? input.analysis.sourceAttribution ?? null
  };
}
