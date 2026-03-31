import { getParameterTemplate } from "@/lib/parameter-templates";
import type {
  ClaimCitation,
  DocumentPreparation,
  FollowUpResponse,
  IdentityClassification,
  ParameterArbitrationNote,
  ParameterDraft,
  ParameterItem,
  PublicContext,
  ReportClaim,
  ReportOutput
} from "@/lib/types";
import type {
  IdentityClassificationInput,
  LlmProvider,
  ParameterArbitrationInput,
  ParameterExtractionInput,
  ReportSynthesisInput,
  SearchProvider
} from "@/lib/providers";

function chooseTemplate(preparation: DocumentPreparation) {
  const title = `${preparation.identityCandidates.documentTitle ?? ""} ${preparation.identityCandidates.sku ?? ""}`.toLowerCase();
  const localNames = preparation.localCandidates.map((item) => item.name.toLowerCase());

  if (title.includes("pam") || localNames.includes("rffe bus") || localNames.includes("supported bands")) {
    return "cellular-3g4g5g";
  }

  if (title.includes("wlan") || title.includes("front-end") || title.includes("wifi")) {
    return "wifi";
  }

  if (title.includes("flash") || title.includes("spi") || title.includes("qspi") || title.includes("qpi")) {
    return "serial-flash";
  }

  if (title.includes("ldo") || title.includes("low-dropout") || localNames.includes("voltage dropout (max)")) {
    return "power";
  }

  if (title.includes("buck") || title.includes("boost") || localNames.includes("frequency - switching") || localNames.includes("voltage - input (max)")) {
    return "power";
  }

  if (title.includes("amplifier") || title.includes("codec") || title.includes("audio")) {
    return "audio";
  }

  return "generic-fallback";
}

function mapDeviceClass(templateId: string) {
  return getParameterTemplate(templateId).deviceClass;
}

function buildDatasheetCitation(id: string, page: number, quote: string): ClaimCitation {
  return {
    id,
    sourceType: "datasheet",
    page,
    quote
  };
}

function buildParameterClaims(preparation: DocumentPreparation, templateId: string): ReportClaim[] {
  const template = getParameterTemplate(templateId);
  const fieldSet = new Set(template.fields.map((field) => field.name));

  return preparation.localCandidates
    .filter((candidate) => fieldSet.has(candidate.name))
    .map((candidate, index) => ({
      id: `mock-claim-${index + 1}`,
      label: candidate.name,
      value: candidate.value,
      sourceType: "datasheet" as const,
      citations: [buildDatasheetCitation(`mock-citation-${index + 1}`, candidate.page, candidate.quote)]
    }));
}

function buildParameterDrafts(preparation: DocumentPreparation, templateId: string): ParameterDraft[] {
  return buildParameterClaims(preparation, templateId).map((claim) => ({
    name: claim.label,
    value: claim.value ?? claim.body ?? "",
    sourceType: claim.sourceType,
    citations: claim.citations,
    producer: "gpt-4o"
  }));
}

function buildFocusClaims(identity: IdentityClassification, preparation: DocumentPreparation): ReportClaim[] {
  return identity.focusChecklist.map((item, index) => ({
    id: `mock-focus-${index + 1}`,
    label: item,
    title: item,
    body: `优先结合 datasheet 原文核对 ${item}。`,
    sourceType: "review" as const,
    citations:
      preparation.localCandidates.find((candidate) => candidate.name === item)
        ? [
            buildDatasheetCitation(
              `mock-focus-citation-${index + 1}`,
              preparation.localCandidates.find((candidate) => candidate.name === item)?.page ?? 1,
              preparation.localCandidates.find((candidate) => candidate.name === item)?.quote ?? ""
            )
          ]
        : []
  }));
}

function buildPublicClaims(publicContext: PublicContext[]): ReportClaim[] {
  return publicContext.map((item, index) => ({
    id: `mock-public-${index + 1}`,
    label: item.title,
    title: item.title,
    body: item.snippet,
    sourceType: "public" as const,
    citations: [
      {
        id: `mock-public-citation-${index + 1}`,
        sourceType: "public",
        url: item.url,
        title: item.title,
        snippet: item.snippet
      }
    ]
  }));
}

export class MockLlmProvider implements LlmProvider {
  async classifyIdentity(input: IdentityClassificationInput): Promise<IdentityClassification> {
    const parameterTemplateId = chooseTemplate(input.preparation);

    return {
      canonicalPartNumber: input.preparation.identityCandidates.sku ?? "UNKNOWN",
      manufacturer: input.preparation.identityCandidates.manufacturer ?? "Unknown",
      deviceClass: mapDeviceClass(parameterTemplateId),
      parameterTemplateId,
      focusChecklist: getParameterTemplate(parameterTemplateId).focusAreas,
      publicContext: input.publicContext,
      confidence: 0.78
    };
  }

