"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import { applyParameterActionToAnalysis } from "@/lib/analysis-audit";
import { buildAnalysisHtml, buildAnalysisJson, buildParameterTable } from "@/lib/exports";
import { displayParameterName } from "@/lib/parameter-labels";
import { validateUploadedFile } from "@/lib/upload-validation";
import type {
  AnalysisJobResult,
  AnalysisJobSnapshot,
  AnalysisResult,
  ClaimCitation,
  EvidenceTarget,
  FollowUpMessage,
  FollowUpResponse,
  ParameterItem,
  RecentAnalysisJob,
  ReportClaim,
  UploadedPdf
} from "@/lib/types";

type TaskStepKind =
  | "task_received"
  | "identity_ready"
  | "intelligent_analysis"
  | "result_ready"
  | "fast_parameters_ready"
  | "full_report_ready"
  | "reconciliation_ready";
type TaskStepStatus = "pending" | "active" | "done" | "error";

type TaskStep = {
  id: string;
  kind: TaskStepKind;
  status: TaskStepStatus;
  title: string;
  detail: string;
};

type TaskThreadMessage = {
  id: string;
  role: "assistant";
  kind: "task";
  pdf: UploadedPdf;
  updatedAt: string;
  steps: TaskStep[];
  status: AnalysisJobResult["status"] | "processing";
  warnings: string[];
  note?: string;
};

type ParameterActionPayload = {
  jobId: string;
  parameterName: string;
  evidenceId: string;
  action: "confirm" | "edit";
  nextValue?: string;
};

type WritebackStateItem = {
  status: "saving" | "failed";
  action: ParameterActionPayload["action"];
  nextValue?: string;
};

type RecentTaskCard = {
  jobId: string;
  status: AnalysisJobResult["status"];
  updatedAt: string;
  taskName: string;
  chipName: string;
  fileName: string;
};

type CurrentUser = {
  username: string;
  displayName: string;
};

type ChatMessage =
  | {
      id: string;
      role: "assistant";
      kind: "welcome";
      content: string;
    }
  | TaskThreadMessage
  | {
      id: string;
      role: "assistant";
      kind: "correction";
      content: string;
    }
  | {
      id: string;
    role: "user" | "assistant";
    kind: "text";
    content: string;
    claims?: ReportClaim[];
    warnings?: string[];
    usedSources?: Array<"datasheet" | "public" | "review">;
    };

type AuditEventPayload = {
  eventType: "export_json" | "export_html" | "export_csv";
  jobId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
};

function createWelcomeMessage(): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    kind: "welcome",
    content: "创建一个 datasheet 任务，上传一份数据手册，我会先给你可回查证据的总结、参数和导出结果。"
  };
}

