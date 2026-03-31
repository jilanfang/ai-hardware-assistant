import type { AnalysisEvent, AnalysisResult, EvidenceTarget, ParameterItem, ParameterProvenance } from "@/lib/types";

type ProvenanceInput = {
  extractedBy: ParameterProvenance["extractedBy"];
  confidence: ParameterProvenance["confidence"];
  confidenceReason: string;
  evidence?: EvidenceTarget | null;
};

type ParameterActionInput = {
  action: "confirm" | "edit";
  parameterName: string;
  evidenceId: string;
  nextValue?: string;
  createdAt?: string;
};

function nowIso() {
  return new Date().toISOString();
}

export function createAnalysisEvent(event: Omit<AnalysisEvent, "id" | "createdAt"> & { createdAt?: string }): AnalysisEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: event.createdAt ?? nowIso(),
    ...event
  };
}

export function buildParameterProvenance(input: ProvenanceInput): ParameterProvenance {
  return {
    extractedBy: input.extractedBy,
    confidence: input.confidence,
    confidenceReason: input.confidenceReason,
    sourcePages: input.evidence ? [input.evidence.page] : [],
    sourceQuote: input.evidence?.quote ?? ""
  };
}

export function addInitialAnalysisMetadata(
  analysis: Omit<AnalysisResult, "events"> & { events?: AnalysisEvent[] },
  extractedBy: ProvenanceInput["extractedBy"]
): AnalysisResult {
  const keyParameters: ParameterItem[] = analysis.keyParameters.map((item) => {
    const evidence = analysis.evidence.find((entry) => entry.id === item.evidenceId);
    const confidence = item.status === "needs_review" ? "review" : "high";
    const confidenceReason =
      item.status === "needs_review" ? "当前字段仍需要人工确认。" : "字段来自当前 first-pass 提取链路。";

    return {
      ...item,
      provenance:
        item.provenance ??
        buildParameterProvenance({
          extractedBy,
          confidence,
          confidenceReason,
          evidence
        })
    };
  });

  const events =
    analysis.events && analysis.events.length
      ? analysis.events
      : [
          createAnalysisEvent({
            type: "analysis_created",
            summary: "初始分析已生成，可继续做证据验证和人工确认。"
          })
        ];

  return {
    ...analysis,
    keyParameters,
    events
  };
}

export function applyParameterActionToAnalysis(analysis: AnalysisResult, input: ParameterActionInput): AnalysisResult {
  const createdAt = input.createdAt ?? nowIso();

  const keyParameters: ParameterItem[] = analysis.keyParameters.map((item) => {
    if (item.name !== input.parameterName) {
      return item;
    }

    const evidence = analysis.evidence.find((entry) => entry.id === input.evidenceId);

    if (input.action === "confirm") {
      return {
        ...item,
        status: "confirmed",
        provenance: buildParameterProvenance({
          extractedBy: "user_confirmed",
          confidence: "user_verified",
          confidenceReason: "该字段已经被用户明确确认。",
          evidence
        })
      };
    }

    return {
      ...item,
      value: input.nextValue ?? item.value,
      status: "user_corrected",
      provenance: buildParameterProvenance({
        extractedBy: "user_corrected",
        confidence: "user_verified",
        confidenceReason: "该字段已经被用户人工修正。",
        evidence
      })
    };
  });

  const event =
    input.action === "confirm"
      ? createAnalysisEvent({
          type: "parameter_confirmed",
          parameterName: input.parameterName,
          evidenceId: input.evidenceId,
          summary: `参数 ${input.parameterName} 已由用户确认。`,
          createdAt
        })
      : createAnalysisEvent({
          type: "parameter_corrected",
          parameterName: input.parameterName,
          evidenceId: input.evidenceId,
          summary: `参数 ${input.parameterName} 已由用户修正为 ${input.nextValue ?? ""}。`,
          createdAt
        });

  return {
    ...analysis,
    keyParameters,
    events: [...(analysis.events ?? []), event]
  };
}