  async synthesizeReport(input: ReportSynthesisInput): Promise<ReportOutput> {
    const keyParameters = buildParameterClaims(input.preparation, input.identity.parameterTemplateId);
    const designFocus = buildFocusClaims(input.identity, input.preparation);
    const publicNotes = buildPublicClaims(input.publicContext);
    const executiveSummary = `${input.identity.canonicalPartNumber} 已完成教学式工程整理，重点结论仍以 datasheet 为准。`;
    const claims = [...keyParameters, ...designFocus, ...publicNotes];

    return {
      executiveSummary,
      deviceIdentity: {
        canonicalPartNumber: input.identity.canonicalPartNumber,
        manufacturer: input.identity.manufacturer,
        deviceClass: input.identity.deviceClass,
        parameterTemplateId: input.identity.parameterTemplateId,
        confidence: input.identity.confidence
      },
      keyParameters,
      designFocus,
      risks: [],
      openQuestions: [],
      publicNotes,
      citations: claims.flatMap((claim) => claim.citations),
      sections: [
        {
          id: "device_identity",
          title: "器件身份",
          body: `${input.identity.manufacturer} ${input.identity.canonicalPartNumber}，类别为 ${input.identity.deviceClass}。`,
          sourceType: "review",
          citations: []
        },
        {
          id: "what_this_part_is_for",
          title: "这颗器件是做什么的",
          body: "先用首页标题、feature list 和主要参数判断它在系统里的角色，不要一开始就掉进长表格。",
          sourceType: "review",
          citations: []
        },
        {
          id: "how_to_read_this_datasheet",
          title: "怎么读这份 Datasheet",
          body: "先看首页与 feature list，再看 Absolute Maximum、Recommended Operating Conditions、电气特性表，最后再看控制接口、封装、布局和典型曲线。",
          sourceType: "review",
          citations: []
        },
        {
          id: "section_by_section_reading_order",
          title: "章节阅读顺序",
          body: "首页与定位 -> 关键特性 -> 电气特性及 test condition -> 控制接口 -> 封装布局 -> 典型曲线与脚注。",
          sourceType: "review",
          citations: []
        },
        {
          id: "critical_graphs_and_tables",
          title: "重点表格与图",
          body: "优先核对支持频段、输出功率、控制接口和封装相关表格，再决定是否继续深读典型曲线。",
          sourceType: "review",
          citations: []
        },
        {
          id: "intern_action_list",
          title: "实习生下一步动作",
          body: "逐项回查关键参数的 datasheet 原文，确认 test condition、脚注与封装落地约束。",
          sourceType: "review",
          citations: []
        },
        {
          id: "glossary_for_juniors",
          title: "给新人的术语表",
          body: "RFFE 是射频前端控制接口；linearity 指线性指标；typical 不是保证值。",
          sourceType: "review",
          citations: []
        }
      ],
      claims
    };
  }

  async extractKeyParameters(input: ParameterExtractionInput): Promise<ParameterDraft[]> {
    return buildParameterDrafts(input.preparation, input.identity.parameterTemplateId);
  }

  async arbitrateParameterConflict(input: ParameterArbitrationInput): Promise<ParameterArbitrationNote | null> {
    if (!input.fastDraft || !input.reportDraft || input.fastDraft.value === input.reportDraft.value) {
      return null;
    }

    return {
      fieldName: input.fieldName,
      decision: "keep_both_needs_review",
      recommendedValue: input.reportDraft.value,
      reason: "Mock arbitration keeps the report-path value but still requires review.",
      reviewSourceLabel: "Mock Arbitration"
    };
  }

  async answerFollowUp(input: {
    pdfBuffer: Uint8Array;
    fileName: string;
    taskName: string;
    chipName: string;
    preparation: DocumentPreparation;
    identity: IdentityClassification;
    parameterTemplate: ReturnType<typeof getParameterTemplate>;
    report: ReportOutput;
    keyParameters: ParameterItem[];
    publicContext: PublicContext[];
    question: string;
  }): Promise<FollowUpResponse> {
    const topClaims = input.report.keyParameters.slice(0, 3);
    const claims = topClaims.length
      ? topClaims
      : input.keyParameters.slice(0, 3).map((item, index) => ({
          id: `follow-local-${index + 1}`,
          label: item.name,
          value: item.value,
          title: item.name,
          body: `${item.name}: ${item.value}`,
          sourceType: "review" as const,
          citations: []
        }));

    const publicClaim = input.publicContext[0]
      ? {
          id: "follow-public-1",
          label: input.publicContext[0].title,
          title: input.publicContext[0].title,
          body: input.publicContext[0].snippet,
          sourceType: "public" as const,
          citations: [
            {
              id: "follow-public-citation-1",
              sourceType: "public" as const,
              url: input.publicContext[0].url,
              title: input.publicContext[0].title,
              snippet: input.publicContext[0].snippet
            }
          ]
        }
      : null;

    return {
      answer: `围绕“${input.question}”，建议先看 ${claims
        .map((claim) => claim.label)
        .filter(Boolean)
        .join("、")}，再结合公网补充判断风险与兼容性。`,
      claims: publicClaim ? [...claims, publicClaim] : claims,
      citations: [...claims.flatMap((claim) => claim.citations), ...(publicClaim?.citations ?? [])],
      usedSources: publicClaim ? ["datasheet", "public"] : ["datasheet"],
      followUpWarnings: [],
      sourceAttribution: {
        mode: input.preparation.documentMeta.extractionMethod === "opendataloader" ? "llm_first_with_odl" : "llm_first"
      }
    };
  }
}

export class MockSearchProvider implements SearchProvider {
  async searchPartContext(input: { sku: string | null; manufacturer: string | null }): Promise<PublicContext[]> {
    if (!input.sku) {
      return [];
    }

    return [
      {
        id: `mock-public-${input.sku}`,
        title: `${input.manufacturer ?? "Unknown"} ${input.sku} overview`,
        url: `https://example.com/parts/${encodeURIComponent(input.sku)}`,
        snippet: `${input.sku} public overview for category validation.`,
        sourceType: "public"
      }
    ];
  }
}