function deriveBaseName(fileName: string) {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\bdata\s*sheet\b/gi, " ")
    .replace(/\bdatasheet\b/gi, " ")
    .replace(/\bv(?:er(?:sion)?)?\s*\d+(?:\.\d+)*\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createUploadedPdf(file: File): UploadedPdf {
  const baseName = deriveBaseName(file.name);
  const chipName = baseName || file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
  return {
    id: `pdf-${Date.now()}`,
    taskName: `${chipName} 初步分析`,
    chipName: chipName.toUpperCase().includes("LMR51430") ? "LMR51430" : chipName,
    fileName: file.name,
    pageCount: 0,
    objectUrl: URL.createObjectURL(file)
  };
}

function createUploadedPdfFromJob(jobId: string, snapshot: AnalysisJobSnapshot): UploadedPdf | null {
  if (!snapshot.documentMeta || !snapshot.pdfUrl) {
    return null;
  }

  return {
    id: `pdf-${jobId}`,
    taskName: snapshot.documentMeta.taskName,
    chipName: snapshot.documentMeta.chipName,
    fileName: snapshot.documentMeta.fileName,
    pageCount: resolveSnapshotPageCount(snapshot, snapshot.documentMeta.pageCount),
    objectUrl: snapshot.pdfUrl
  };
}

function previewUrl(pdf: UploadedPdf, evidence: EvidenceTarget | null) {
  const page = evidence?.page ?? 1;
  return `${pdf.objectUrl}#page=${page}`;
}

function statusLabel(status: ParameterItem["status"]) {
  if (status === "confirmed") return "已确认";
  if (status === "user_corrected") return "用户已修正";
  return "待确认";
}

function statusHint(status: ParameterItem["status"]) {
  if (status === "needs_review") return "建议回查原文后再确认或修改";
  if (status === "user_corrected") return "当前值已被人工修正，可继续作为工作结论使用";
  return "当前字段已进入可继续引用的初步分析结果";
}

function parsePositivePageCount(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveDocumentPageCount(defaultPageCount: number, analysis?: AnalysisResult | null) {
  const preparationPageCount = parsePositivePageCount(analysis?.preparationMeta?.pageCount);
  if (preparationPageCount) {
    return preparationPageCount;
  }

  const pageParameter = analysis?.keyParameters.find((item) => item.name === "Document pages");
  const parameterPageCount = parsePositivePageCount(pageParameter?.value);
  return parameterPageCount ?? defaultPageCount;
}

function resolveSnapshotPageCount(snapshot: Pick<AnalysisJobSnapshot, "documentMeta" | "analysis">, defaultPageCount: number) {
  const documentPageCount = parsePositivePageCount(snapshot.documentMeta?.pageCount);
  if (documentPageCount) {
    return documentPageCount;
  }

  return resolveDocumentPageCount(defaultPageCount, snapshot.analysis);
}

function hasVisibleText(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasDisplayableReportContent(report: AnalysisResult["report"]) {
  if (!report) {
    return false;
  }

  if (hasVisibleText(report.executiveSummary)) {
    return true;
  }

  return report.sections.some((section) => hasVisibleText(section.title) || hasVisibleText(section.body));
}

function hasDisplayableSummaryContent(analysis?: AnalysisResult | null) {
  if (!analysis) {
    return false;
  }

  return hasVisibleText(analysis.summary) || hasVisibleText(analysis.review);
}

function hasDisplayableResultContent(analysis?: AnalysisResult | null) {
  if (!analysis) {
    return false;
  }

  return hasDisplayableReportContent(analysis.report) || hasDisplayableSummaryContent(analysis);
}

function hasFastParameterStage(analysis?: AnalysisResult | null) {
  return Boolean(analysis?.parameterReconciliation?.fastPassCompleted && !analysis?.parameterReconciliation?.fullReportCompleted);
}

function hasFullReportStage(analysis?: AnalysisResult | null) {
  if (!analysis) {
    return false;
  }

  if (analysis.parameterReconciliation?.fullReportCompleted === false) {
    return false;
  }

  if (analysis.report) {
    return true;
  }

  return !analysis.parameterReconciliation && hasDisplayableResultContent(analysis);
}

function suggestionPrompts(analysis: AnalysisResult) {
  const firstReviewItem = prioritizeParameters(analysis.keyParameters).find((item) => item.status === "needs_review");

  return [
    "总结这份数据手册",
    "适用场景有哪些？",
    firstReviewItem
      ? `${displayParameterName(firstReviewItem.name)} 这个参数需要重点确认什么？`
      : "主要功能和限制是什么？"
  ];
}

function sourceTypeLabel(sourceType: "datasheet" | "public" | "review") {
  if (sourceType === "datasheet") return "Datasheet";
  if (sourceType === "public") return "Public";
  return "Review";
}

function riskGroupTitle(sourceType: "evidence" | "review") {
  return sourceType === "evidence" ? "待回查原文" : "分析判断";
}

function firstCitationPage(citations: ClaimCitation[]) {
  return citations.find((citation) => citation.sourceType === "datasheet" && citation.page)?.page ?? null;
}

function sourceListLabel(usedSources: Array<"datasheet" | "public" | "review">) {
  return `Sources: ${usedSources
    .map((item) => (item === "datasheet" ? "Datasheet" : item === "public" ? "Public" : "Review"))
    .join(", ")}`;
}

function runtimePathLabel(sourceAttribution?: AnalysisResult["sourceAttribution"], status?: TaskThreadMessage["status"]) {
  if (!sourceAttribution) {
    return null;
  }
  if (!sourceAttribution.llmTarget || !sourceAttribution.documentPath || !sourceAttribution.pipelineMode) {
    return null;
  }

  const target = sourceAttribution.llmTarget;
  const documentPath =
    sourceAttribution.documentPath === "pdf_direct"
      ? "PDF direct"
      : sourceAttribution.documentPath === "image_fallback"
        ? "Image fallback"
        : "路径未知";
  const pipelineMode = sourceAttribution.pipelineMode;
  const statusSuffix =
    status === "partial" ? "（结果未完成）" : status === "failed" ? "（诊断信息）" : "";

  return `运行路径：${target} · ${documentPath} · ${pipelineMode}${statusSuffix}`;
}

function parameterStatusWeight(status: ParameterItem["status"]) {
  if (status === "needs_review") return 0;
  if (status === "confirmed") return 1;
  return 2;
}

function prioritizeParameters(parameters: ParameterItem[]) {
  return [...parameters].sort((left, right) => {
    const statusOrder = parameterStatusWeight(left.status) - parameterStatusWeight(right.status);
    if (statusOrder !== 0) {
      return statusOrder;
    }

    return displayParameterName(left.name).localeCompare(displayParameterName(right.name), "zh-Hans-CN");
  });
}

function mapRecentTask(snapshot: RecentAnalysisJob): RecentTaskCard | null {
  if (!snapshot.documentMeta) {
    return null;
  }

  return {
    jobId: snapshot.jobId,
    status: snapshot.status,
    updatedAt: snapshot.updatedAt,
    taskName: snapshot.documentMeta.taskName,
    chipName: snapshot.documentMeta.chipName,
    fileName: snapshot.documentMeta.fileName
  };
}

function formatRecentTaskTime(updatedAt: string) {
  const parsed = Date.parse(updatedAt);
  if (Number.isNaN(parsed)) {
    return "更新时间未知";
  }

  return `更新于 ${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(parsed))}`;
}

function formatElapsedDuration(updatedAt: string, nowMs: number) {
  const parsed = Date.parse(updatedAt);
  if (Number.isNaN(parsed)) {
    return null;
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - parsed) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatStepTimestamp(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(parsed));
}

function preferredEvidenceForAnalysis(analysis: AnalysisResult | null | undefined) {
  if (!analysis) {
    return null;
  }

  const prioritized = prioritizeParameters(analysis.keyParameters);
  const preferredParameter = prioritized[0];
  if (preferredParameter) {
    const matchedEvidence = analysis.evidence.find((entry) => entry.id === preferredParameter.evidenceId);
    if (matchedEvidence) {
      return matchedEvidence;
    }
  }

  return analysis.evidence[0] ?? null;
}

function correctedParameterCount(analysis: AnalysisResult | null) {
  return analysis?.keyParameters.filter((item) => item.status === "user_corrected").length ?? 0;
}

function resolvePipelineMode(analysis?: AnalysisResult | null) {
  const pipelineMode = analysis?.pipelineMode ?? analysis?.sourceAttribution?.pipelineMode;
  return pipelineMode === "staged" ? "staged" : "single";
}

function buildInitialTaskSteps(pdf: UploadedPdf, pipelineMode: "single" | "staged"): TaskStep[] {
  if (pipelineMode === "single") {
    return [
      {
        id: `step-received-${pdf.id}`,
        kind: "task_received",
        status: "done",
        title: "Task Received",
        detail: `已接收文档 ${pdf.fileName}`
      },
      {
        id: `step-identity-${pdf.id}`,
        kind: "identity_ready",
        status: "active",
        title: "Identity Ready",
        detail: "正在识别器件类型与模板"
      },
      {
        id: `step-analysis-${pdf.id}`,
        kind: "intelligent_analysis",
        status: "pending",
        title: "Intelligent Analysis",
        detail: "正在整理完整 datasheet 报告"
      },
      {
        id: `step-result-${pdf.id}`,
        kind: "result_ready",
        status: "pending",
        title: "Result Ready",
        detail: "等待可展示结果"
      }
    ];
  }

  return [
    {
      id: `step-received-${pdf.id}`,
      kind: "task_received",
      status: "done",
      title: "Task Received",
      detail: `已接收文档 ${pdf.fileName}`
    },
    {
      id: `step-identity-${pdf.id}`,
      kind: "identity_ready",
      status: "active",
      title: "Identity Ready",
      detail: "正在识别器件类型与模板"
    },
    {
      id: `step-fast-${pdf.id}`,
      kind: "fast_parameters_ready",
      status: "pending",
      title: "Fast Parameters Ready",
      detail: "正在生成首批关键参数"
    },
    {
      id: `step-report-${pdf.id}`,
      kind: "full_report_ready",
      status: "pending",
      title: "Full Report Ready",
      detail: "正在整理完整报告"
    },
    {
      id: `step-reconcile-${pdf.id}`,
      kind: "reconciliation_ready",
      status: "pending",
      title: "Reconciliation Ready",
      detail: "等待参数对账与冲突复核"
    }
  ];
}

function deriveTaskSteps(pdf: UploadedPdf, status: TaskThreadMessage["status"], analysis?: AnalysisResult | null, warnings: string[] = []) {
  const pipelineMode = resolvePipelineMode(analysis);
  const hasFastParameters = (analysis?.keyParameters.length ?? 0) > 0;
  const hasDisplayableResult = hasDisplayableResultContent(analysis);
  const fullReportCompleted = analysis?.parameterReconciliation
    ? Boolean(analysis.parameterReconciliation.fullReportCompleted)
    : status === "complete" && hasDisplayableResult;
  const fastPassCompleted = analysis?.parameterReconciliation
    ? Boolean(analysis.parameterReconciliation.fastPassCompleted || hasFastParameters)
    : hasFastParameters || status === "complete";
  const reconciliationCompleted = fullReportCompleted;

  return buildInitialTaskSteps(pdf, pipelineMode).map((step) => {
    if (step.kind === "task_received") {
      return step;
    }

    if (step.kind === "identity_ready") {
      const fastReadyAt = formatStepTimestamp(analysis?.fastParametersReadyAt);
      if (status === "processing" && !hasFastParameters) {
        return {
          ...step,
          status: "active" as const,
          detail: "正在识别器件类型与模板"
        };
      }

      if (status === "failed" && !fastPassCompleted) {
        return {
          ...step,
          status: "error" as const,
          detail: warnings[0] ?? GENERIC_ANALYSIS_FAILURE_MESSAGE
        };
      }

      return {
        ...step,
        status: "done" as const,
        detail: fastReadyAt ? `已完成器件识别与模板选择 · ${fastReadyAt}` : "已完成器件识别与模板选择"
      };
    }

    if (step.kind === "intelligent_analysis") {
      const fullReportReadyAt = formatStepTimestamp(analysis?.fullReportReadyAt);
      if (status === "failed") {
        return {
          ...step,
          status: "error" as const,
          detail: warnings[0] ?? GENERIC_ANALYSIS_FAILURE_MESSAGE
        };
      }

      if (status === "processing" && !hasDisplayableResult) {
        return {
          ...step,
          status: "active" as const,
          detail: "正在整理完整 datasheet 报告"
        };
      }

      return {
        ...step,
        status: "done" as const,
        detail: fullReportReadyAt ? `完整分析已完成 · ${fullReportReadyAt}` : "完整分析已完成"
      };
    }

    if (step.kind === "result_ready") {
      const fullReportReadyAt = formatStepTimestamp(analysis?.fullReportReadyAt);
      if (status === "failed") {
        return {
          ...step,
          status: "error" as const,
          detail: warnings[0] ?? GENERIC_ANALYSIS_FAILURE_MESSAGE
        };
      }

      if (hasDisplayableResult) {
        return {
          ...step,
          status: "done" as const,
          detail: `结果已可展示${fullReportReadyAt ? ` · ${fullReportReadyAt}` : ""}`
        };
      }

      return step;
    }

    if (step.kind === "fast_parameters_ready") {
      const fastReadyAt = formatStepTimestamp(analysis?.fastParametersReadyAt);
      if (status === "processing" && !fastPassCompleted) {
        return {
          ...step,
          status: "active" as const,
          detail: "正在生成首批关键参数"
        };
      }

      if (status === "failed") {
        return {
          ...step,
          status: fastPassCompleted ? "error" as const : "pending" as const,
          detail: warnings[0] ?? GENERIC_ANALYSIS_FAILURE_MESSAGE
        };
      }

      return {
        ...step,
        status: fastPassCompleted ? "done" as const : "pending" as const,
        detail: fastPassCompleted ? `已生成首批关键参数${fastReadyAt ? ` · ${fastReadyAt}` : ""}` : "等待快参数结果"
      };
    }

    if (step.kind === "full_report_ready") {
      const fullReportReadyAt = formatStepTimestamp(analysis?.fullReportReadyAt);
      if (status === "failed") {
        return {
          ...step,
          status: "error" as const,
          detail: warnings[0] ?? GENERIC_ANALYSIS_FAILURE_MESSAGE
        };
      }

      if (status === "partial") {
        return {
          ...step,
          status: "pending" as const,
          detail: "参数初稿已生成，完整报告仍在整理"
        };
      }

      if (fullReportCompleted && hasDisplayableResult) {
        return {
          ...step,
          status: "done" as const,
          detail: `完整报告已可展示${fullReportReadyAt ? ` · ${fullReportReadyAt}` : ""}`
        };
      }

      return step;
    }

    if (status === "failed") {
      return {
        ...step,
        status: "error" as const,
        detail: warnings[0] ?? GENERIC_ANALYSIS_FAILURE_MESSAGE
      };
    }

    if (status === "partial") {
      return {
        ...step,
        status: "pending" as const,
        detail: "等待完整报告与参数复核完成"
      };
    }

    if (reconciliationCompleted && hasDisplayableResult) {
      return {
        ...step,
        status: "done" as const,
        detail: "参数对账与系统复核已完成"
      };
    }

    return step;
  });
}

function errorTaskSteps(steps: TaskStep[], detail: string) {
  return steps.map((step) => {
    if (step.status === "done") return step;
    return { ...step, status: "error" as const, detail };
  });
}

function buildTaskNote(status: TaskThreadMessage["status"], warnings: string[], note?: string) {
  if (note) return note;
  if (status === "failed") return warnings[0] ?? GENERIC_ANALYSIS_FAILURE_MESSAGE;
  if (status === "partial") return warnings[0] ?? "当前结果为部分解析，请先做初步核对。";
  if (status === "processing" && warnings.length) return warnings[0];
  return undefined;
}

function taskStatusLabel(status: TaskThreadMessage["status"]) {
  if (status === "complete") return "已完成";
  if (status === "partial") return "部分结果";
  if (status === "failed") return "解析失败";
  return "处理中";
}

function downloadArtifact(artifact: { fileName: string; mimeType: string; content: string }) {
  const blob = new Blob([artifact.content], { type: artifact.mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = artifact.fileName;
  const isJsdom = window.navigator.userAgent.toLowerCase().includes("jsdom");

  if (!isJsdom) {
    link.click();
  }

  if (typeof URL.revokeObjectURL === "function") {
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 0);
  }
}

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 90;
const GENERIC_ANALYSIS_FAILURE_MESSAGE = "当前解析失败，请稍后重试。";
const MISSING_JOB_FAILURE_MESSAGE = "后台任务记录不存在，可能已被清理。请重新上传 PDF 发起新任务。";
const WRITEBACK_FAILURE_MESSAGE = "写回失败，当前改动仅保留在本地界面。请重试。";

type WorkspaceProps = {
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  currentUser?: CurrentUser | null;
};

export function Workspace({
  pollIntervalMs = POLL_INTERVAL_MS,
  maxPollAttempts = MAX_POLL_ATTEMPTS,
  currentUser = null
}: WorkspaceProps = {}) {
  const uploadId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isPdfPanelOpen, setIsPdfPanelOpen] = useState(true);
  const [currentPdf, setCurrentPdf] = useState<UploadedPdf | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [focusedEvidence, setFocusedEvidence] = useState<EvidenceTarget | null>(null);
  const [composer, setComposer] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [editingParameter, setEditingParameter] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [writebackState, setWritebackState] = useState<Record<string, WritebackStateItem>>({});
  const [isPolling, setIsPolling] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([createWelcomeMessage()]);
  const [recentTasks, setRecentTasks] = useState<RecentTaskCard[]>([]);
  const [highlightedParameterKey, setHighlightedParameterKey] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const pollSessionRef = useRef(0);
  const pollInFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const currentPdfRef = useRef<UploadedPdf | null>(null);
  const currentJobIdRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  function appendFollowUpMessages(followUpMessages: FollowUpMessage[]) {
    setMessages((current) => {
      const nonTranscript = current.filter((message) => {
        if (message.kind !== "text") return true;
        if (message.id.startsWith("followup-user-")) return false;
        if (message.id.startsWith("followup-assistant-")) return false;
        return true;
      });

      const transcript = followUpMessages.flatMap((message) => [
        {
          id: `followup-user-${message.id}`,
          role: "user" as const,
          kind: "text" as const,
          content: message.question
        },
        {
          id: `followup-assistant-${message.id}`,
          role: "assistant" as const,
          kind: "text" as const,
          content: message.answer,
          claims: message.claims,
          warnings: message.warnings,
          usedSources: message.usedSources
        }
      ]);

      return [...nonTranscript, ...transcript];
    });
  }

  function replaceMessagesForTask(followUpMessages: FollowUpMessage[]) {
    const transcript = followUpMessages.flatMap((message) => [
      {
        id: `followup-user-${message.id}`,
        role: "user" as const,
        kind: "text" as const,
        content: message.question
      },
      {
        id: `followup-assistant-${message.id}`,
        role: "assistant" as const,
        kind: "text" as const,
        content: message.answer,
        claims: message.claims,
        warnings: message.warnings,
        usedSources: message.usedSources
      }
    ]);

    setMessages([createWelcomeMessage(), ...transcript]);
  }

  function refreshRecentTask(snapshot: AnalysisJobSnapshot) {
    const mapped = mapRecentTask({
      jobId: snapshot.jobId,
      status: snapshot.status,
      updatedAt: snapshot.updatedAt,
      documentMeta: snapshot.documentMeta ?? getCurrentDocumentMeta(snapshot),
      hasAnalysis: Boolean(snapshot.analysis),
      followUpCount: snapshot.followUpMessages?.length ?? 0
    });

    if (!mapped) {
      return;
    }

    setRecentTasks((current) => {
      const next = [mapped, ...current.filter((item) => item.jobId !== mapped.jobId)];
      return next
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        .slice(0, 8);
    });
  }

  function getCurrentDocumentMeta(snapshot: AnalysisJobSnapshot) {
    if (snapshot.documentMeta) {
      return snapshot.documentMeta;
    }

    if (!currentPdfRef.current) {
      return null;
    }

    return {
      fileName: currentPdfRef.current.fileName,
      taskName: currentPdfRef.current.taskName,
      chipName: currentPdfRef.current.chipName,
      pageCount: currentPdfRef.current.pageCount
    };
  }

  function flashParameterRow(item: ParameterItem) {
    const key = parameterWritebackKey(item.name, item.evidenceId);
    setHighlightedParameterKey(key);
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedParameterKey((current) => (current === key ? null : current));
    }, 1200);
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
      isMountedRef.current = false;
      pollSessionRef.current += 1;
      pollInFlightRef.current = false;
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentPdf) {
      setIsPdfPanelOpen(true);
    }
  }, [currentPdf?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentTasks() {
      if (new URL(window.location.href).searchParams.get("jobId")) {
        return;
      }

      try {
        const response = await fetch("/api/analysis");
        const payload = (await response.json()) as { jobs?: RecentAnalysisJob[] };
        if (cancelled || !response.ok) {
          return;
        }

        setRecentTasks((payload.jobs ?? []).map(mapRecentTask).filter((item): item is RecentTaskCard => Boolean(item)));
      } catch {
        if (!cancelled) {
          setRecentTasks([]);
        }
      }
    }

    void loadRecentTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const jobId = new URL(window.location.href).searchParams.get("jobId");
    if (!jobId || currentPdfRef.current) {
      return;
    }

    let cancelled = false;

    async function hydrateFromJob() {
        const response = await fetch(`/api/analysis?jobId=${encodeURIComponent(jobId ?? "")}`, {
          cache: "no-store"
        });
      const snapshot = (await response.json()) as AnalysisJobSnapshot;

      if (cancelled) {
        return;
      }

      if (!response.ok || !snapshot.jobId) {
        setMessages((current) => [
          ...current,
          {
            id: `restore-error-${Date.now()}`,
            role: "assistant",
            kind: "text",
            content:
              (snapshot as { error?: string }).error === "job not found"
                ? MISSING_JOB_FAILURE_MESSAGE
                : GENERIC_ANALYSIS_FAILURE_MESSAGE
          }
        ]);
        return;
      }

      const restoredPdf = createUploadedPdfFromJob(jobId ?? "", snapshot);
      if (!restoredPdf) {
        return;
      }

      currentPdfRef.current = restoredPdf;
      currentJobIdRef.current = snapshot.jobId;
      setCurrentPdf(restoredPdf);
      setCurrentJobId(snapshot.jobId);
      setAnalysis(snapshot.analysis ?? null);
      setFocusedEvidence(preferredEvidenceForAnalysis(snapshot.analysis));
      refreshRecentTask(snapshot);
      replaceMessagesForTask(snapshot.followUpMessages ?? []);

      if (snapshot.status === "processing") {
        upsertTaskMessage((existing) => ({
          id: existing?.id ?? `task-${restoredPdf.id}`,
          role: "assistant",
          kind: "task",
          pdf: restoredPdf,
          updatedAt: snapshot.updatedAt,
          steps: deriveTaskSteps(restoredPdf, "processing", snapshot.analysis, snapshot.warnings),
          status: "processing",
          warnings: snapshot.warnings
        }));
        void startPolling(snapshot.jobId, restoredPdf);
        return;
      }

      if (snapshot.status === "failed") {
        applyFailedSnapshot(restoredPdf, snapshot);
        return;
      }

      applyAnalysisSnapshot(restoredPdf, snapshot);
    }

    void hydrateFromJob();

    return () => {
      cancelled = true;
    };
  }, []);

  const correctionCount = useMemo(
    () =>
      analysis?.events?.filter(
        (event) => event.type === "parameter_confirmed" || event.type === "parameter_corrected"
      ).length ?? 0,
    [analysis]
  );
  const manualCorrectionCount = useMemo(() => correctedParameterCount(analysis), [analysis]);
  const reviewCount = useMemo(
    () => analysis?.keyParameters.filter((item) => item.status === "needs_review").length ?? 0,
    [analysis]
  );
  const exportableParameterCount = useMemo(
    () => analysis?.keyParameters.filter((item) => item.status !== "needs_review").length ?? 0,
    [analysis]
  );

  function upsertTaskMessage(buildNext: (current: TaskThreadMessage | null) => TaskThreadMessage) {
    setMessages((current) => {
      const existing = current.find((item): item is TaskThreadMessage => item.kind === "task") ?? null;
      const nextTask = buildNext(existing);
      return [...current.filter((item) => item.kind !== "task"), nextTask];
    });
  }

  function appendCorrectionMessage(content: string) {
    setMessages((current) => [
      ...current,
      {
        id: `correction-${Date.now()}`,
        role: "assistant",
        kind: "correction",
        content
      }
    ]);
  }

  function parameterWritebackKey(parameterName: string, evidenceId: string) {
    return `${parameterName}::${evidenceId}`;
  }

  function invalidatePollingSession() {
    pollSessionRef.current += 1;
    pollInFlightRef.current = false;
    if (isMountedRef.current) {
      setIsPolling(false);
    }
    currentJobIdRef.current = null;
  }

  function beginPollingSession() {
    pollSessionRef.current += 1;
    pollInFlightRef.current = true;
    setIsPolling(true);
    return pollSessionRef.current;
  }

  function isActivePollingSession(sessionId: number) {
    return isMountedRef.current && pollSessionRef.current === sessionId;
  }

  function finishPollingSession(sessionId: number) {
    if (!isActivePollingSession(sessionId)) {
      return;
    }

    pollInFlightRef.current = false;
    setIsPolling(false);
  }

  function applyFailure(pdf: UploadedPdf, message: string) {
    if (currentPdfRef.current && currentPdfRef.current.id !== pdf.id) {
      return;
    }

    currentJobIdRef.current = null;
    setCurrentJobId(null);
    upsertTaskMessage((existing) => ({
      id: existing?.id ?? `task-${pdf.id}`,
      role: "assistant",
      kind: "task",
      pdf,
      updatedAt: new Date().toISOString(),
      steps: errorTaskSteps(existing?.steps ?? buildInitialTaskSteps(pdf, resolvePipelineMode(analysis)), message),
      status: "failed",
      warnings: [message],
      note: message
    }));
  }

  function applyFailedSnapshot(pdf: UploadedPdf, snapshot: AnalysisJobSnapshot) {
    if (currentPdfRef.current && currentPdfRef.current.id !== pdf.id) {
      return;
    }

    currentJobIdRef.current = null;
    setCurrentJobId(null);
    setCurrentPdf((current) =>
      current && current.id === pdf.id
        ? { ...current, pageCount: resolveSnapshotPageCount(snapshot, current.pageCount) }
        : current
    );
    setAnalysis(snapshot.analysis ?? null);
    setWritebackState({});
    setFocusedEvidence(preferredEvidenceForAnalysis(snapshot.analysis));
    refreshRecentTask(snapshot);

    upsertTaskMessage((existing) => ({
      id: existing?.id ?? `task-${pdf.id}`,
      role: "assistant",
      kind: "task",
      pdf,
      updatedAt: snapshot.updatedAt,
      steps: deriveTaskSteps(pdf, "failed", snapshot.analysis, snapshot.warnings),
      status: "failed",
      warnings: snapshot.warnings.length ? snapshot.warnings : [GENERIC_ANALYSIS_FAILURE_MESSAGE],
      note: snapshot.warnings[0] ?? GENERIC_ANALYSIS_FAILURE_MESSAGE
    }));
  }

  function applyAnalysisSnapshot(pdf: UploadedPdf, snapshot: AnalysisJobSnapshot) {
    if (currentPdfRef.current && currentPdfRef.current.id !== pdf.id) {
      return;
    }

    if (!snapshot.analysis) {
      applyFailure(pdf, snapshot.warnings[0] ?? GENERIC_ANALYSIS_FAILURE_MESSAGE);
      return;
    }

    currentJobIdRef.current = snapshot.jobId;
    setCurrentJobId(snapshot.jobId);
    setCurrentPdf((current) =>
      current && current.id === pdf.id
        ? { ...current, pageCount: resolveSnapshotPageCount(snapshot, current.pageCount) }
        : current
    );
    setAnalysis(snapshot.analysis);
    setWritebackState({});
    refreshRecentTask(snapshot);
    appendFollowUpMessages(snapshot.followUpMessages ?? []);
    setFocusedEvidence((current) => {
      if (!current) {
        return preferredEvidenceForAnalysis(snapshot.analysis);
      }

      return snapshot.analysis?.evidence.find((entry) => entry.id === current.id) ?? preferredEvidenceForAnalysis(snapshot.analysis);
    });

    upsertTaskMessage((existing) => ({
      id: existing?.id ?? `task-${pdf.id}`,
      role: "assistant",
      kind: "task",
      pdf,
      updatedAt: snapshot.updatedAt,
      steps: deriveTaskSteps(pdf, snapshot.status, snapshot.analysis, snapshot.warnings),
      status: snapshot.status,
      warnings: snapshot.warnings
    }));
  }

  function applyDelayed(jobId: string, pdf: UploadedPdf) {
    if (currentPdfRef.current && currentPdfRef.current.id !== pdf.id) {
      return;
    }

    currentJobIdRef.current = jobId;
    setCurrentJobId(jobId);
    upsertTaskMessage((existing) => ({
      id: existing?.id ?? `task-${pdf.id}`,
      role: "assistant",
      kind: "task",
      pdf,
      updatedAt: new Date().toISOString(),
      steps: existing?.steps ?? deriveTaskSteps(pdf, "processing", analysis, []),
      status: "processing",
      warnings: [],
      note: "解析时间比预期更长，但任务还在后台继续。你不需要重传 PDF，可以继续等待当前任务。"
    }));
  }

  async function pollAnalysisJob(jobId: string, pdf: UploadedPdf, sessionId: number) {
    try {
      for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
        const response = await fetch(`/api/analysis?jobId=${encodeURIComponent(jobId)}`, {
          cache: "no-store"
        });
        if (!isActivePollingSession(sessionId)) {
          return;
        }

        const snapshot = (await response.json()) as AnalysisJobSnapshot;
        if (!isActivePollingSession(sessionId)) {
          return;
        }

        if (!response.ok) {
          const error = (snapshot as { error?: string }).error;
          applyFailure(
            pdf,
            response.status === 404 || error === "job not found"
              ? MISSING_JOB_FAILURE_MESSAGE
              : GENERIC_ANALYSIS_FAILURE_MESSAGE
          );
          return;
        }

        if (snapshot.status === "processing") {
          setCurrentPdf((current) =>
            current && current.id === pdf.id
              ? { ...current, pageCount: resolveSnapshotPageCount(snapshot, current.pageCount) }
              : current
          );
          if (snapshot.analysis) {
            setAnalysis(snapshot.analysis);
            setFocusedEvidence((current) => {
              if (!current) {
                return preferredEvidenceForAnalysis(snapshot.analysis);
              }

              return snapshot.analysis?.evidence.find((entry) => entry.id === current.id) ?? preferredEvidenceForAnalysis(snapshot.analysis);
            });
          }
          refreshRecentTask(snapshot);
          upsertTaskMessage((existing) => ({
            id: existing?.id ?? `task-${pdf.id}`,
            role: "assistant",
            kind: "task",
            pdf: {
              ...pdf,
              pageCount: resolveSnapshotPageCount(snapshot, pdf.pageCount)
            },
            updatedAt: snapshot.updatedAt,
            steps: deriveTaskSteps(pdf, "processing", snapshot.analysis, snapshot.warnings),
            status: "processing",
            warnings: snapshot.warnings,
            note: buildTaskNote("processing", snapshot.warnings)
          }));

          if (attempt === 0) {
            continue;
          }

          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, pollIntervalMs);
          });
          continue;
        }

        if (snapshot.status === "failed") {
          applyFailedSnapshot(pdf, snapshot);
          return;
        }

        applyAnalysisSnapshot(pdf, snapshot);
        return;
      }

      if (isActivePollingSession(sessionId)) {
        applyDelayed(jobId, pdf);
      }
    } finally {
      finishPollingSession(sessionId);
    }
  }

  async function startPolling(jobId: string, pdf: UploadedPdf) {
    if (pollInFlightRef.current) {
      return;
    }

    const sessionId = beginPollingSession();
    await pollAnalysisJob(jobId, pdf, sessionId);
  }

  async function handleResumePolling() {
    if (!currentJobId || !currentPdf || pollInFlightRef.current) return;

    upsertTaskMessage((existing) => ({
      id: existing?.id ?? `task-${currentPdf.id}`,
      role: "assistant",
      kind: "task",
      pdf: currentPdf,
      updatedAt: new Date().toISOString(),
      steps: deriveTaskSteps(currentPdf, "processing", analysis, []),
      status: "processing",
      warnings: [],
      note: "正在继续等待后台解析结果..."
    }));

    await startPolling(currentJobId, currentPdf);
  }

  async function handleAnalyze(file: File) {
    setSelectedFile(file);
    const uploadError = validateUploadedFile(file);
    if (uploadError) {
      invalidatePollingSession();
      currentPdfRef.current = null;
      setCurrentPdf(null);
      currentJobIdRef.current = null;
      setCurrentJobId(null);
      setAnalysis(null);
      setFocusedEvidence(null);
      setWritebackState({});
      setMessages((current) => [
        ...current,
        {
          id: `upload-error-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: uploadError
        }
      ]);
      return;
    }

    const pdf = createUploadedPdf(file);
    window.history.replaceState(null, "", "/");
    invalidatePollingSession();
    currentPdfRef.current = pdf;
    setCurrentPdf(pdf);
    setIsPdfPanelOpen(true);
    currentJobIdRef.current = null;
    setCurrentJobId(null);
    setAnalysis(null);
    setFocusedEvidence(null);
    setEditingParameter(null);
    setDraftValue("");
    setWritebackState({});
    setExportNotice(null);
    setMessages((current) => [
      ...current.filter((message) => message.kind !== "task"),
      {
        id: `task-${pdf.id}`,
        role: "assistant",
        kind: "task",
        pdf,
        updatedAt: new Date().toISOString(),
        steps: deriveTaskSteps(pdf, "processing", null, []),
        status: "processing",
        warnings: []
      }
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("taskName", pdf.taskName);
      formData.append("chipName", pdf.chipName);

      const response = await fetch("/api/analysis", {
        method: "POST",
        body: formData
      });

      const snapshot = (await response.json()) as AnalysisJobSnapshot;
      if (currentPdfRef.current?.id !== pdf.id) {
        return;
      }

      if (!response.ok || !snapshot.jobId) {
        applyFailure(pdf, GENERIC_ANALYSIS_FAILURE_MESSAGE);
        return;
      }

      window.history.replaceState(null, "", `/?jobId=${encodeURIComponent(snapshot.jobId)}`);
      setCurrentJobId(snapshot.jobId);
      currentJobIdRef.current = snapshot.jobId;
      const remotePdf = {
        ...pdf,
        pageCount: resolveSnapshotPageCount(snapshot, pdf.pageCount),
        objectUrl: snapshot.pdfUrl ?? `/api/analysis/file?jobId=${encodeURIComponent(snapshot.jobId)}`
      };
      currentPdfRef.current = remotePdf;
      setCurrentPdf(remotePdf);
      refreshRecentTask({
        ...snapshot,
        documentMeta: {
          fileName: remotePdf.fileName,
          taskName: remotePdf.taskName,
          chipName: remotePdf.chipName,
          pageCount: remotePdf.pageCount
        }
      });

      if (snapshot.status === "processing") {
        upsertTaskMessage((existing) => ({
          id: existing?.id ?? `task-${pdf.id}`,
          role: "assistant",
          kind: "task",
          pdf: remotePdf,
          updatedAt: snapshot.updatedAt,
          steps: deriveTaskSteps(remotePdf, "processing", snapshot.analysis, snapshot.warnings),
          status: "processing",
          warnings: snapshot.warnings
        }));
        await startPolling(snapshot.jobId, remotePdf);
        return;
      }

      if (snapshot.status === "failed") {
        applyFailedSnapshot(remotePdf, snapshot);
        return;
      }

      applyAnalysisSnapshot(remotePdf, snapshot);
    } catch {
      applyFailure(pdf, GENERIC_ANALYSIS_FAILURE_MESSAGE);
    }
  }

  function handleFileSelection(file: File | null) {
    if (!file) {
      return;
    }

    void handleAnalyze(file);
  }

  function handleUploadInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    handleFileSelection(file);
    event.target.value = "";
  }

  function handleUploadDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    handleFileSelection(file);
  }

  function handleUploadDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    setIsDragActive(true);
  }

  function handleUploadDragLeave(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  async function submitFollowUp(question: string) {
    if (!currentJobId) {
      throw new Error("missing current job id");
    }

    const response = await fetch("/api/analysis/follow-up", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        jobId: currentJobId,
        question
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "follow-up failed");
    }

    return (await response.json()) as FollowUpResponse & { warnings?: string[] };
  }

  async function handleAsk() {
    const question = composer.trim();
    if (!question || !currentPdf || !analysis) return;
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        kind: "text",
        content: question
      }
    ]);
    setComposer("");
    setIsAsking(true);

    try {
      const followUp = await submitFollowUp(question);
      setMessages((current) => [
        ...current,
        {
          id: `followup-assistant-${followUp.messageId ?? Date.now()}`,
          role: "assistant",
          kind: "text",
          content: followUp.answer,
          claims: followUp.claims,
          warnings: followUp.warnings ?? followUp.followUpWarnings,
          usedSources: followUp.usedSources
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: error instanceof Error ? error.message : "追问失败，请稍后重试。"
        }
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  async function recordClientAuditEvent(input: AuditEventPayload) {
    try {
      await fetch("/api/audit", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(input)
      });
    } catch {
      // Best-effort only; do not block the user workflow.
    }
  }

  function collectFollowUpTranscript(): FollowUpMessage[] {
    const transcript: FollowUpMessage[] = [];
    const conversation = messages.filter((message) => message.kind === "text");

    for (let index = 0; index < conversation.length; index += 1) {
      const current = conversation[index];
      const next = conversation[index + 1];
      if (current.role !== "user" || !next || next.role !== "assistant") {
        continue;
      }

      transcript.push({
        id: next.id,
        question: current.content,
        answer: next.content,
        claims: next.claims ?? [],
        citations: next.claims?.flatMap((claim) => claim.citations) ?? [],
        warnings: next.warnings ?? [],
        usedSources: next.usedSources ?? [],
        sourceAttribution: null,
        createdAt: new Date(0).toISOString()
      });
    }

    return transcript;
  }

  function handleExport(
    eventType: AuditEventPayload["eventType"],
    builder: (
      pdf: UploadedPdf,
      currentAnalysis: AnalysisResult,
      followUpMessages?: FollowUpMessage[]
    ) => { fileName: string; mimeType: string; content: string }
  ) {
    if (!currentPdf || !analysis) return;

    const artifact = builder(currentPdf, analysis, collectFollowUpTranscript());
    downloadArtifact(artifact);
    void recordClientAuditEvent({
      eventType,
      jobId: currentJobId,
      targetType: "export_artifact",
      targetId: artifact.fileName,
      payload: {
        fileName: artifact.fileName,
        chipName: currentPdf.chipName,
        format: artifact.mimeType
      }
    });
    setExportNotice(`已导出 ${artifact.fileName}，可继续用于下游整理。`);
  }

  function handleExportJson() {
    handleExport("export_json", buildAnalysisJson);
  }

  function handleExportHtml() {
    handleExport("export_html", buildAnalysisHtml);
  }

  function handleExportCsv() {
    if (!analysis || exportableParameterCount === 0) return;
    handleExport("export_csv", buildParameterTable);
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST"
      });
    } finally {
      if (window.navigator.userAgent.toLowerCase().includes("jsdom")) {
        window.history.replaceState(null, "", "/login");
        return;
      }

      window.location.assign("/login");
    }
  }

  async function persistParameterAction(payload: ParameterActionPayload, pdf: UploadedPdf) {
    const key = parameterWritebackKey(payload.parameterName, payload.evidenceId);

    setWritebackState((current) => ({
      ...current,
      [key]: {
        status: "saving",
        action: payload.action,
        nextValue: payload.nextValue
      }
    }));

    try {
      const response = await fetch("/api/analysis", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const snapshot = (await response.json()) as AnalysisJobSnapshot;

      if (!response.ok || !snapshot.analysis) {
        setWritebackState((current) => ({
          ...current,
          [key]: {
            status: "failed",
            action: payload.action,
            nextValue: payload.nextValue
          }
        }));
        return;
      }

      applyAnalysisSnapshot(pdf, snapshot);
    } catch {
      setWritebackState((current) => ({
        ...current,
        [key]: {
          status: "failed",
          action: payload.action,
          nextValue: payload.nextValue
        }
      }));
    }
  }

  function handleConfirm(item: ParameterItem) {
    setAnalysis((current) => {
      if (!current) return current;
      return applyParameterActionToAnalysis(current, {
        action: "confirm",
        parameterName: item.name,
        evidenceId: item.evidenceId
      });
    });
    if (currentJobId && currentPdf) {
      void persistParameterAction(
        {
          jobId: currentJobId,
          parameterName: item.name,
          evidenceId: item.evidenceId,
          action: "confirm"
        },
        currentPdf
      );
    }
  }

  function handleStartEdit(item: ParameterItem) {
    setEditingParameter(item.name);
    setDraftValue(item.value);
  }

  function handleSave(item: ParameterItem) {
    const nextValue = draftValue.trim();
    if (!nextValue) return;
    setAnalysis((current) => {
      if (!current) return current;
      return applyParameterActionToAnalysis(current, {
        action: "edit",
        parameterName: item.name,
        evidenceId: item.evidenceId,
        nextValue
      });
    });
    setEditingParameter(null);
    setDraftValue("");
    appendCorrectionMessage("参数修正已记录，可作为后续经验样本。");
    if (currentJobId && currentPdf) {
      void persistParameterAction(
        {
          jobId: currentJobId,
          parameterName: item.name,
          evidenceId: item.evidenceId,
          action: "edit",
          nextValue
        },
        currentPdf
      );
    }
  }

  function handleRetryWriteback(item: ParameterItem) {
    if (!currentJobId || !currentPdf) return;

    const key = parameterWritebackKey(item.name, item.evidenceId);
    const pending = writebackState[key];
    if (!pending) return;

    void persistParameterAction(
      {
        jobId: currentJobId,
        parameterName: item.name,
        evidenceId: item.evidenceId,
        action: pending.action,
        nextValue: pending.nextValue
      },
      currentPdf
    );
  }

  async function handleOpenRecentTask(jobId: string) {
    const response = await fetch(`/api/analysis?jobId=${encodeURIComponent(jobId)}`, {
      cache: "no-store"
    });
    const snapshot = (await response.json()) as AnalysisJobSnapshot;

    if (!response.ok || !snapshot.jobId) {
      setMessages((current) => [
        ...current,
        {
          id: `recent-open-error-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content:
            (snapshot as { error?: string }).error === "job not found"
              ? MISSING_JOB_FAILURE_MESSAGE
              : GENERIC_ANALYSIS_FAILURE_MESSAGE
        }
      ]);
      return;
    }

    const restoredPdf = createUploadedPdfFromJob(jobId, snapshot);
    if (!restoredPdf) {
      return;
    }

    window.history.replaceState(null, "", `/?jobId=${encodeURIComponent(jobId)}`);
    invalidatePollingSession();
    currentPdfRef.current = restoredPdf;
    currentJobIdRef.current = snapshot.jobId;
    setCurrentPdf(restoredPdf);
    setCurrentJobId(snapshot.jobId);
    setAnalysis(snapshot.analysis ?? null);
    setFocusedEvidence(preferredEvidenceForAnalysis(snapshot.analysis));
    setEditingParameter(null);
    setDraftValue("");
    setWritebackState({});
    setExportNotice(null);
    refreshRecentTask(snapshot);
    replaceMessagesForTask(snapshot.followUpMessages ?? []);

    if (snapshot.status === "processing") {
      upsertTaskMessage((existing) => ({
        id: existing?.id ?? `task-${restoredPdf.id}`,
        role: "assistant",
        kind: "task",
        pdf: restoredPdf,
        updatedAt: snapshot.updatedAt,
        steps: deriveTaskSteps(restoredPdf, "processing", snapshot.analysis, snapshot.warnings),
        status: "processing",
        warnings: snapshot.warnings
      }));
      void startPolling(snapshot.jobId, restoredPdf);
      return;
    }

    if (snapshot.status === "failed") {
      applyFailedSnapshot(restoredPdf, snapshot);
      return;
    }

    applyAnalysisSnapshot(restoredPdf, snapshot);
  }

  function handleCitationJump(citation: ClaimCitation) {
    if (citation.sourceType === "datasheet" && citation.page) {
      setFocusedEvidence({
        id: `report-citation-${citation.id}`,
        label: citation.title ?? "报告引用",
        page: citation.page,
        quote: citation.quote ?? "",
        rect: { left: 12, top: 16, width: 44, height: 10 }
      });
    }

    if (citation.sourceType === "public" && citation.url) {
      window.open(citation.url, "_blank", "noopener,noreferrer");
    }
  }

  function renderCitationChip(citation: ClaimCitation) {
    const label =
      citation.sourceType === "datasheet"
        ? `P${citation.page ?? "?"}`
        : citation.title ?? "Public source";

    return (
      <button
        key={citation.id}
        type="button"
        className="suggestion-chip"
        onClick={() => handleCitationJump(citation)}
      >
        {label}
      </button>
    );
  }

  function renderClaimMeta(claim: Pick<ReportClaim, "sourceType" | "citations">) {
    const hasCitations = claim.citations.length > 0;

    return (
      <div className="claim-meta-row">
        <span className={`status-chip status-${claim.sourceType === "review" ? "needs_review" : "confirmed"}`}>
          {sourceTypeLabel(claim.sourceType)}
        </span>
        {hasCitations ? <div className="claim-citation-chips">{claim.citations.map(renderCitationChip)}</div> : null}
      </div>
    );
  }

  function renderReportClaim(claim: ReportClaim) {
    return (
      <div key={claim.id} className="dialog-parameter-row">
        <div className="dialog-parameter-copy">
          <div className="parameter-mainline">
            <strong>{claim.title ?? claim.label}</strong>
          </div>
          {claim.value ? <span className="dialog-parameter-value">{claim.value}</span> : null}
          {claim.body ? <p className="parameter-hint">{claim.body}</p> : null}
          {renderClaimMeta(claim)}
        </div>
      </div>
    );
  }

  const taskThread = messages.find((message): message is TaskThreadMessage => message.kind === "task") ?? null;
  const renderedAnalysis = analysis;
  const hasReportContent = hasDisplayableReportContent(renderedAnalysis?.report);
  const hasSummaryContent = hasDisplayableSummaryContent(renderedAnalysis);
  const hasParameterContent = (renderedAnalysis?.keyParameters.length ?? 0) > 0;
  const hasFastStageVisible = hasFastParameterStage(renderedAnalysis);
  const parameterInteractiveAnalysis =
    (taskThread?.status === "complete" || taskThread?.status === "partial" || hasFastStageVisible) &&
    renderedAnalysis &&
    hasParameterContent
      ? renderedAnalysis
      : null;
  const interactiveAnalysis =
    taskThread?.status === "complete" && renderedAnalysis && hasFullReportStage(renderedAnalysis) && hasDisplayableResultContent(renderedAnalysis)
      ? renderedAnalysis
      : null;
  const prioritizedParameters = parameterInteractiveAnalysis ? prioritizeParameters(parameterInteractiveAnalysis.keyParameters) : [];
  const prioritizedNavParameters = prioritizedParameters.slice(0, 5);
  const currentSuggestions = interactiveAnalysis ? suggestionPrompts(interactiveAnalysis) : [];
  const canAskFollowUp = Boolean(interactiveAnalysis);
  const latestAssistantTextMessage =
    [...messages]
      .reverse()
      .find((message): message is Extract<ChatMessage, { kind: "text"; role: "assistant" }> => message.kind === "text" && message.role === "assistant") ??
    null;
  const reportEvidenceClaims = hasReportContent && (taskThread?.status === "complete" || taskThread?.status === "partial")
    ? [...(renderedAnalysis?.report?.risks ?? []), ...(renderedAnalysis?.report?.openQuestions ?? [])].filter(
        (claim) => claim.sourceType !== "review"
      )
    : [];
  const reportReviewClaims = hasReportContent && (taskThread?.status === "complete" || taskThread?.status === "partial")
    ? [...(renderedAnalysis?.report?.risks ?? []), ...(renderedAnalysis?.report?.openQuestions ?? [])].filter(
        (claim) => claim.sourceType === "review"
      )
    : [];

  async function submitSuggestedQuestion(question: string) {
    if (!renderedAnalysis || !currentPdf) return;
    setMessages((current) => [
      ...current,
      {
        id: `user-suggestion-${Date.now()}`,
        role: "user",
        kind: "text",
        content: question
      }
    ]);
    setIsAsking(true);

    try {
      const followUp = await submitFollowUp(question);
      setMessages((current) => [
        ...current,
        {
          id: `followup-assistant-${followUp.messageId ?? Date.now()}`,
          role: "assistant",
          kind: "text",
          content: followUp.answer,
          claims: followUp.claims,
          warnings: followUp.warnings ?? followUp.followUpWarnings,
          usedSources: followUp.usedSources
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-suggestion-${Date.now()}`,
          role: "assistant",
          kind: "text",
          content: error instanceof Error ? error.message : "追问失败，请稍后重试。"
        }
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main
      className={`app-shell ${currentPdf ? "has-task" : "is-empty"} ${isSidebarCollapsed ? "is-sidebar-collapsed" : "is-sidebar-open"} ${currentPdf && isPdfPanelOpen ? "is-pdf-open" : "is-pdf-closed"}`}
    >
      <input
        id={uploadId}
        aria-label="上传数据手册 PDF"
        className="hidden-file-input"
        type="file"
        accept="application/pdf"
        onChange={handleUploadInputChange}
      />

      <aside className={`rail-column ${isSidebarCollapsed ? "is-collapsed" : "is-open"}`}>
        <div className="rail-top">
          <div className="rail-brand" aria-label="Pin2pin Atlas">
            AT
          </div>
          <button
            type="button"
            className="rail-toggle"
            aria-label={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            onClick={() => setIsSidebarCollapsed((current) => !current)}
          >
            <span aria-hidden="true">{isSidebarCollapsed ? "›" : "‹"}</span>
          </button>
        </div>

        <nav className="rail-nav" aria-label="主导航">
          <button type="button" className="rail-icon is-active" aria-label="首页" title="首页">
            <span aria-hidden="true">⌂</span>
            <span className="rail-icon-label">首页</span>
          </button>
          <button type="button" className="rail-icon" aria-label="任务" title="任务">
            <span aria-hidden="true">◫</span>
            <span className="rail-icon-label">任务</span>
          </button>
          <button type="button" className="rail-icon" aria-label="收藏" title="收藏">
            <span aria-hidden="true">★</span>
            <span className="rail-icon-label">收藏</span>
          </button>
        </nav>

        <div className="rail-side-content">
          <section className="sidebar-section">
            <div className="sidebar-section-header">
              <span className="eyebrow">Workspace</span>
              <strong>{currentPdf ? "当前任务" : "最近任务"}</strong>
            </div>
            {currentPdf ? (
              <div className="sidebar-task-card">
                <strong>{currentPdf.taskName}</strong>
                <span>{currentPdf.fileName}</span>
                <div className="control-summary-meta">
                  <span>{currentPdf.chipName}</span>
                  <span>{currentJobId ? "任务已创建" : "正在准备"}</span>
                </div>
              </div>
            ) : (
              <p className="control-empty">上传后会在这里保留当前任务和恢复入口。</p>
            )}
          </section>

          <section className="sidebar-section">
            <div className="sidebar-section-header">
              <strong>最近任务</strong>
              <span>恢复会话</span>
            </div>
            <div className="history-list">
              {recentTasks.length ? (
                recentTasks.map((task) => (
                  <button
                    key={task.jobId}
                    type="button"
                    className="history-item"
                    aria-label={`打开最近任务 ${task.taskName}`}
                    onClick={() => void handleOpenRecentTask(task.jobId)}
                  >
                    <strong>{task.taskName}</strong>
                    <span>{task.fileName}</span>
                    <small>{`${taskStatusLabel(task.status)} · ${formatRecentTaskTime(task.updatedAt)}`}</small>
                  </button>
                ))
              ) : (
                <p className="control-empty">还没有最近任务，上传第一份 datasheet 开始。</p>
              )}
            </div>
          </section>

          <section className="sidebar-section">
            <div className="sidebar-section-header">
              <strong>参数导航</strong>
              <span>低频入口</span>
            </div>
            {parameterInteractiveAnalysis ? (
              <div className="parameter-nav-list">
                {prioritizedNavParameters.map((item) => {
                  const evidence = parameterInteractiveAnalysis.evidence.find((entry) => entry.id === item.evidenceId);
                  return (
                    <button
                      key={`nav-${item.name}`}
                      type="button"
                      className={`parameter-nav-item ${item.status === "needs_review" ? "is-review" : ""}`}
                      onClick={() => {
                        setFocusedEvidence(evidence ?? null);
                        if (!isPdfPanelOpen) {
                          setIsPdfPanelOpen(true);
                        }
                        flashParameterRow(item);
                      }}
                    >
                      <span>{displayParameterName(item.name)}</span>
                      <small>{item.value}</small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="control-empty">参数处理优先放在中间对话区，这里只保留低频跳转。</p>
            )}
          </section>
        </div>

        {currentUser ? (
          <div className="rail-user">
            <div className="rail-avatar">{currentUser.displayName.trim().charAt(0).toUpperCase() || "U"}</div>
            <span className="rail-user-label">{currentUser.displayName}</span>
            <button type="button" className="rail-logout" onClick={handleLogout}>
              退出登录
            </button>
          </div>
        ) : (
          <div className="rail-avatar">J</div>
        )}
      </aside>

      <section className="dialog-column">
        <header className="dialog-header">
          <div className="dialog-header-copy">
            <p className="eyebrow">Copilot</p>
            <h2>{currentPdf?.chipName ?? "Atlas Copilot"}</h2>
            <p className="dialog-header-subtitle">
              {currentPdf
                ? "围绕当前 datasheet 的总结、参数确认、导出和后续提问都在这里进行。"
                : "先把 PDF 拖进来。Atlas 会先给你总结、关键参数和可回查证据。"}
            </p>
          </div>
          {currentPdf ? (
            <button
              type="button"
              className="inline-action dialog-pdf-toggle"
              onClick={() => setIsPdfPanelOpen((current) => !current)}
            >
              {isPdfPanelOpen ? "收起 PDF" : "展开 PDF"}
            </button>
          ) : null}
        </header>

        {!currentPdf ? (
          <section
            className={`empty-dropzone ${isDragActive ? "is-drag-active" : ""}`}
            onDragOver={handleUploadDragOver}
            onDragLeave={handleUploadDragLeave}
            onDrop={handleUploadDrop}
          >
            <div className="empty-dropzone-inner">
              <p className="workspace-start-kicker">Atlas Workspace</p>
              <h1>拖入一份 datasheet PDF，直接开始分析</h1>
              <p>
                像 GPT 或 Gemini 一样先从输入区进入，但上传后会自动切到带 PDF 证据校验的工作台。
              </p>
              <div className="workspace-start-flow" aria-hidden="true">
                <span>Drag PDF</span>
                <span>Analyze</span>
                <span>Review evidence</span>
              </div>
              <label htmlFor={uploadId} className="empty-dropzone-cta">
                选择 PDF 或直接拖入
              </label>
              <p className="empty-dropzone-hint">支持单个 datasheet PDF，选中后立即开始分析，不需要再点第二个提交按钮。</p>
              {latestAssistantTextMessage ? <p className="empty-dropzone-error">{latestAssistantTextMessage.content}</p> : null}
            </div>
          </section>
        ) : (
        <div className="messages">
          {!taskThread ? (
            <article className="message assistant intro-card">
              <div className="dialog-message-block">
                <div className="assistant-avatar">AT</div>
                <div className="assistant-bubble">
                  <span className="message-kicker">Atlas Copilot</span>
                  <p>上传一份 datasheet 后，这里会依次给出 summary、风险待确认项、关键参数、导出和 follow-up。</p>
                  <div className="dialog-empty-points" aria-hidden="true">
                    <span>Summary first</span>
                    <span>Evidence-linked</span>
                    <span>Ask follow-up</span>
                  </div>
                </div>
              </div>
            </article>
          ) : null}

          {messages.map((message) => {
            if (message.kind === "welcome") return null;

            if (message.kind === "task") {
              const taskAnalysis = renderedAnalysis;
              const taskInteractiveAnalysis = parameterInteractiveAnalysis;
              const report = taskAnalysis?.report ?? null;
              const processingElapsed = message.status === "processing" ? formatElapsedDuration(message.updatedAt, nowMs) : null;

              return (
                <article key={message.id} className="message assistant dialog-thread-card">
                  <div className="thread-title-row">
                    <div>
                      <h3>{message.pdf.chipName.toUpperCase().includes("LMR51430") ? "LMR51430" : message.pdf.chipName}</h3>
                      <p className="dialog-subtitle">{message.pdf.taskName}</p>
                    </div>
                    <div className="thread-meta">
                      <span className={`task-status-chip is-${message.status}`}>
                        {message.status === "processing" && processingElapsed
                          ? `${taskStatusLabel(message.status)} ${processingElapsed}`
                          : taskStatusLabel(message.status)}
                      </span>
                      <span className="dialog-file">{message.pdf.fileName}</span>
                      <span className="dialog-file">{formatRecentTaskTime(message.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="task-timeline" role="list" aria-label="AI Task 时间线">
                    {message.steps.map((step) => (
                      <div key={step.id} className={`timeline-step is-${step.status}`} role="listitem">
                        <div className="timeline-marker" aria-hidden="true" />
                        <div className="timeline-copy">
                          <strong>{step.title}</strong>
                          <p>{step.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {buildTaskNote(message.status, message.warnings, message.note) ? (
                    <div className="dialog-inline-note">
                      <p>{buildTaskNote(message.status, message.warnings, message.note)}</p>
                      {message.note?.includes("继续等待") ? (
                        <button
                          type="button"
                          className="inline-action"
                          onClick={handleResumePolling}
                          disabled={!currentJobId || !currentPdf || isPolling}
                        >
                          {isPolling ? "继续等待中..." : "继续等待当前任务"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {runtimePathLabel(taskAnalysis?.sourceAttribution, message.status) ? (
                    <div className="dialog-inline-note">
                      <p>{runtimePathLabel(taskAnalysis?.sourceAttribution, message.status)}</p>
                    </div>
                  ) : null}

                  {taskAnalysis && (interactiveAnalysis || taskAnalysis.sourceAttribution?.mode === "failed" || taskInteractiveAnalysis) ? (
                    <>
                      {interactiveAnalysis || taskAnalysis.sourceAttribution?.mode === "failed" ? (
                      <div className="dialog-message-block">
                          <div className="assistant-avatar">AT</div>
                          <div className="assistant-bubble">
                            {hasReportContent && report ? (
                              <>
                                <span className="message-kicker">Final report</span>
                                <strong>最终报告</strong>
                                {hasVisibleText(report.executiveSummary) ? <p>{report.executiveSummary}</p> : null}
                                {report.citations.length ? renderClaimMeta({
                                  sourceType: "datasheet",
                                  citations: report.citations
                                }) : null}
                                {taskAnalysis.sourceAttribution?.mode === "failed" ? (
                                  <p>{message.warnings[0]}</p>
                                ) : null}
                                {report.sections
                                  .filter((section) => section.title !== "最终报告")
                                  .filter((section) => hasVisibleText(section.title) || hasVisibleText(section.body))
                                  .map((section) => (
                                    <div key={section.id} className="dialog-parameter-row">
                                      <div className="dialog-parameter-copy">
                                        <div className="parameter-mainline">
                                          <strong>{section.title}</strong>
                                        </div>
                                        <p>{section.body}</p>
                                        {renderClaimMeta(section)}
                                      </div>
                                    </div>
                                  ))}
                              </>
                            ) : (
                              <>
                                {hasVisibleText(taskAnalysis.summary) ? <p>{taskAnalysis.summary}</p> : null}
                                {hasVisibleText(taskAnalysis.review) ? <p>{taskAnalysis.review}</p> : null}
                                {taskAnalysis.sourceAttribution?.mode === "failed" ? (
                                  <p>{message.warnings[0]}</p>
                                ) : null}
                              </>
                            )}
                          </div>
                        </div>
                      ) : null}

                      {hasReportContent ? (
                        <div className="dialog-message-block">
                          <div className="assistant-avatar">AT</div>
                          <div className="assistant-bubble parameter-bubble">
                            <span className="message-kicker">Review queue</span>
                            <strong>风险与待确认项</strong>
                            <div className="dialog-risk-groups">
                              {reportEvidenceClaims.length ? (
                                <section className="dialog-risk-group">
                                  <div className="dialog-risk-group-header">
                                    <strong>{riskGroupTitle("evidence")}</strong>
                                    <span>{`${reportEvidenceClaims.length} 项`}</span>
                                  </div>
                                  {reportEvidenceClaims.map(renderReportClaim)}
                                </section>
                              ) : null}
                              {reportReviewClaims.length ? (
                                <section className="dialog-risk-group">
                                  <div className="dialog-risk-group-header">
                                    <strong>{riskGroupTitle("review")}</strong>
                                    <span>{`${reportReviewClaims.length} 项`}</span>
                                  </div>
                                  {reportReviewClaims.map(renderReportClaim)}
                                </section>
                              ) : null}
                              {reportEvidenceClaims.length === 0 && reportReviewClaims.length === 0 ? (
                                <p className="export-note">当前报告没有额外风险或待确认项。</p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {hasReportContent && report && report.keyParameters.length > 0 ? (
                        <div className="dialog-message-block">
                          <div className="assistant-avatar">AT</div>
                          <div className="assistant-bubble parameter-bubble">
                            <span className="message-kicker">Structured output</span>
                            <strong>关键参数表</strong>
                            {report.keyParameters.map(renderReportClaim)}
                          </div>
                        </div>
                      ) : null}

                      {taskInteractiveAnalysis && hasParameterContent ? (
                      <div className="dialog-message-block">
                        <div className="assistant-avatar">AT</div>
                        <div className="assistant-bubble parameter-bubble">
                          <span className="message-kicker">Parameter review</span>
                          <strong>关键参数表</strong>
                          {prioritizedParameters.map((item) => {
                            const evidence = taskInteractiveAnalysis.evidence.find((entry) => entry.id === item.evidenceId);
                            const isEditing = editingParameter === item.name;
                            const writeback = writebackState[parameterWritebackKey(item.name, item.evidenceId)];
                            const rowKey = parameterWritebackKey(item.name, item.evidenceId);

                            return (
                              <div
                                key={item.name}
                                className={`dialog-parameter-row ${highlightedParameterKey === rowKey ? "is-focused" : ""}`}
                              >
                                <div className="dialog-parameter-copy">
                                  <div className="parameter-mainline">
                                    <strong>{displayParameterName(item.name)}</strong>
                                    <span className={`status-chip status-${item.status}`}>{statusLabel(item.status)}</span>
                                  </div>
                                  <p className={`parameter-hint ${item.status === "needs_review" ? "is-review" : ""}`}>
                                    {statusHint(item.status)}
                                  </p>
                                  {isEditing ? (
                                    <label className="parameter-edit">
                                      <span className="sr-only">{`修改参数 ${item.name}`}</span>
                                      <input
                                        aria-label={`修改参数 ${item.name}`}
                                        value={draftValue}
                                        onChange={(event) => setDraftValue(event.target.value)}
                                      />
                                    </label>
                                  ) : (
                                    <span className="dialog-parameter-value">{item.value}</span>
                                  )}
                                </div>

                                <div className="dialog-parameter-actions">
                                  <button
                                    type="button"
                                    className="inline-action"
                                    disabled={!evidence}
                                    onClick={() => {
                                      setFocusedEvidence(evidence ?? null);
                                      flashParameterRow(item);
                                    }}
                                  >
                                    定位到证据
                                  </button>
                                  {item.status === "needs_review" ? (
                                    <>
                                      <button
                                        type="button"
                                        className="inline-action"
                                        aria-label={`确认参数 ${item.name}`}
                                        onClick={() => handleConfirm(item)}
                                        disabled={writeback?.status === "saving"}
                                      >
                                        确认
                                      </button>
                                      {isEditing ? (
                                        <button
                                          type="button"
                                          className="inline-action"
                                          aria-label={`保存参数 ${item.name}`}
                                          onClick={() => handleSave(item)}
                                          disabled={writeback?.status === "saving"}
                                        >
                                          保存
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="inline-action"
                                          aria-label={`修改参数 ${item.name}`}
                                          onClick={() => handleStartEdit(item)}
                                          disabled={writeback?.status === "saving"}
                                        >
                                          修改
                                        </button>
                                      )}
                                    </>
                                  ) : null}
                                  {writeback?.status === "failed" ? (
                                    <button
                                      type="button"
                                      className="inline-action"
                                      aria-label={`重试写回参数 ${item.name}`}
                                      onClick={() => handleRetryWriteback(item)}
                                    >
                                      重试
                                    </button>
                                  ) : null}
                                </div>
                                {writeback?.status === "failed" ? (
                                  <p className="parameter-hint is-review">{WRITEBACK_FAILURE_MESSAGE}</p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      ) : null}

                      {interactiveAnalysis && hasParameterContent ? (
                      <div className="dialog-message-block">
                        <div className="assistant-avatar">AT</div>
                        <div className="assistant-bubble export-bubble">
                          <span className="message-kicker">Export</span>
                          <div className="export-header">
                            <strong>导出给下游继续使用</strong>
                            <span>{exportableParameterCount > 0 ? "CSV 可导出" : "CSV 暂不可导出"}</span>
                          </div>
                          <p className="export-note">
                            CSV 只包含已确认或已修正的参数，避免把待确认值直接写入下游。
                          </p>
                          <div className="export-stats">
                            <span>{`已确认参数 ${exportableParameterCount} 个`}</span>
                            <span>{`人工修正 ${manualCorrectionCount} 次`}</span>
                          </div>
                          {correctionCount > 0 ? (
                            <p className="export-note">{`本次任务已记录 ${correctionCount} 次人工确认或修正。`}</p>
                          ) : null}
                          <div className="dialog-parameter-actions">
                            <button type="button" className="inline-action" onClick={handleExportJson}>
                              导出当前任务 JSON
                            </button>
                            <button type="button" className="inline-action" onClick={handleExportHtml}>
                              导出当前任务 HTML
                            </button>
                            <button
                              type="button"
                              className="inline-action"
                              onClick={handleExportCsv}
                              disabled={exportableParameterCount === 0}
                            >
                              导出已确认参数 CSV
                            </button>
                          </div>
                          {exportableParameterCount === 0 ? (
                            <p className="export-note">先确认至少一个参数，再导出干净的参数表。</p>
                          ) : null}
                          {exportNotice ? <p className="export-success">{exportNotice}</p> : null}
                        </div>
                      </div>
                      ) : null}

                      {interactiveAnalysis ? (
                      <div className="dialog-suggestions">
                        {currentSuggestions.map((question) => (
                          <button
                            key={question}
                            type="button"
                            className="suggestion-chip"
                            onClick={() => submitSuggestedQuestion(question)}
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                      ) : null}
                    </>
                  ) : null}
                </article>
              );
            }

            if (message.kind === "correction") {
              return (
                <article key={message.id} className="message assistant correction-card">
                  <span className="message-kicker">Correction</span>
                  <p>{message.content}</p>
                </article>
              );
            }

            return (
              <article key={message.id} className={`message ${message.role}`}>
                {message.role === "assistant" ? <span className="message-kicker">Assistant</span> : null}
                <p>{message.content}</p>
                {message.role === "assistant" && message.claims?.length ? (
                  <div className="assistant-bubble parameter-bubble">
                    {message.claims.map(renderReportClaim)}
                  </div>
                ) : null}
                {message.role === "assistant" && message.warnings?.length ? (
                  <p className="parameter-hint is-review">{message.warnings.join("；")}</p>
                ) : null}
                {message.role === "assistant" && message.usedSources?.length ? (
                  <p className="parameter-hint">{sourceListLabel(message.usedSources)}</p>
                ) : null}
              </article>
            );
          })}
        </div>
        )}

        <div className="composer-card">
          <label htmlFor={currentPdf && canAskFollowUp ? "follow-up" : uploadId}>{currentPdf && canAskFollowUp ? "继续提问" : "上传 datasheet PDF"}</label>
          {currentPdf && canAskFollowUp ? (
            <>
              <textarea
                id="follow-up"
                aria-label="继续提问"
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                placeholder="继续问这份数据手册..."
              />
              <button type="button" onClick={handleAsk} disabled={isAsking}>
                {isAsking ? "发送中..." : "发送问题"}
              </button>
            </>
          ) : (
            <div
              className={`composer-upload-surface ${isDragActive ? "is-drag-active" : ""}`}
              onDragOver={handleUploadDragOver}
              onDragLeave={handleUploadDragLeave}
              onDrop={handleUploadDrop}
            >
              <div className="composer-upload-copy">
                <strong>拖入 PDF，开始一个新的 Atlas 任务</strong>
                <p>不会先占一个空白 PDF 预览区。上传后自动进入对话 + 证据工作台。</p>
              </div>
              <label htmlFor={uploadId} className="file-picker-button composer-upload-button">
                选择 PDF
              </label>
            </div>
          )}
        </div>
      </section>

      {currentPdf && isPdfPanelOpen ? (
        <section className="canvas-column">
          <div className="pdf-canvas">
            <div className="canvas-topbar">
              <div className="canvas-topbar-copy">
                <span className="canvas-kicker">当前文档</span>
                <strong>{currentPdf.fileName}</strong>
              </div>
              <div className="canvas-toolbar">
                <span>{focusedEvidence ? `第 ${focusedEvidence.page} 页` : "第 1 页"}</span>
                <span>/</span>
                <span>{currentPdf.pageCount}</span>
              </div>
            </div>
            <div className="pdf-stage">
              <div className="pdf-sheet">
                <iframe
                  key={previewUrl(currentPdf, focusedEvidence)}
                  title="PDF 预览"
                  className="pdf-frame"
                  src={previewUrl(currentPdf, focusedEvidence)}
                />
                {focusedEvidence ? (
                  <div
                    data-testid="evidence-highlight"
                    className="evidence-highlight"
                    style={{
                      left: `${focusedEvidence.rect.left}%`,
                      top: `${focusedEvidence.rect.top}%`,
                      width: `${focusedEvidence.rect.width}%`,
                      height: `${focusedEvidence.rect.height}%`
                    }}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
