import { renderPdfPagesToImages } from "@/lib/pdf-images";
import { logAnalysisEvent } from "@/lib/analysis-observability";
import { buildPromptBundle, getReportOutputContractPrompt } from "@/lib/prompt-templates";
import { resolveRfTemplateDefinition } from "@/lib/rf-template-registry";
import type {
  ClaimCitation,
  FollowUpResponse,
  IdentityClassification,
  ParameterArbitrationNote,
  ParameterDraft,
  ReportClaim,
  ReportOutput
} from "@/lib/types";
import type {
  IdentityClassificationInput,
  LlmProvider,
  ParameterArbitrationInput,
  ParameterExtractionInput,
  ReportSynthesisInput
} from "@/lib/providers";

type OpenAiProviderConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

type GeminiProviderConfig = {
  apiKey: string;
  model: string;
  baseUrl?: string;
};

type LooseObject = Record<string, unknown>;

function ensureApiKey(apiKey: string) {
  if (!apiKey) {
    throw new Error("missing OPENAI_API_KEY");
  }
}

function resolveBaseUrl(baseUrl?: string) {
  return (baseUrl?.trim() || "https://api.openai.com").replace(/\/+$/, "");
}

function resolveGeminiBaseUrl(baseUrl?: string) {
  return (baseUrl?.trim() || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
}

function elapsedMs(startedAtMs: number) {
  return Math.max(0, Date.now() - startedAtMs);
}

function toBase64(buffer: Uint8Array) {
  return Buffer.from(buffer).toString("base64");
}

function buildDataUrlPdf(buffer: Uint8Array) {
  return `data:application/pdf;base64,${toBase64(buffer)}`;
}

function supportsOpenAiResponsesPdf(model: string) {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith("gpt-4o");
}

function pickPagesForClassification(input: IdentityClassificationInput) {
  const pages = [1];
  const hintedPages = input.preparation.localCandidates.slice(0, 2).map((item) => item.page);

  for (const page of hintedPages) {
    if (!pages.includes(page)) {
      pages.push(page);
    }
  }

  return pages.slice(0, 3);
}

function pickPagesForReport(input: ReportSynthesisInput) {
  const pages = [1];

  const isRfTemplate =
    input.identity.parameterTemplateId === "rf-general" ||
    input.identity.parameterTemplateId === "wifi" ||
    input.identity.parameterTemplateId === "cellular-3g4g5g";

  if (input.preparation.documentMeta.extractionMethod === "none") {
    if (input.identity.parameterTemplateId === "cellular-3g4g5g") {
      return [1, 2, 3, 4, 5, 6];
    }

    if (input.identity.parameterTemplateId === "wifi") {
      return [1, 2, 3, 4, 5];
    }

    if (isRfTemplate) {
      return [1, 2, 3, 4];
    }
  }

  for (const packet of input.preparation.pagePackets) {
    if (packet.isHardPage && !pages.includes(packet.page)) {
      pages.push(packet.page);
    }
  }

  for (const candidate of input.preparation.localCandidates) {
    if (!pages.includes(candidate.page)) {
      pages.push(candidate.page);
    }
  }

  return pages.slice(0, 8);
}

async function callChatCompletion(config: OpenAiProviderConfig, body: Record<string, unknown>, signal?: AbortSignal) {
  ensureApiKey(config.apiKey);
  const startedAtMs = Date.now();
  const endpoint = `${resolveBaseUrl(config.baseUrl)}/v1/chat/completions`;

  logAnalysisEvent("provider.request.started", {
    provider: "openai-compatible",
    model: config.model,
    endpoint,
    messageCount: Array.isArray(body.messages) ? body.messages.length : null
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      ...body
    }),
    signal
  });

  if (!response.ok) {
    logAnalysisEvent(
      "provider.request.failed",
      {
        provider: "openai-compatible",
        model: config.model,
        endpoint,
        status: response.status,
        elapsedMs: elapsedMs(startedAtMs)
      },
      "error"
    );
    throw new Error(`openai-compatible request failed: ${response.status}`);
  }

  logAnalysisEvent("provider.request.completed", {
    provider: "openai-compatible",
    model: config.model,
    endpoint,
    status: response.status,
    elapsedMs: elapsedMs(startedAtMs)
  });

  return (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
}

async function callResponsesApi(config: OpenAiProviderConfig, body: Record<string, unknown>, signal?: AbortSignal) {
  ensureApiKey(config.apiKey);
  const startedAtMs = Date.now();
  const endpoint = `${resolveBaseUrl(config.baseUrl)}/v1/responses`;

  logAnalysisEvent("provider.request.started", {
    provider: "openai-compatible",
    transport: "responses",
    model: config.model,
    endpoint,
    inputCount: Array.isArray(body.input) ? body.input.length : null
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      ...body
    }),
    signal
  });

  if (!response.ok) {
    logAnalysisEvent(
      "provider.request.failed",
      {
        provider: "openai-compatible",
        transport: "responses",
        model: config.model,
        endpoint,
        status: response.status,
        elapsedMs: elapsedMs(startedAtMs)
      },
      "error"
    );
    throw new Error(`openai-compatible responses request failed: ${response.status}`);
  }

  logAnalysisEvent("provider.request.completed", {
    provider: "openai-compatible",
    transport: "responses",
    model: config.model,
    endpoint,
    status: response.status,
    elapsedMs: elapsedMs(startedAtMs)
  });

  return (await response.json()) as {
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };
}

function parseJsonFromMessage<T>(content: string | undefined): T {
  if (!content) {
    throw new Error("missing completion content");
  }

  const fenced = content.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? content;
  const normalized = candidate.trim();

  try {
    return JSON.parse(normalized) as T;
  } catch (error) {
    const firstBraceIndex = normalized.search(/[\[{]/);
    if (firstBraceIndex >= 0) {
      const sliced = normalized.slice(firstBraceIndex);
      for (let end = sliced.length; end > 0; end -= 1) {
        const probe = sliced.slice(0, end).trim();
        if (!probe) continue;
        const lastChar = probe.at(-1);
        if (lastChar !== "}" && lastChar !== "]") continue;
        try {
          return JSON.parse(probe) as T;
        } catch {
          continue;
        }
      }
    }

    throw error;
  }
}

function parseGeminiText<T>(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}) {
  const content = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  return parseJsonFromMessage<T>(content);
}

function parseResponsesText<T>(response: {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}) {
  const content = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text ?? "")
    .join("\n")
    .trim();
  return parseJsonFromMessage<T>(content);
}

function reportRepairInstruction() {
  return [
    getReportOutputContractPrompt(),
    "你现在不是重新分析 PDF，而是修复一个已经生成但不符合契约的 JSON。",
    "你只能做字段名映射、层级调整、空字段补齐。",
    "禁止新增原始输出中不存在的新事实。",
    "禁止解释，禁止 markdown，只返回修复后的 JSON。"
  ].join("\n\n");
}

function pickPagesForFollowUp(input: ReportSynthesisInput) {
  return pickPagesForReport(input).slice(0, 6);
}

function asObject(value: unknown): LooseObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as LooseObject) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTemplateId(value: string) {
  if (["rf-general", "audio", "cellular-3g4g5g", "wifi", "power", "serial-flash", "generic-fallback"].includes(value)) {
    return value;
  }

  if (value === "cellular-pam") {
    return "cellular-3g4g5g";
  }

  if (
    value === "wlan-fem" ||
    value === "rf-fem-2.4g" ||
    value === "rf-fem-5ghz" ||
    value === "wifi-fem" ||
    value === "rf-fem-template"
  ) {
    return "wifi";
  }

  if (value === "dc-dc" || value === "ldo") {
    return "power";
  }

  if (value === "spi-nor" || value === "serial-nor-flash" || value === "serial-flash") {
    return "serial-flash";
  }

  const normalized = value.toLowerCase();
  const hasWifiProtocolSignals =
    /802\.11|wi[\s-]?fi|wlan|wi-fi 6|wifi 6|wi-fi 7|wifi 7|11ax|11ac|11be|he160|vht80/.test(normalized);
  const hasWifiRfRoleSignals =
    /\bfem\b|front[- ]end module|front end module|pdet|spdt|rx\/tx|rx tx|bypass|power detector/.test(normalized);
  const hasWifiBandSignals = /2\.4\s*ghz|2\.4g\b|5\s*ghz|5ghz|5\.15|5\.85|6\s*ghz|6ghz/.test(normalized);
  const hasCellularSignals =
    /5g\s*nr|\bnr\b|\blte\b|wcdma|td-scdma|cdma2000|3gpp|\brffe\b|\bhpue\b|carrier aggregation|\bca\b/.test(normalized);

  if (hasWifiProtocolSignals && (hasWifiRfRoleSignals || hasWifiBandSignals)) {
    return "wifi";
  }
  if (
    normalized.includes("wifi") ||
    normalized.includes("wlan") ||
    normalized.includes("rf-fem") ||
    normalized.includes("rf fem") ||
    normalized.includes("front end module")
  ) {
    return "wifi";
  }
  if (hasCellularSignals || normalized.includes("cellular") || normalized.includes("pam")) {
    return "cellular-3g4g5g";
  }
  if (
    normalized.includes("flash") ||
    normalized.includes("spi nor") ||
    normalized.includes("serial nor") ||
    normalized.includes("qspi") ||
    normalized.includes("qpi") ||
    normalized.includes("memory")
  ) {
    return "serial-flash";
  }
  if (normalized.includes("power") || normalized.includes("ldo") || normalized.includes("buck")) return "power";
  if (normalized.includes("audio")) return "audio";
  if (normalized.includes("rf")) return "rf-general";
  return "generic-fallback";
}

function inferTemplateFromClass(deviceClass: string) {
  return normalizeTemplateId(deviceClass);
}

function collectIdentityTemplateContext(identity: LooseObject | null) {
  if (!identity) {
    return "";
  }

  return [
    asString(identity.deviceClass),
    asString(identity.device_class),
    asString(identity.kind),
    asString(identity.type),
    asString(identity.description),
    asString(identity.shortDescription),
    asString(identity.short_description),
    asString(identity.primaryFunction),
    asString(identity.primary_function),
    asString(identity.whatThisPartIsFor),
    asString(identity.what_this_part_is_for),
    asString(identity.documentTitle),
    asString(identity.document_title)
  ]
    .filter(Boolean)
    .join(" ");
}

function chooseTemplateId(rawTemplateId: string, contextText: string) {
  const normalizedTemplateId = normalizeTemplateId(rawTemplateId);
  const signalTemplateId = normalizeTemplateId(`${rawTemplateId} ${contextText}`.trim());

  if (signalTemplateId === "wifi" && normalizedTemplateId === "cellular-3g4g5g") {
    return "wifi";
  }

  if (signalTemplateId === "wifi" && ["generic-fallback", "rf-general", "power"].includes(normalizedTemplateId)) {
    return "wifi";
  }

  if (signalTemplateId === "cellular-3g4g5g" && ["generic-fallback", "rf-general", "power"].includes(normalizedTemplateId)) {
    return "cellular-3g4g5g";
  }

  return normalizedTemplateId;
}

function resolveIdentityTemplateId(identity: LooseObject | null, fallbackTemplateId: string) {
  if (!identity) {
    return normalizeTemplateId(fallbackTemplateId);
  }

  return chooseTemplateId(
    asString(identity.parameterTemplateId) ||
      asString(identity.parameter_template_id) ||
      asString(identity.templateId) ||
      asString(identity.template_id) ||
      asString(identity.parameterTemplate) ||
      fallbackTemplateId,
    collectIdentityTemplateContext(identity)
  );
}

function normalizeIdentityClassification(raw: unknown): IdentityClassification {
  const root = asObject(raw);
  if (!root) {
    throw new Error("identity completion is not an object");
  }

  const nestedIdentity = asObject(root.deviceIdentity);
  const altIdentity = asObject(root.identity);
  const canonicalPartNumber =
    asString(root.canonicalPartNumber) ||
    asString(root.part) ||
    asString(root.sku) ||
    asString(altIdentity?.canonicalPartNumber) ||
    asString(altIdentity?.part) ||
    asString(altIdentity?.sku) ||
    asString(nestedIdentity?.canonicalPartNumber) ||
    asString(nestedIdentity?.part) ||
    asString(nestedIdentity?.sku);
  const manufacturer =
    asString(root.manufacturer) ||
    asString(root.maker) ||
    asString(altIdentity?.manufacturer) ||
    asString(altIdentity?.maker) ||
    asString(nestedIdentity?.manufacturer) ||
    asString(nestedIdentity?.maker) ||
    "Unknown";
  const deviceClass =
    asString(root.deviceClass) ||
    asString(root.kind) ||
    asString(altIdentity?.deviceClass) ||
    asString(altIdentity?.kind) ||
    asString(altIdentity?.type) ||
    asString(altIdentity?.description) ||
    asString(nestedIdentity?.deviceClass) ||
    asString(nestedIdentity?.kind) ||
    asString(nestedIdentity?.documentTitle) ||
    "Unknown";
  const templateId = chooseTemplateId(asString(root.parameterTemplateId) || inferTemplateFromClass(deviceClass), deviceClass);
  const focusChecklist = [
    ...asStringArray(root.focusChecklist),
    ...asStringArray(root.priorityChecks),
    asString(root.nextStep)
  ].filter(Boolean);
  const publicContext = Array.isArray(root.publicContext)
    ? root.publicContext
        .map((entry) => asObject(entry))
        .filter((entry): entry is LooseObject => Boolean(entry))
        .map((entry, index) => ({
          id: asString(entry.id) || `public-${index + 1}`,
          title: asString(entry.title) || asString(entry.name) || "Public context",
          url: asString(entry.url),
          snippet: asString(entry.snippet) || asString(entry.summary),
          sourceType: "public" as const
        }))
        .filter((entry) => entry.url || entry.snippet)
    : [];
  const confidence = asNumber(root.confidence) ?? 0.7;

  if (!canonicalPartNumber) {
    throw new Error("missing canonicalPartNumber in identity completion");
  }

  return {
    canonicalPartNumber,
    manufacturer,
    deviceClass,
    parameterTemplateId: templateId,
    focusChecklist: focusChecklist.length ? focusChecklist : ["先看首页、feature list 和电气特性表。"],
    publicContext,
    confidence
  };
}

function makeReviewClaim(input: {
  id: string;
  label: string;
  value?: string;
  title?: string;
  body?: string;
}): ReportClaim {
  return {
    id: input.id,
    label: input.label,
    value: input.value ?? "",
    title: input.title ?? "",
    body: input.body ?? "",
    sourceType: "review",
    citations: []
  };
}

function buildDatasheetClaimsFromPreparation(preparation: ReportSynthesisInput["preparation"]) {
  return preparation.localCandidates.map((candidate, index) => ({
    id: `local-${index + 1}`,
    label: candidate.name,
    value: candidate.value,
    title: candidate.name,
    body: `${candidate.name}: ${candidate.value}`,
    sourceType: "datasheet" as const,
    citations: [
      {
        id: `local-cite-${index + 1}`,
        sourceType: "datasheet" as const,
        page: candidate.page,
        quote: candidate.quote
      }
    ]
  }));
}

function normalizeTeachingSections(rawTeachingReport: LooseObject, identity: LooseObject) {
  const readingSkeleton = asObject(rawTeachingReport.readingSkeleton);
  const deviceIdentity = asObject(rawTeachingReport.deviceIdentity) ?? identity;
  const primaryFunction = asString(deviceIdentity?.primaryFunction);
  const applicationContext = asString(deviceIdentity?.applicationContext);
  const readingOrder = Array.isArray(rawTeachingReport.sectionBySectionReadingOrder)
    ? rawTeachingReport.sectionBySectionReadingOrder.map(asString).filter(Boolean).join(" -> ")
    : "";
  const openQuestions = asStringArray(rawTeachingReport.openQuestions).join("\n");
  const glossary = asObject(rawTeachingReport.glossaryForJuniors);
  const glossaryBody = glossary
    ? Object.entries(glossary)
        .map(([term, meaning]) => `${term}: ${asString(meaning)}`)
        .filter(Boolean)
        .join("\n")
    : "";
  const skeletonItems = readingSkeleton
    ? Object.entries(readingSkeleton)
        .map(([, step]) => asObject(step))
        .filter((step): step is LooseObject => Boolean(step))
    : [];
  const howToReadBody = skeletonItems
    .map((step) => [asString(step.instruction), asString(step.currentProgress), asString(step.nextAction)].filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n");

  return [
    {
      id: "device_identity",
      title: "器件身份",
      body: [asString(deviceIdentity?.manufacturer), asString(deviceIdentity?.canonicalPartNumber), asString(deviceIdentity?.deviceClass)]
        .filter(Boolean)
        .join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: [primaryFunction, applicationContext].filter(Boolean).join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: howToReadBody,
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "section_by_section_reading_order",
      title: "章节阅读顺序",
      body: readingOrder,
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "critical_graphs_and_tables",
      title: "重点表格与图",
      body: asStringArray(asObject(rawTeachingReport.parameterTable)?.notes).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: skeletonItems.map((step) => asString(step.nextAction)).filter(Boolean).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "glossary_for_juniors",
      title: "给新人的术语表",
      body: glossaryBody || openQuestions,
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);
}

function makeGeminiReviewClaim(input: {
  id: string;
  label: string;
  value?: string;
  body: string;
}): ReportClaim {
  return {
    id: input.id,
    label: input.label,
    value: input.value ?? "",
    title: input.label,
    body: input.body,
    sourceType: "review",
    citations: []
  };
}

function normalizeGeminiStyleReport(root: LooseObject, input: ReportSynthesisInput): ReportOutput {
  const deviceIdentification = asObject(root.deviceIdentification) ?? {};
  const keyParameters = Array.isArray(root.keyParameters) ? root.keyParameters : [];
  const quickStartGuide = Array.isArray(root.quickStartGuide) ? root.quickStartGuide : [];
  const risksAndGotchas = Array.isArray(root.risksAndGotchas) ? root.risksAndGotchas : [];
  const nextSteps = Array.isArray(root.nextSteps) ? root.nextSteps : [];
  const openQuestions = Array.isArray(root.openQuestions) ? root.openQuestions : [];
  const engineeringInterpretation = asObject(root.engineeringInterpretation) ?? {};
  const terminologyExplanations = Array.isArray(engineeringInterpretation.terminologyExplanations)
    ? engineeringInterpretation.terminologyExplanations
    : [];
  const appScenarios = Array.isArray(deviceIdentification.applicationScenarios)
    ? deviceIdentification.applicationScenarios.map(asString).filter(Boolean)
    : [];

  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);
  const parameterClaims = keyParameters
    .map((entry, index) => {
      const parameter = asObject(entry);
      if (!parameter) return null;
      const label = asString(parameter.parameter) || `Parameter ${index + 1}`;
      const rawValue = asString(parameter.value);
      const unit = asString(parameter.unit);
      const value =
        unit && rawValue.toLowerCase().includes(unit.toLowerCase()) ? rawValue : [rawValue, unit].filter(Boolean).join(" ").trim();
      const body = [asString(parameter.engineeringSignificance), asString(parameter.datasource)].filter(Boolean).join(" ");
      return makeGeminiReviewClaim({
        id: `gemini-key-${index + 1}`,
        label,
        value,
        body: body || value || label
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const designFocus = quickStartGuide
    .map((entry, index) => {
      const step = asObject(entry);
      if (!step) return null;
      const label = [asString(step.task), asString(step.focus)].filter(Boolean).join(" | ") || `Guide ${index + 1}`;
      const body = [asString(step.rationale)].filter(Boolean).join(" ").trim();
      return makeGeminiReviewClaim({
        id: `gemini-guide-${index + 1}`,
        label,
        body: body || label
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const risks = risksAndGotchas
    .map((entry, index) => {
      const risk = asObject(entry);
      if (!risk) return null;
      const label = asString(risk.type) || `Risk ${index + 1}`;
      const body = [asString(risk.risk), asString(risk.impact), asString(risk.mitigation)].filter(Boolean).join(" | ");
      return makeGeminiReviewClaim({
        id: `gemini-risk-${index + 1}`,
        label,
        body: body || label
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const questionClaims = openQuestions
    .map((entry, index) => {
      const question = asObject(entry);
      if (!question) return null;
      const label = asString(question.question) || `Open question ${index + 1}`;
      const body = [asString(question.status), asString(question.impact)].filter(Boolean).join(" | ");
      return makeGeminiReviewClaim({
        id: `gemini-open-${index + 1}`,
        label,
        body: body || label
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const internSteps = nextSteps
    .map((entry, index) => {
      const step = asObject(entry);
      if (!step) return null;
      const label = asString(step.action) || `Next step ${index + 1}`;
      return makeGeminiReviewClaim({
        id: `gemini-next-${index + 1}`,
        label,
        body: asString(step.description) || label
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));

  const glossaryBody = terminologyExplanations
    .map((entry) => {
      const term = asObject(entry);
      if (!term) return "";
      return [asString(term.term), asString(term.definition)].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .join("\n");
  const howToReadBody = quickStartGuide
    .map((entry) => {
      const step = asObject(entry);
      if (!step) return "";
      return [asString(step.task), asString(step.focus), asString(step.rationale)].filter(Boolean).join(" | ");
    })
    .filter(Boolean)
    .join("\n");
  const readingOrderBody = quickStartGuide
    .map((entry) => {
      const step = asObject(entry);
      if (!step) return "";
      return [asString(step.task), asString(step.focus)].filter(Boolean).join(" -> ");
    })
    .filter(Boolean)
    .join("\n");
  const interpretationBlocks = [
    asObject(engineeringInterpretation.absoluteMaxVsRecommended),
    asObject(engineeringInterpretation.testConditionsCaveats)
  ]
    .filter((entry): entry is LooseObject => Boolean(entry))
    .map((entry) => [asString(entry.explanation), asString(entry.impact)].filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n");

  const sections = [
    {
      id: "device_identity",
      title: "器件身份",
      body: [
        asString(deviceIdentification.manufacturer),
        asString(deviceIdentification.canonicalPartNumber),
        asString(deviceIdentification.deviceClass)
      ]
        .filter(Boolean)
        .join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: [asString(deviceIdentification.primaryFunction), appScenarios.join("；")].filter(Boolean).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: howToReadBody,
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "section_by_section_reading_order",
      title: "章节阅读顺序",
      body: readingOrderBody,
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "key_parameters",
      title: "关键参数",
      body: parameterClaims.map((claim) => [claim.label, claim.value, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "risks_and_gotchas",
      title: "风险与易错点",
      body: [interpretationBlocks, risks.map((claim) => claim.body).join("\n")].filter(Boolean).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: internSteps.map((claim) => claim.body).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "open_questions",
      title: "待确认问题",
      body: questionClaims.map((claim) => [claim.label, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "glossary_for_juniors",
      title: "给新人的术语表",
      body: glossaryBody,
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);

  const executiveSummary =
    [
      asString(deviceIdentification.canonicalPartNumber),
      asString(deviceIdentification.deviceClass),
      asString(deviceIdentification.primaryFunction)
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`;
  const claims = [...localClaims, ...parameterClaims, ...designFocus, ...risks, ...questionClaims, ...internSteps];

  return {
    executiveSummary,
    deviceIdentity: {
      canonicalPartNumber: asString(deviceIdentification.canonicalPartNumber) || input.identity.canonicalPartNumber,
      manufacturer: asString(deviceIdentification.manufacturer) || input.identity.manufacturer,
      deviceClass: asString(deviceIdentification.deviceClass) || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(deviceIdentification, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: parameterClaims.length ? parameterClaims : localClaims,
    designFocus,
    risks,
    openQuestions: questionClaims,
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

function normalizeGeminiReadingStrategyReport(root: LooseObject, input: ReportSynthesisInput): ReportOutput {
  const deviceIdentity = asObject(root.deviceIdentity) ?? {};
  const readingStrategy = asObject(root.readingStrategy) ?? {};
  const recommendedOrder = Array.isArray(readingStrategy.recommendedOrder) ? readingStrategy.recommendedOrder : [];
  const engineeringTerms = Array.isArray(readingStrategy.engineeringTerms) ? readingStrategy.engineeringTerms : [];
  const keyParameters = Array.isArray(root.keyParameters) ? root.keyParameters : [];
  const risksAndGotchas = Array.isArray(root.risksAndGotchas) ? root.risksAndGotchas : [];
  const nextStepsForIntern = Array.isArray(root.nextStepsForIntern) ? root.nextStepsForIntern.map(asString).filter(Boolean) : [];
  const engineeringJudgment = asObject(root.engineeringJudgment) ?? {};

  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);
  const parameterClaims = keyParameters
    .map((entry, index) => {
      const parameter = asObject(entry);
      if (!parameter) return null;
      return makeGeminiReviewClaim({
        id: `gemini-reading-key-${index + 1}`,
        label: asString(parameter.parameter) || `Parameter ${index + 1}`,
        value: asString(parameter.value),
        body: [asString(parameter.engineeringSignificance), asString(parameter.citation)].filter(Boolean).join(" ")
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const designFocus = recommendedOrder
    .map((entry, index) => {
      const row = asObject(entry);
      if (!row) return null;
      return makeGeminiReviewClaim({
        id: `gemini-reading-guide-${index + 1}`,
        label: asString(row.section) || `Guide ${index + 1}`,
        body: asString(row.purpose) || asString(row.section) || `Guide ${index + 1}`
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const risks = risksAndGotchas
    .map((entry, index) => {
      const row = asObject(entry);
      if (!row) return null;
      return makeGeminiReviewClaim({
        id: `gemini-reading-risk-${index + 1}`,
        label: asString(row.type) || `Risk ${index + 1}`,
        body: [asString(row.description), asString(row.impact)].filter(Boolean).join(" | ")
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const internActions = nextStepsForIntern.map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-reading-next-${index + 1}`,
      label: `Intern step ${index + 1}`,
      body: item
    })
  );
  const glossaryBody = engineeringTerms
    .map((entry) => {
      const row = asObject(entry);
      if (!row) return "";
      return [asString(row.term), asString(row.explanation)].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .join("\n");
  const engineeringBody = Object.values(engineeringJudgment).map(asString).filter(Boolean).join("\n");
  const readingOrderBody = recommendedOrder
    .map((entry) => {
      const row = asObject(entry);
      if (!row) return "";
      return [asString(row.section), asString(row.purpose)].filter(Boolean).join(" | ");
    })
    .filter(Boolean)
    .join("\n");

  const sections = [
    {
      id: "device_identity",
      title: "器件身份",
      body: [asString(deviceIdentity.manufacturer), asString(deviceIdentity.canonicalPartNumber), asString(deviceIdentity.deviceClass)]
        .filter(Boolean)
        .join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: asString(deviceIdentity.shortDescription),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: readingOrderBody,
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "section_by_section_reading_order",
      title: "章节阅读顺序",
      body: readingOrderBody,
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "key_parameters",
      title: "关键参数",
      body: parameterClaims.map((claim) => [claim.label, claim.value, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "risks_and_gotchas",
      title: "风险与易错点",
      body: [engineeringBody, risks.map((claim) => claim.body).join("\n")].filter(Boolean).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: nextStepsForIntern.join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "glossary_for_juniors",
      title: "给新人的术语表",
      body: glossaryBody,
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);

  const executiveSummary =
    [
      asString(deviceIdentity.canonicalPartNumber),
      asString(deviceIdentity.deviceClass),
      asString(deviceIdentity.shortDescription)
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`;
  const claims = [...localClaims, ...parameterClaims, ...designFocus, ...risks, ...internActions];

  return {
    executiveSummary,
    deviceIdentity: {
      canonicalPartNumber: asString(deviceIdentity.canonicalPartNumber) || input.identity.canonicalPartNumber,
      manufacturer: asString(deviceIdentity.manufacturer) || input.identity.manufacturer,
      deviceClass: asString(deviceIdentity.deviceClass) || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(deviceIdentity, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: parameterClaims.length ? parameterClaims : localClaims,
    designFocus,
    risks,
    openQuestions: [],
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

function normalizeGeminiInstructionalReport(root: LooseObject, input: ReportSynthesisInput): ReportOutput {
  const deviceIdentification = asObject(root.deviceIdentification) ?? {};
  const instructionalReport = asObject(root.instructionalReport) ?? {};
  const parameterTable = asObject(root.parameterTable) ?? {};
  const riskAssessmentTable = Array.isArray(root.riskAssessmentTable) ? root.riskAssessmentTable : [];

  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);
  const sequence = Array.isArray(instructionalReport.reading_sequence)
    ? instructionalReport.reading_sequence.map(asString).filter(Boolean)
    : [];
  const instructionalParameters = Array.isArray(instructionalReport.key_parameters) ? instructionalReport.key_parameters : [];
  const instructionalRisks = Array.isArray(instructionalReport.risks_and_gotchas) ? instructionalReport.risks_and_gotchas : [];
  const terminologyDefinitions = asObject(instructionalReport.terminology_definitions) ?? {};
  const nextStepsForIntern = Array.isArray(instructionalReport.next_steps_for_intern)
    ? instructionalReport.next_steps_for_intern.map(asString).filter(Boolean)
    : [];

  const parameterClaims = [
    ...instructionalParameters
      .map((entry, index) => {
        const row = asObject(entry);
        if (!row) return null;
        return makeGeminiReviewClaim({
          id: `gemini-instructional-key-${index + 1}`,
          label: asString(row.parameter) || `Parameter ${index + 1}`,
          value: asString(row.value),
          body: asString(row.engineeringSignificance) || asString(row.value)
        });
      })
      .filter((claim): claim is ReportClaim => Boolean(claim)),
    ...Object.entries(parameterTable).map(([key, value], index) =>
      makeGeminiReviewClaim({
        id: `gemini-parameter-table-${index + 1}`,
        label: key.replace(/_/g, " "),
        value: asString(value),
        body: asString(value)
      })
    )
  ];
  const risks = [
    ...instructionalRisks
      .map((entry, index) => {
        const row = asObject(entry);
        if (!row) return null;
        return makeGeminiReviewClaim({
          id: `gemini-instructional-risk-${index + 1}`,
          label: asString(row.type) || `Risk ${index + 1}`,
          body: [asString(row.description), asString(row.impact)].filter(Boolean).join(" | ")
        });
      })
      .filter((claim): claim is ReportClaim => Boolean(claim)),
    ...riskAssessmentTable
      .map((entry, index) => {
        const row = asObject(entry);
        if (!row) return null;
        return makeGeminiReviewClaim({
          id: `gemini-risk-table-${index + 1}`,
          label: asString(row.riskItem) || `Risk table ${index + 1}`,
          body: [asString(row.impactSeverity), asString(row.mitigationStrategy)].filter(Boolean).join(" | ")
        });
      })
      .filter((claim): claim is ReportClaim => Boolean(claim))
  ];
  const designFocus = sequence.map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-sequence-${index + 1}`,
      label: `Reading step ${index + 1}`,
      body: item
    })
  );
  const internActions = nextStepsForIntern.map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-instructional-next-${index + 1}`,
      label: `Intern step ${index + 1}`,
      body: item
    })
  );
  const glossaryBody = Object.entries(terminologyDefinitions)
    .map(([term, meaning]) => `${term}: ${asString(meaning)}`)
    .filter(Boolean)
    .join("\n");

  const sections = [
    {
      id: "device_identity",
      title: "器件身份",
      body: [
        asString(deviceIdentification.manufacturer),
        asString(deviceIdentification.canonicalPartNumber),
        asString(deviceIdentification.deviceClass)
      ]
        .filter(Boolean)
        .join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: asString(instructionalReport.what_this_part_is_for) || asString(deviceIdentification.shortDescription),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: sequence.join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "section_by_section_reading_order",
      title: "章节阅读顺序",
      body: sequence.join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "key_parameters",
      title: "关键参数",
      body: parameterClaims.map((claim) => [claim.label, claim.value, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "risks_and_gotchas",
      title: "风险与易错点",
      body: risks.map((claim) => [claim.label, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: nextStepsForIntern.join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "glossary_for_juniors",
      title: "给新人的术语表",
      body: glossaryBody,
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);

  const executiveSummary =
    [
      asString(deviceIdentification.canonicalPartNumber),
      asString(deviceIdentification.deviceClass),
      asString(deviceIdentification.shortDescription)
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`;
  const claims = [...localClaims, ...parameterClaims, ...designFocus, ...risks, ...internActions];

  return {
    executiveSummary,
    deviceIdentity: {
      canonicalPartNumber: asString(deviceIdentification.canonicalPartNumber) || input.identity.canonicalPartNumber,
      manufacturer: asString(deviceIdentification.manufacturer) || input.identity.manufacturer,
      deviceClass: asString(deviceIdentification.deviceClass) || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(deviceIdentification, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: parameterClaims.length ? parameterClaims : localClaims,
    designFocus,
    risks,
    openQuestions: [],
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

function normalizeGeminiDeviceOverviewReport(root: LooseObject, input: ReportSynthesisInput): ReportOutput {
  const deviceOverview = asObject(root.device_overview) ?? {};
  const readingGuide = asObject(root.how_to_read_this_datasheet) ?? {};
  const parameterTable = asObject(root.parameter_table) ?? {};
  const riskAnalysis = Array.isArray(root.risk_analysis) ? root.risk_analysis : [];
  const internActionList = asObject(root.intern_action_list) ?? {};
  const openQuestions = asStringArray(root.open_questions);
  const criticalGraphs = asStringArray(root.critical_graphs_and_tables);

  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);
  const parameterClaims = Object.entries(parameterTable)
    .map(([key, value], index) =>
      makeGeminiReviewClaim({
        id: `gemini-device-overview-key-${index + 1}`,
        label: key.replace(/_/g, " "),
        value: asString(value),
        body: asString(value)
      })
    )
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const designFocus = [
    ...asStringArray(readingGuide.reading_order).map((item, index) =>
      makeGeminiReviewClaim({
        id: `gemini-device-overview-reading-${index + 1}`,
        label: `Reading step ${index + 1}`,
        body: item
      })
    ),
    ...asStringArray(readingGuide.junior_tips).map((item, index) =>
      makeGeminiReviewClaim({
        id: `gemini-device-overview-tip-${index + 1}`,
        label: `Junior tip ${index + 1}`,
        body: item
      })
    )
  ];
  const risks = riskAnalysis
    .map((entry, index) => {
      const row = asObject(entry);
      if (!row) return null;
      return makeGeminiReviewClaim({
        id: `gemini-device-overview-risk-${index + 1}`,
        label: asString(row.risk) || `Risk ${index + 1}`,
        body: [asString(row.impact), asString(row.mitigation), asString(row.note)].filter(Boolean).join(" | ")
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const internActions = [
    ...asStringArray(internActionList.immediate_tasks),
    ...asStringArray(internActionList.long_term_growth)
  ].map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-device-overview-next-${index + 1}`,
      label: `Intern step ${index + 1}`,
      body: item
    })
  );
  const questionClaims = openQuestions.map((item, index) =>
    makeReviewClaim({
      id: `gemini-device-overview-open-${index + 1}`,
      label: `Open question ${index + 1}`,
      body: item
    })
  );

  const readingOrderBody = asStringArray(readingGuide.reading_order).join("\n");
  const juniorTipsBody = asStringArray(readingGuide.junior_tips).join("\n");
  const criticalGraphsBody = criticalGraphs.join("\n");

  const sections = [
    {
      id: "device_identity",
      title: "器件身份",
      body: [asString(deviceOverview.manufacturer), asString(deviceOverview.part_number), asString(deviceOverview.device_class)]
        .filter(Boolean)
        .join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: asString(deviceOverview.what_it_is_for) || asString(deviceOverview.description),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: [readingOrderBody, juniorTipsBody].filter(Boolean).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "section_by_section_reading_order",
      title: "章节阅读顺序",
      body: readingOrderBody,
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "critical_graphs_and_tables",
      title: "重点表格与图",
      body: criticalGraphsBody,
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "key_parameters",
      title: "关键参数",
      body: parameterClaims.map((claim) => [claim.label, claim.value, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "risks_and_gotchas",
      title: "风险与易错点",
      body: risks.map((claim) => [claim.label, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: internActions.map((claim) => claim.body).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "open_questions",
      title: "待确认问题",
      body: questionClaims.map((claim) => claim.body).join("\n"),
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);

  const executiveSummary =
    [
      asString(deviceOverview.part_number),
      asString(deviceOverview.device_class),
      asString(deviceOverview.what_it_is_for)
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`;
  const claims = [...localClaims, ...parameterClaims, ...designFocus, ...risks, ...questionClaims, ...internActions];

  return {
    executiveSummary,
    deviceIdentity: {
      canonicalPartNumber: asString(deviceOverview.part_number) || input.identity.canonicalPartNumber,
      manufacturer: asString(deviceOverview.manufacturer) || input.identity.manufacturer,
      deviceClass: asString(deviceOverview.device_class) || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(deviceOverview, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: parameterClaims.length ? parameterClaims : localClaims,
    designFocus,
    risks,
    openQuestions: questionClaims,
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

function normalizeGeminiDeviceInfoReport(root: LooseObject, input: ReportSynthesisInput): ReportOutput {
  const deviceInfo = asObject(root.deviceInfo) ?? {};
  const instructionalGuide = asObject(root.instructionalGuide) ?? {};
  const parameterTable = asObject(root.parameterTable) ?? {};

  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);
  const guideParameters = Array.isArray(instructionalGuide.key_parameters) ? instructionalGuide.key_parameters : [];
  const guideRisks = asStringArray(instructionalGuide.risks_and_gotchas);
  const guideSteps = asStringArray(instructionalGuide.next_steps);
  const howToRead = asStringArray(instructionalGuide.how_to_read_this_datasheet);

  const parameterClaims = [
    ...guideParameters
      .map((entry, index) => {
        const row = asObject(entry);
        if (!row) return null;
        return makeGeminiReviewClaim({
          id: `gemini-device-info-key-${index + 1}`,
          label: asString(row.parameter) || `Parameter ${index + 1}`,
          value: asString(row.value),
          body: asString(row.explanation) || asString(row.value)
        });
      })
      .filter((claim): claim is ReportClaim => Boolean(claim)),
    ...Object.entries(parameterTable).map(([key, value], index) =>
      makeGeminiReviewClaim({
        id: `gemini-device-info-table-${index + 1}`,
        label: key,
        value: asString(value),
        body: asString(value)
      })
    )
  ];
  const risks = guideRisks.map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-device-info-risk-${index + 1}`,
      label: `Risk ${index + 1}`,
      body: item
    })
  );
  const internActions = guideSteps.map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-device-info-next-${index + 1}`,
      label: `Intern step ${index + 1}`,
      body: item
    })
  );
  const designFocus = howToRead.map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-device-info-read-${index + 1}`,
      label: `Reading step ${index + 1}`,
      body: item
    })
  );

  const sections = [
    {
      id: "device_identity",
      title: "器件身份",
      body: [asString(deviceInfo.manufacturer), asString(deviceInfo.canonicalPartNumber), asString(deviceInfo.deviceClass)]
        .filter(Boolean)
        .join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: asString(instructionalGuide.what_this_part_is_for) || asString(deviceInfo.shortDescription),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: howToRead.join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "key_parameters",
      title: "关键参数",
      body: parameterClaims.map((claim) => [claim.label, claim.value, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "risks_and_gotchas",
      title: "风险与易错点",
      body: risks.map((claim) => claim.body).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: guideSteps.join("\n"),
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);

  const executiveSummary =
    [
      asString(deviceInfo.canonicalPartNumber),
      asString(deviceInfo.deviceClass),
      asString(deviceInfo.shortDescription)
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`;
  const claims = [...localClaims, ...parameterClaims, ...designFocus, ...risks, ...internActions];

  return {
    executiveSummary,
    deviceIdentity: {
      canonicalPartNumber: asString(deviceInfo.canonicalPartNumber) || input.identity.canonicalPartNumber,
      manufacturer: asString(deviceInfo.manufacturer) || input.identity.manufacturer,
      deviceClass: asString(deviceInfo.deviceClass) || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(deviceInfo, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: parameterClaims.length ? parameterClaims : localClaims,
    designFocus,
    risks,
    openQuestions: [],
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

function normalizeGeminiSnakeCaseReport(root: LooseObject, input: ReportSynthesisInput): ReportOutput {
  const deviceIdentification = asObject(root.device_identification) ?? {};
  const readingGuide = asObject(root.how_to_read_this_datasheet) ?? {};
  const keyParameters = asObject(root.key_parameters) ?? {};
  const risksAndGotchas = asObject(root.risks_and_gotchas) ?? {};
  const nextSteps = Array.isArray(root.next_steps) ? root.next_steps : [];

  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);
  const parameterRows = Array.isArray(keyParameters.table_data) ? keyParameters.table_data : [];
  const conditionWarnings = asStringArray(keyParameters.condition_warnings);
  const riskRows = Array.isArray(risksAndGotchas.table_data) ? risksAndGotchas.table_data : [];
  const readingOrder = asStringArray(readingGuide.reading_order);
  const terminologyDefinitions = Array.isArray(readingGuide.terminology_definitions)
    ? readingGuide.terminology_definitions
    : [];

  const parameterClaims = parameterRows
    .map((entry, index) => {
      const row = asObject(entry);
      if (!row) return null;
      return makeGeminiReviewClaim({
        id: `gemini-snake-key-${index + 1}`,
        label: asString(row.parameter) || `Parameter ${index + 1}`,
        value: asString(row.value),
        body: asString(row.significance) || asString(row.note) || asString(row.value)
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const risks = [
    ...riskRows
      .map((entry, index) => {
        const row = asObject(entry);
        if (!row) return null;
        return makeGeminiReviewClaim({
          id: `gemini-snake-risk-${index + 1}`,
          label: asString(row.risk) || `Risk ${index + 1}`,
          body: [asString(row.implication), asString(row.mitigation), asString(row.note)].filter(Boolean).join(" | ")
        });
      })
      .filter((claim): claim is ReportClaim => Boolean(claim)),
    ...conditionWarnings.map((warning, index) =>
      makeGeminiReviewClaim({
        id: `gemini-snake-warning-${index + 1}`,
        label: `Condition warning ${index + 1}`,
        body: warning
      })
    )
  ];
  const designFocus = readingOrder.map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-snake-read-${index + 1}`,
      label: `Reading step ${index + 1}`,
      body: item
    })
  );
  const internActions = nextSteps
    .map((entry, index) => {
      const row = asObject(entry);
      if (!row) return null;
      return makeGeminiReviewClaim({
        id: `gemini-snake-next-${index + 1}`,
        label: asString(row.action) || `Intern step ${index + 1}`,
        body: asString(row.detail) || asString(row.action) || `Intern step ${index + 1}`
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const glossaryBody = terminologyDefinitions
    .map((entry) => {
      const row = asObject(entry);
      if (!row) return "";
      return [asString(row.term), asString(row.definition)].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .join("\n");

  const sections = [
    {
      id: "device_identity",
      title: "器件身份",
      body: [
        asString(deviceIdentification.manufacturer),
        asString(deviceIdentification.canonical_part_number),
        asString(deviceIdentification.device_class)
      ]
        .filter(Boolean)
        .join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: asString(deviceIdentification.summary),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: readingOrder.join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "key_parameters",
      title: "关键参数",
      body: parameterClaims.map((claim) => [claim.label, claim.value, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "risks_and_gotchas",
      title: "风险与易错点",
      body: risks.map((claim) => [claim.label, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: internActions.map((claim) => claim.body).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "glossary_for_juniors",
      title: "给新人的术语表",
      body: glossaryBody,
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);

  const executiveSummary =
    [
      asString(deviceIdentification.canonical_part_number),
      asString(deviceIdentification.device_class),
      asString(deviceIdentification.summary)
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`;
  const claims = [...localClaims, ...parameterClaims, ...designFocus, ...risks, ...internActions];

  return {
    executiveSummary,
    deviceIdentity: {
      canonicalPartNumber: asString(deviceIdentification.canonical_part_number) || input.identity.canonicalPartNumber,
      manufacturer: asString(deviceIdentification.manufacturer) || input.identity.manufacturer,
      deviceClass: asString(deviceIdentification.device_class) || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(deviceIdentification, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: parameterClaims.length ? parameterClaims : localClaims,
    designFocus,
    risks,
    openQuestions: [],
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

function normalizeGeminiDeviceIdentityReport(root: LooseObject, input: ReportSynthesisInput): ReportOutput {
  const deviceIdentity = asObject(root.device_identity) ?? {};
  const readingGuide = asObject(root.how_to_read_this_datasheet) ?? {};
  const keyParameters = Array.isArray(root.key_parameters) ? root.key_parameters : [];
  const risksAndGotchas = Array.isArray(root.risks_and_gotchas) ? root.risks_and_gotchas : [];
  const parameterTable = asObject(root.parameter_table) ?? {};
  const nextSteps = asStringArray(root.next_steps);
  const jargonBriefing = asObject(readingGuide.jargon_briefing) ?? {};
  const readingOrder = asStringArray(readingGuide.suggested_reading_order);

  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);
  const parameterClaims = [
    ...keyParameters
      .map((entry, index) => {
        const row = asObject(entry);
        if (!row) return null;
        return makeGeminiReviewClaim({
          id: `gemini-device-identity-key-${index + 1}`,
          label: asString(row.name) || asString(row.parameter) || `Parameter ${index + 1}`,
          value: asString(row.value),
          body: asString(row.significance) || asString(row.explanation) || asString(row.value)
        });
      })
      .filter((claim): claim is ReportClaim => Boolean(claim)),
    ...Object.entries(parameterTable).map(([key, value], index) =>
      makeGeminiReviewClaim({
        id: `gemini-device-identity-table-${index + 1}`,
        label: key,
        value: asString(value),
        body: asString(value)
      })
    )
  ];
  const risks = risksAndGotchas
    .map((entry, index) => {
      const row = asObject(entry);
      if (!row) return null;
      return makeGeminiReviewClaim({
        id: `gemini-device-identity-risk-${index + 1}`,
        label: asString(row.risk) || `Risk ${index + 1}`,
        body: [asString(row.detail), asString(row.impact), asString(row.mitigation)].filter(Boolean).join(" | ")
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const designFocus = readingOrder.map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-device-identity-read-${index + 1}`,
      label: `Reading step ${index + 1}`,
      body: item
    })
  );
  const internActions = nextSteps.map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-device-identity-next-${index + 1}`,
      label: `Intern step ${index + 1}`,
      body: item
    })
  );
  const glossaryBody = Object.entries(jargonBriefing)
    .map(([term, meaning]) => `${term}: ${asString(meaning)}`)
    .filter(Boolean)
    .join("\n");

  const sections = [
    {
      id: "device_identity",
      title: "器件身份",
      body: [asString(deviceIdentity.manufacturer), asString(deviceIdentity.canonicalPartNumber), asString(deviceIdentity.deviceClass)]
        .filter(Boolean)
        .join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: asString(deviceIdentity.what_this_part_is_for) || asString(deviceIdentity.description),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: readingOrder.join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "key_parameters",
      title: "关键参数",
      body: parameterClaims.map((claim) => [claim.label, claim.value, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "risks_and_gotchas",
      title: "风险与易错点",
      body: risks.map((claim) => [claim.label, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: nextSteps.join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "glossary_for_juniors",
      title: "给新人的术语表",
      body: glossaryBody,
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);

  const executiveSummary =
    [
      asString(deviceIdentity.canonicalPartNumber),
      asString(deviceIdentity.deviceClass),
      asString(deviceIdentity.description)
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`;
  const claims = [...localClaims, ...parameterClaims, ...designFocus, ...risks, ...internActions];

  return {
    executiveSummary,
    deviceIdentity: {
      canonicalPartNumber: asString(deviceIdentity.canonicalPartNumber) || input.identity.canonicalPartNumber,
      manufacturer: asString(deviceIdentity.manufacturer) || input.identity.manufacturer,
      deviceClass: asString(deviceIdentity.deviceClass) || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(deviceIdentity, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: parameterClaims.length ? parameterClaims : localClaims,
    designFocus,
    risks,
    openQuestions: [],
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

function normalizeGeminiPartIdentityReport(root: LooseObject, input: ReportSynthesisInput): ReportOutput {
  const partIdentity = asObject(root.partIdentity) ?? {};
  const readingGuide = asObject(root.howToReadThisDatasheet) ?? {};
  const keyParameters = Array.isArray(root.keyParameters) ? root.keyParameters : [];
  const risksAndGotchas = Array.isArray(root.risksAndGotchas) ? root.risksAndGotchas : [];
  const parameterTable = asObject(root.parameterTable) ?? {};
  const terminologyExplanation = Array.isArray(root.terminologyExplanation) ? root.terminologyExplanation : [];
  const nextSteps = asStringArray(root.nextSteps);

  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);
  const parameterClaims = [
    ...keyParameters
      .map((entry, index) => {
        const row = asObject(entry);
        if (!row) return null;
        return makeGeminiReviewClaim({
          id: `gemini-part-identity-key-${index + 1}`,
          label: asString(row.parameter) || asString(row.name) || `Parameter ${index + 1}`,
          value: asString(row.value),
          body: asString(row.engineeringSignificance) || asString(row.explanation) || asString(row.value)
        });
      })
      .filter((claim): claim is ReportClaim => Boolean(claim)),
    ...Object.entries(parameterTable).map(([key, value], index) =>
      makeGeminiReviewClaim({
        id: `gemini-part-identity-table-${index + 1}`,
        label: key,
        value: asString(value),
        body: asString(value)
      })
    )
  ];
  const risks = risksAndGotchas
    .map((entry, index) => {
      const row = asObject(entry);
      if (!row) return null;
      return makeGeminiReviewClaim({
        id: `gemini-part-identity-risk-${index + 1}`,
        label: asString(row.type) || asString(row.risk) || `Risk ${index + 1}`,
        body: [asString(row.description), asString(row.detail), asString(row.impact)].filter(Boolean).join(" | ")
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const designFocus = asStringArray(readingGuide.readingSequence).map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-part-identity-read-${index + 1}`,
      label: `Reading step ${index + 1}`,
      body: item
    })
  );
  const internActions = nextSteps.map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-part-identity-next-${index + 1}`,
      label: `Intern step ${index + 1}`,
      body: item
    })
  );
  const glossaryBody = terminologyExplanation
    .map((entry) => {
      const row = asObject(entry);
      if (!row) return "";
      return [asString(row.term), asString(row.definition), asString(row.explanation)].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .join("\n");
  const howToReadBody = [asString(readingGuide.engineeringContext), ...asStringArray(readingGuide.readingSequence)]
    .filter(Boolean)
    .join("\n");

  const sections = [
    {
      id: "device_identity",
      title: "器件身份",
      body: [asString(partIdentity.manufacturer), asString(partIdentity.canonicalPartNumber), asString(partIdentity.deviceClass)]
        .filter(Boolean)
        .join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: asString(partIdentity.shortDescription),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: howToReadBody,
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "key_parameters",
      title: "关键参数",
      body: parameterClaims.map((claim) => [claim.label, claim.value, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "risks_and_gotchas",
      title: "风险与易错点",
      body: risks.map((claim) => [claim.label, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: nextSteps.join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "glossary_for_juniors",
      title: "给新人的术语表",
      body: glossaryBody,
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);

  const executiveSummary =
    [
      asString(partIdentity.canonicalPartNumber),
      asString(partIdentity.deviceClass),
      asString(partIdentity.shortDescription)
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`;
  const claims = [...localClaims, ...parameterClaims, ...designFocus, ...risks, ...internActions];

  return {
    executiveSummary,
    deviceIdentity: {
      canonicalPartNumber: asString(partIdentity.canonicalPartNumber) || input.identity.canonicalPartNumber,
      manufacturer: asString(partIdentity.manufacturer) || input.identity.manufacturer,
      deviceClass: asString(partIdentity.deviceClass) || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(partIdentity, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: parameterClaims.length ? parameterClaims : localClaims,
    designFocus,
    risks,
    openQuestions: [],
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

function normalizeGeminiDeviceInfoAnalysisReport(root: LooseObject, input: ReportSynthesisInput): ReportOutput {
  const deviceInfo = asObject(root.deviceInfo) ?? {};
  const howToRead = asObject(root.howToReadThisDatasheet) ?? {};
  const parameterAnalysis = asObject(root.parameterAnalysis) ?? {};
  const risksAndGotchas = asObject(root.risksAndGotchas) ?? {};
  const terminologyExplanation = Array.isArray(root.terminologyExplanation) ? root.terminologyExplanation : [];
  const nextSteps = Array.isArray(root.nextSteps) ? root.nextSteps : [];

  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);
  const parameterRows = Array.isArray(parameterAnalysis.table) ? parameterAnalysis.table : [];
  const engineeringJudgment = asStringArray(parameterAnalysis.engineeringJudgment);
  const riskRows = Array.isArray(risksAndGotchas.table) ? risksAndGotchas.table : [];
  const readingOrder = asStringArray(howToRead.readingOrder);
  const keySections = asStringArray(howToRead.keySections);

  const parameterClaims = parameterRows
    .map((entry, index) => {
      const row = asObject(entry);
      if (!row) return null;
      return makeGeminiReviewClaim({
        id: `gemini-device-info-analysis-key-${index + 1}`,
        label: asString(row.parameter) || `Parameter ${index + 1}`,
        value: asString(row.value),
        body: asString(row.engineeringMeaning) || asString(row.explanation) || asString(row.value)
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const risks = [
    ...riskRows
      .map((entry, index) => {
        const row = asObject(entry);
        if (!row) return null;
        return makeGeminiReviewClaim({
          id: `gemini-device-info-analysis-risk-${index + 1}`,
          label: asString(row.risk) || `Risk ${index + 1}`,
          body: [asString(row.whyItMatters), asString(row.impact), asString(row.mitigation)].filter(Boolean).join(" | ")
        });
      })
      .filter((claim): claim is ReportClaim => Boolean(claim)),
    ...engineeringJudgment.map((item, index) =>
      makeGeminiReviewClaim({
        id: `gemini-device-info-analysis-judgment-${index + 1}`,
        label: `Engineering judgment ${index + 1}`,
        body: item
      })
    )
  ];
  const designFocus = [...readingOrder, ...keySections].map((item, index) =>
    makeGeminiReviewClaim({
      id: `gemini-device-info-analysis-read-${index + 1}`,
      label: `Reading step ${index + 1}`,
      body: item
    })
  );
  const internActions = nextSteps
    .map((entry, index) => {
      const row = asObject(entry);
      if (!row) return null;
      return makeGeminiReviewClaim({
        id: `gemini-device-info-analysis-next-${index + 1}`,
        label: asString(row.action) || `Intern step ${index + 1}`,
        body: asString(row.detail) || asString(row.action) || `Intern step ${index + 1}`
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const glossaryBody = terminologyExplanation
    .map((entry) => {
      const row = asObject(entry);
      if (!row) return "";
      return [asString(row.term), asString(row.definition), asString(row.explanation)].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .join("\n");

  const sections = [
    {
      id: "device_identity",
      title: "器件身份",
      body: [asString(deviceInfo.manufacturer), asString(deviceInfo.canonicalPartNumber), asString(deviceInfo.deviceClass)]
        .filter(Boolean)
        .join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: asString(deviceInfo.description),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: [...readingOrder, ...keySections].join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "key_parameters",
      title: "关键参数",
      body: parameterClaims.map((claim) => [claim.label, claim.value, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "risks_and_gotchas",
      title: "风险与易错点",
      body: risks.map((claim) => [claim.label, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: internActions.map((claim) => claim.body).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "glossary_for_juniors",
      title: "给新人的术语表",
      body: glossaryBody,
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);

  const executiveSummary =
    [
      asString(deviceInfo.canonicalPartNumber),
      asString(deviceInfo.deviceClass),
      asString(deviceInfo.description)
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`;
  const claims = [...localClaims, ...parameterClaims, ...designFocus, ...risks, ...internActions];

  return {
    executiveSummary,
    deviceIdentity: {
      canonicalPartNumber: asString(deviceInfo.canonicalPartNumber) || input.identity.canonicalPartNumber,
      manufacturer: asString(deviceInfo.manufacturer) || input.identity.manufacturer,
      deviceClass: asString(deviceInfo.deviceClass) || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(deviceInfo, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: parameterClaims.length ? parameterClaims : localClaims,
    designFocus,
    risks,
    openQuestions: [],
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

function getFlexibleIdentity(root: LooseObject) {
  return (
    asObject(root.deviceIdentity) ??
    asObject(root.device_identity) ??
    asObject(root.deviceIdentification) ??
    asObject(root.device_identification) ??
    asObject(root.deviceInfo) ??
    asObject(root.partIdentity) ??
    asObject(root.device_overview) ??
    null
  );
}

function getFlexibleReadingGuide(root: LooseObject) {
  return (
    asObject(root.readingStrategy) ??
    asObject(root.howToReadThisDatasheet) ??
    asObject(root.how_to_read_this_datasheet) ??
    asObject(root.instructionalGuide) ??
    null
  );
}

function pushReviewClaim(list: ReportClaim[], id: string, label: string, value: string, body: string) {
  if (!label && !value && !body) return;
  list.push(
    makeGeminiReviewClaim({
      id,
      label: label || id,
      value,
      body: body || value || label || id
    })
  );
}

function normalizeFlexibleGeminiReport(root: LooseObject, input: ReportSynthesisInput): ReportOutput | null {
  const identity = getFlexibleIdentity(root);
  if (!identity) {
    return null;
  }

  const canonicalPartNumber =
    asString(identity.canonicalPartNumber) ||
    asString(identity.canonical_part_number) ||
    asString(identity.part_number);
  const manufacturer = asString(identity.manufacturer);
  const deviceClass = asString(identity.deviceClass) || asString(identity.device_class);

  if (!canonicalPartNumber && !manufacturer && !deviceClass) {
    return null;
  }

  const readingGuide = getFlexibleReadingGuide(root) ?? {};
  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);

  const readingItems = [
    ...asStringArray(readingGuide.readingOrder),
    ...asStringArray(readingGuide.reading_order),
    ...asStringArray(readingGuide.readingSequence),
    ...asStringArray(readingGuide.suggested_reading_order),
    ...asStringArray(readingGuide.keySections),
    ...asStringArray(readingGuide.criticalChapters)
  ];

  const keyParameters: ReportClaim[] = [];
  const keyParameterArrays = [
    root.keyParameters,
    asObject(root.key_parameters)?.table_data,
    asObject(root.key_parameters)?.parameters,
    asObject(root.parameterAnalysis)?.table,
    asObject(root.keyParameters)?.summary,
    asObject(root.instructionalGuide)?.key_parameters
  ];
  for (const source of keyParameterArrays) {
    if (!Array.isArray(source)) continue;
    for (const [index, entry] of source.entries()) {
      const row = asObject(entry);
      if (!row) continue;
      pushReviewClaim(
        keyParameters,
        `flex-key-${keyParameters.length + 1}`,
        asString(row.parameter) || asString(row.name) || `Parameter ${index + 1}`,
        asString(row.value),
        asString(row.engineeringSignificance) ||
          asString(row.engineeringMeaning) ||
          asString(row.significance) ||
          asString(row.explanation) ||
          asString(row.description)
      );
    }
  }

  const keyParameterObjects = [
    asObject(root.parameter_table),
    asObject(root.parameterTable)
  ];
  for (const objectSource of keyParameterObjects) {
    if (!objectSource) continue;
    for (const [key, value] of Object.entries(objectSource)) {
      pushReviewClaim(keyParameters, `flex-table-${keyParameters.length + 1}`, key, asString(value), asString(value));
    }
  }

  const conditionWarnings = [
    ...asStringArray(asObject(root.key_parameters)?.condition_warnings),
    ...asStringArray(asObject(root.parameterAnalysis)?.engineeringJudgment),
    ...asStringArray(asObject(root.keyParameters)?.conditionWarnings)
  ];
  for (const warning of conditionWarnings) {
    pushReviewClaim(keyParameters, `flex-warning-${keyParameters.length + 1}`, "Condition warning", "", warning);
  }

  const risks: ReportClaim[] = [];
  const riskArrays = [
    root.risksAndGotchas,
    root.risks_and_gotchas,
    asObject(root.risksAndGotchas)?.table,
    asObject(root.risks_and_gotchas)?.table,
    asObject(root.risks_and_gotchas)?.table_data,
    asObject(root.risk_analysis),
    asObject(root.riskAssessmentTable),
    asObject(root.instructionalGuide)?.risks_and_gotchas,
    asObject(root.instructionForIntern)?.commonMisinterpretations
  ];
  for (const source of riskArrays) {
    if (!Array.isArray(source)) continue;
    for (const [index, entry] of source.entries()) {
      const row = asObject(entry);
      if (!row) {
        const text = asString(entry);
        if (text) {
          pushReviewClaim(risks, `flex-risk-${risks.length + 1}`, `Risk ${index + 1}`, "", text);
        }
        continue;
      }
      pushReviewClaim(
        risks,
        `flex-risk-${risks.length + 1}`,
        asString(row.type) || asString(row.risk) || `Risk ${index + 1}`,
        "",
        [
          asString(row.description),
          asString(row.detail),
          asString(row.impact),
          asString(row.implication),
          asString(row.whyItMatters),
          asString(row.mitigation)
        ]
          .filter(Boolean)
          .join(" | ")
      );
    }
  }
  const riskObjectSources = [
    asObject(root.risksAndGotchas),
    asObject(root.risks_and_gotchas)
  ];
  for (const objectSource of riskObjectSources) {
    const technicalRisks = Array.isArray(objectSource?.technicalRisks) ? objectSource.technicalRisks : [];
    const commonMisinterpretations = Array.isArray(objectSource?.commonMisinterpretations)
      ? objectSource.commonMisinterpretations
      : [];
    for (const item of [...technicalRisks, ...commonMisinterpretations]) {
      const text = asString(item);
      if (text) {
        pushReviewClaim(risks, `flex-risk-${risks.length + 1}`, `Risk ${risks.length + 1}`, "", text);
      }
    }
  }

  const nextStepItems = [
    ...asStringArray(root.nextSteps),
    ...asStringArray(root.next_steps),
    ...asStringArray(root.nextStepsForIntern),
    ...asStringArray(root.next_steps_for_intern),
    ...asStringArray(asObject(root.intern_action_list)?.immediate_tasks),
    ...asStringArray(asObject(root.intern_action_list)?.long_term_growth),
    ...asStringArray(asObject(root.instructionForIntern)?.immediateNextSteps)
  ];
  const nextStepObjects = [
    ...(Array.isArray(root.nextSteps) ? root.nextSteps : []),
    ...(Array.isArray(root.next_steps) ? root.next_steps : [])
  ];
  const internActions: ReportClaim[] = [];
  for (const item of nextStepItems) {
    pushReviewClaim(internActions, `flex-next-${internActions.length + 1}`, `Intern step ${internActions.length + 1}`, "", item);
  }
  for (const entry of nextStepObjects) {
    const row = asObject(entry);
    if (!row) continue;
    const body = asString(row.detail) || asString(row.description) || asString(row.action);
    pushReviewClaim(
      internActions,
      `flex-next-${internActions.length + 1}`,
      asString(row.action) || `Intern step ${internActions.length + 1}`,
      "",
      body
    );
  }

  const glossaryLines: string[] = [];
  const glossarySources = [
    root.terminologyExplanation,
    root.engineering_terminology,
    asObject(readingGuide.jargon_briefing),
    readingGuide.engineeringTerms,
    readingGuide.terminology_definitions,
    asObject(root.keyParameters)?.terminologyExplanations
  ];
  for (const source of glossarySources) {
    if (Array.isArray(source)) {
      for (const entry of source) {
        const row = asObject(entry);
        if (!row) continue;
        const line = [asString(row.term), asString(row.definition), asString(row.explanation)].filter(Boolean).join(": ");
        if (line) glossaryLines.push(line);
      }
      continue;
    }
    const objectSource = asObject(source);
    if (!objectSource) continue;
    for (const [term, meaning] of Object.entries(objectSource)) {
      const line = [term, asString(meaning)].filter(Boolean).join(": ");
      if (line) glossaryLines.push(line);
    }
  }

  const whatThisPartIsFor =
    asString(identity.what_this_part_is_for) ||
    asString(identity.application) ||
    asString(identity.shortDescription) ||
    asString(identity.description) ||
    asString(asObject(root.instructionalGuide)?.what_this_part_is_for);

  const openQuestions: ReportClaim[] = [];
  const openQuestionSources = [root.openQuestions, root.open_questions];
  for (const source of openQuestionSources) {
    if (!Array.isArray(source)) continue;
    for (const [index, entry] of source.entries()) {
      const row = asObject(entry);
      if (!row) {
        const text = asString(entry);
        if (text) {
          openQuestions.push(
            makeReviewClaim({
              id: `flex-open-${openQuestions.length + 1}`,
              label: `Open question ${index + 1}`,
              body: text
            })
          );
        }
        continue;
      }
      openQuestions.push(
        makeReviewClaim({
          id: `flex-open-${openQuestions.length + 1}`,
          label: asString(row.question) || `Open question ${index + 1}`,
          body: [asString(row.status), asString(row.impact)].filter(Boolean).join(" | ")
        })
      );
    }
  }

  const sections = [
    {
      id: "device_identity",
      title: "器件身份",
      body: [manufacturer, canonicalPartNumber, deviceClass].filter(Boolean).join(" "),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "what_this_part_is_for",
      title: "这颗器件是做什么的",
      body: whatThisPartIsFor,
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "how_to_read_this_datasheet",
      title: "怎么读这份 Datasheet",
      body: [
        ...readingItems,
        asString(readingGuide.engineeringContext),
        asString(asObject(root.instructionForIntern)?.engineeringMindset)
      ]
        .filter(Boolean)
        .join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "key_parameters",
      title: "关键参数",
      body: keyParameters.map((claim) => [claim.label, claim.value, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "risks_and_gotchas",
      title: "风险与易错点",
      body: risks.map((claim) => [claim.label, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "intern_action_list",
      title: "实习生下一步动作",
      body: internActions.map((claim) => claim.body).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "open_questions",
      title: "待确认问题",
      body: openQuestions.map((claim) => [claim.label, claim.body].filter(Boolean).join(": ")).join("\n"),
      sourceType: "review" as const,
      citations: []
    },
    {
      id: "glossary_for_juniors",
      title: "给新人的术语表",
      body: glossaryLines.join("\n"),
      sourceType: "review" as const,
      citations: []
    }
  ].filter((section) => section.body);

  const claims = [...localClaims, ...keyParameters, ...risks, ...internActions];

  return {
    executiveSummary:
      [canonicalPartNumber, deviceClass, whatThisPartIsFor].filter(Boolean).join(" ").trim() ||
      `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`,
    deviceIdentity: {
      canonicalPartNumber: canonicalPartNumber || input.identity.canonicalPartNumber,
      manufacturer: manufacturer || input.identity.manufacturer,
      deviceClass: deviceClass || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(identity, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: keyParameters.length ? keyParameters : localClaims,
    designFocus: readingItems.map((item, index) =>
      makeGeminiReviewClaim({
        id: `flex-read-${index + 1}`,
        label: `Reading step ${index + 1}`,
        body: item
      })
    ),
    risks,
    openQuestions,
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

function normalizeReportOutput(raw: unknown, input: ReportSynthesisInput): ReportOutput {
  const root = asObject(raw);
  if (!root) {
    throw new Error("report completion is not an object");
  }

  const standardReport = root.executiveSummary ? root : null;
  if (standardReport) {
    return normalizeReport(standardReport as ReportOutput);
  }

  if (root.deviceIdentification && root.instructionalReport) {
    return normalizeReport(normalizeGeminiInstructionalReport(root, input));
  }

  if (root.deviceInfo && root.instructionalGuide) {
    return normalizeReport(normalizeGeminiDeviceInfoReport(root, input));
  }

  if (root.device_identification && root.key_parameters) {
    return normalizeReport(normalizeGeminiSnakeCaseReport(root, input));
  }

  if (root.device_identity && root.parameter_table) {
    return normalizeReport(normalizeGeminiDeviceIdentityReport(root, input));
  }

  if (root.partIdentity && root.parameterTable) {
    return normalizeReport(normalizeGeminiPartIdentityReport(root, input));
  }

  if (root.deviceInfo && root.parameterAnalysis) {
    return normalizeReport(normalizeGeminiDeviceInfoAnalysisReport(root, input));
  }

  if (root.device_overview && root.parameter_table) {
    return normalizeReport(normalizeGeminiDeviceOverviewReport(root, input));
  }

  if (root.deviceIdentification) {
    return normalizeReport(normalizeGeminiStyleReport(root, input));
  }

  if (root.deviceIdentity && root.readingStrategy) {
    return normalizeReport(normalizeGeminiReadingStrategyReport(root, input));
  }

  const flexibleReport = normalizeFlexibleGeminiReport(root, input);
  if (flexibleReport) {
    return normalizeReport(flexibleReport);
  }

  const teachingReport = asObject(root.teachingReport);
  if (!teachingReport) {
    console.error("[real-provider] unsupported report payload shape", {
      topLevelKeys: Object.keys(root),
      hasDeviceIdentification: Boolean(root.deviceIdentification),
      hasInstructionalReport: Boolean(root.instructionalReport),
      hasReadingStrategy: Boolean(root.readingStrategy),
      hasTeachingReport: Boolean(root.teachingReport),
      fileName: input.fileName,
      chipName: input.chipName,
      raw
    });
    throw new Error("unsupported report payload");
  }

  const identity = asObject(teachingReport.deviceIdentity) ?? {};
  const localClaims = buildDatasheetClaimsFromPreparation(input.preparation);
  const riskRows = Array.isArray(asObject(teachingReport.riskTable)?.rows) ? (asObject(teachingReport.riskTable)?.rows as unknown[]) : [];
  const openQuestions = asStringArray(teachingReport.openQuestions).map((question, index) =>
    makeReviewClaim({
      id: `open-question-${index + 1}`,
      label: `Open question ${index + 1}`,
      body: question
    })
  );
  const risks = riskRows
    .map((row, index) => {
      const values = Array.isArray(row) ? row.map(asString) : [];
      if (!values.length) return null;
      return makeReviewClaim({
        id: `risk-${index + 1}`,
        label: values[0] || `Risk ${index + 1}`,
        title: values[0] || `Risk ${index + 1}`,
        body: values.slice(1).filter(Boolean).join(" | ")
      });
    })
    .filter((claim): claim is ReportClaim => Boolean(claim));
  const sections = normalizeTeachingSections(teachingReport, identity);
  const executiveSummary =
    [asString(identity.canonicalPartNumber), asString(identity.primaryFunction), asString(identity.applicationContext)]
      .filter(Boolean)
      .join(" ")
      .trim() || `${input.identity.canonicalPartNumber} 已生成教学式工程报告。`;
  const designFocus = input.identity.focusChecklist.map((item, index) =>
    makeReviewClaim({
      id: `focus-${index + 1}`,
      label: item,
      title: item,
      body: item
    })
  );
  const claims = [...localClaims, ...designFocus, ...risks, ...openQuestions];

  return {
    executiveSummary,
    deviceIdentity: {
      canonicalPartNumber: asString(identity.canonicalPartNumber) || input.identity.canonicalPartNumber,
      manufacturer: asString(identity.manufacturer) || input.identity.manufacturer,
      deviceClass: asString(identity.deviceClass) || input.identity.deviceClass,
      parameterTemplateId: resolveIdentityTemplateId(identity, input.identity.parameterTemplateId),
      confidence: input.identity.confidence
    },
    keyParameters: localClaims,
    designFocus,
    risks,
    openQuestions,
    publicNotes: [],
    citations: localClaims.flatMap((claim) => claim.citations),
    sections,
    claims
  };
}

async function repairReportOutput(
  config: OpenAiProviderConfig,
  rawContent: string,
  input: ReportSynthesisInput
) {
  const response = await callChatCompletion(config, {
    messages: [
      {
        role: "system",
        content: reportRepairInstruction()
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `fileName=${input.fileName}`,
              `chipName=${input.chipName}`,
              `parameterTemplateId=${input.identity.parameterTemplateId}`,
              "下面是待修复的原始 JSON/文本输出：",
              rawContent
            ].join("\n\n")
          }
        ]
      }
    ]
  });

  return parseJsonFromMessage<unknown>(response.choices?.[0]?.message?.content);
}

function normalizeCitation(citation: ClaimCitation): ClaimCitation {
  return {
    id: citation.id,
    sourceType: citation.sourceType,
    page: citation.page,
    quote: citation.quote ?? "",
    url: citation.url ?? "",
    title: citation.title ?? "",
    snippet: citation.snippet ?? ""
  };
}

function normalizeCitationList(value: unknown): ClaimCitation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      const citation = asObject(entry);
      if (!citation) {
        return null;
      }

      return normalizeCitation({
        id: asString(citation.id) || `citation-${index + 1}`,
        sourceType: asString(citation.sourceType) === "public" ? "public" : "datasheet",
        page: asNumber(citation.page) ?? undefined,
        quote: asString(citation.quote) || undefined,
        url: asString(citation.url) || undefined,
        title: asString(citation.title) || undefined,
        snippet: asString(citation.snippet) || undefined
      });
    })
    .filter((item): item is ClaimCitation => Boolean(item));
}

function normalizeClaimList(value: unknown): ReportClaim[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      const claim = asObject(entry);
      if (!claim) {
        return null;
      }

      const label = asString(claim.label) || asString(claim.title) || `Claim ${index + 1}`;
      return normalizeClaim({
        id: asString(claim.id) || `claim-${index + 1}`,
        label,
        value: asString(claim.value) || undefined,
        title: asString(claim.title) || undefined,
        body: asString(claim.body) || undefined,
        sourceType:
          asString(claim.sourceType) === "public"
            ? "public"
            : asString(claim.sourceType) === "review"
              ? "review"
              : "datasheet",
        citations: normalizeCitationList(claim.citations)
      });
    })
    .filter((item): item is ReportClaim => Boolean(item));
}

function normalizeSectionList(value: unknown): ReportOutput["sections"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      const section = asObject(entry);
      if (!section) {
        return null;
      }

      return {
        id: asString(section.id) || `section-${index + 1}`,
        title: asString(section.title) || `Section ${index + 1}`,
        body: asString(section.body),
        sourceType:
          asString(section.sourceType) === "public"
            ? "public"
            : asString(section.sourceType) === "review"
              ? "review"
              : "datasheet",
        citations: normalizeCitationList(section.citations)
      };
    })
    .filter((item): item is ReportOutput["sections"][number] => Boolean(item));
}

function normalizeClaim(claim: ReportClaim): ReportClaim {
  return {
    id: claim.id,
    label: claim.label,
    value: claim.value ?? "",
    title: claim.title ?? "",
    body: claim.body ?? "",
    sourceType: claim.sourceType,
    citations: claim.citations.map(normalizeCitation)
  };
}

function normalizeParameterDrafts(raw: unknown, producer: ParameterDraft["producer"]): ParameterDraft[] {
  const root = asObject(raw);
  const candidates = Array.isArray(root?.keyParameters)
    ? root?.keyParameters
    : Array.isArray(root?.parameters)
      ? root?.parameters
      : Array.isArray(raw)
        ? raw
        : [];

  const drafts: ParameterDraft[] = [];

  for (const [index, entry] of candidates.entries()) {
    const item = asObject(entry);
    if (!item) continue;

    const name =
      asString(item.name) ||
      asString(item.label) ||
      asString(item.parameter) ||
      `Parameter ${index + 1}`;
    const value =
      asString(item.value) ||
      asString(item.body) ||
      [asString(item.min), asString(item.typ), asString(item.max), asString(item.unit)].filter(Boolean).join(" / ");
    if (!name || !value) {
      continue;
    }

    const citations = Array.isArray(item.citations)
      ? item.citations.map((citation, citationIndex) => {
          const normalized = asObject(citation);
          return {
            id: asString(normalized?.id) || `${producer}-draft-cite-${index + 1}-${citationIndex + 1}`,
            sourceType: asString(normalized?.sourceType) === "public" ? "public" as const : "datasheet" as const,
            page: asNumber(normalized?.page) ?? undefined,
            quote: asString(normalized?.quote) || asString(normalized?.snippet) || undefined,
            url: asString(normalized?.url) || undefined,
            title: asString(normalized?.title) || undefined,
            snippet: asString(normalized?.snippet) || undefined
          } satisfies ClaimCitation;
        })
      : [];

    drafts.push({
      name,
      value,
      sourceType: citations.some((citation) => citation.sourceType === "public") ? "public" : "datasheet",
      citations,
      producer
    });
  }

  return drafts;
}

function normalizeArbitrationNote(raw: unknown, fallbackFieldName: string): ParameterArbitrationNote | null {
  const root = asObject(raw);
  if (!root) {
    return null;
  }

  const recommendedValue = asString(root.recommendedValue) || asString(root.value);
  const decision = asString(root.decision) as ParameterArbitrationNote["decision"];
  if (!recommendedValue || !decision) {
    return null;
  }

  return {
    fieldName: asString(root.fieldName) || fallbackFieldName,
    decision,
    recommendedValue,
    reason: asString(root.reason) || "系统已完成参数冲突复核。",
    reviewSourceLabel: asString(root.reviewSourceLabel) || "System Arbitration"
  };
}

function normalizeClaimText(value: string) {
  return value.trim().toLowerCase();
}

const rfLabelAliasMap: Array<{
  templateIds: string[];
  canonicalLabel: string;
  aliases: string[];
}> = [
  {
    templateIds: ["wifi"],
    canonicalLabel: "Frequency Coverage",
    aliases: ["frequency coverage", "frequency range", "supported bands", "frequency"]
  },
  {
    templateIds: ["wifi"],
    canonicalLabel: "TX Linear Output Power",
    aliases: ["tx linear output power", "tx output power", "linear output power", "output power"]
  },
  {
    templateIds: ["wifi"],
    canonicalLabel: "EVM / ACLR Condition",
    aliases: ["evm / aclr condition", "evm condition", "aclr condition", "devm", "evm", "aclr"]
  },
  {
    templateIds: ["wifi"],
    canonicalLabel: "RX Gain / Noise Figure / Bypass Loss",
    aliases: ["rx gain / noise figure / bypass loss", "rx gain", "noise figure", "rx nf", "bypass loss", "insertion loss", "isolation"]
  },
  {
    templateIds: ["wifi"],
    canonicalLabel: "Control Mode / Truth Table",
    aliases: ["control mode / truth table", "truth table", "control mode", "switching logic", "control interface", "switching time"]
  },
  {
    templateIds: ["wifi"],
    canonicalLabel: "Supply Voltage",
    aliases: ["supply voltage", "operating voltage", "vcc", "vcc / supply", "supply"]
  },
  {
    templateIds: ["rf-general"],
    canonicalLabel: "Device Role",
    aliases: ["device role", "rf type", "role"]
  },
  {
    templateIds: ["rf-general"],
    canonicalLabel: "Frequency Range / Supported Bands",
    aliases: ["frequency range / supported bands", "frequency range", "supported bands", "frequency coverage", "frequency"]
  },
  {
    templateIds: ["rf-general"],
    canonicalLabel: "Output Power / Linear Output Power",
    aliases: ["output power / linear output power", "linear output power", "output power", "tx output power"]
  },
  {
    templateIds: ["rf-general"],
    canonicalLabel: "Gain / Insertion Loss / Noise Figure / Isolation",
    aliases: ["gain / insertion loss / noise figure / isolation", "gain", "noise figure", "insertion loss", "isolation", "nf"]
  },
  {
    templateIds: ["rf-general"],
    canonicalLabel: "Control Interface / Truth Table / Switching Time",
    aliases: ["control interface / truth table / switching time", "control interface", "truth table", "switching time", "control mode"]
  },
  {
    templateIds: ["rf-general"],
    canonicalLabel: "Supply Voltage / Current Consumption",
    aliases: ["supply voltage / current consumption", "supply voltage", "operating voltage", "current consumption", "current"]
  },
  {
    templateIds: ["rf-general"],
    canonicalLabel: "Package / Thermal / Layout",
    aliases: ["package / thermal / layout", "package", "thermal", "layout", "package / case"]
  }
];

function canonicalizeRfClaimLabel(templateId: string, label: string) {
  const normalizedLabel = normalizeClaimText(label);
  for (const mapping of rfLabelAliasMap) {
    if (!mapping.templateIds.includes(templateId)) continue;
    if (mapping.aliases.some((alias) => normalizedLabel === alias || normalizedLabel.includes(alias))) {
      return mapping.canonicalLabel;
    }
  }
  return label;
}

function isOpenQuestionLikeClaim(claim: ReportClaim) {
  const merged = normalizeClaimText([claim.label, claim.title ?? "", claim.value ?? "", claim.body ?? ""].join(" "));
  return merged.includes("待确认") || merged.includes("open question") || merged.includes("tbd") || merged.includes("unknown");
}

function isRiskLikeClaim(claim: ReportClaim) {
  const merged = normalizeClaimText([claim.label, claim.title ?? "", claim.value ?? "", claim.body ?? ""].join(" "));
  return (
    merged.includes("risk") ||
    merged.includes("风险") ||
    merged.includes("challenge") ||
    merged.includes("compatibility") ||
    merged.includes("thermal") ||
    merged.includes("layout") ||
    merged.includes("integrity") ||
    merged.includes("trade-off") ||
    merged.includes("tradeoff")
  );
}

function alignRfClaimsWithTemplate(report: ReportOutput): ReportOutput {
  const rfTemplate = resolveRfTemplateDefinition(report.deviceIdentity.parameterTemplateId);
  if (!rfTemplate) {
    return report;
  }

  const normalizeRfParameterClaim = (claim: ReportClaim): ReportClaim => ({
    ...claim,
    label: canonicalizeRfClaimLabel(report.deviceIdentity.parameterTemplateId, claim.label),
    title: canonicalizeRfClaimLabel(report.deviceIdentity.parameterTemplateId, claim.title || claim.label)
  });

  const normalizedKeyParameters = report.keyParameters.map(normalizeRfParameterClaim);
  const normalizedKeyParameterById = new Map(normalizedKeyParameters.map((claim) => [claim.id, claim]));
  const normalizedReport = {
    ...report,
    keyParameters: normalizedKeyParameters,
    claims: report.claims.map((claim) => normalizedKeyParameterById.get(claim.id) ?? claim)
  };

  const allowedParameterFields = [...rfTemplate.mustExtractFields, ...rfTemplate.mustExtractAliases].map(normalizeClaimText);
  const reviewHints = [...rfTemplate.mustReviewTopics, ...rfTemplate.mustReviewAliases].map(normalizeClaimText);
  const nextKeyParameters: ReportClaim[] = [];
  const nextDesignFocus = [...normalizedReport.designFocus];
  const nextRisks = [...normalizedReport.risks];
  const nextOpenQuestions = [...normalizedReport.openQuestions];

  for (const claim of normalizedReport.keyParameters) {
    const labelAndTitle = normalizeClaimText([claim.label, claim.title ?? ""].join(" "));
    const merged = normalizeClaimText([claim.label, claim.title ?? "", claim.value ?? "", claim.body ?? ""].join(" "));

    if (isOpenQuestionLikeClaim(claim)) {
      nextOpenQuestions.push(claim);
      continue;
    }

    if (reviewHints.some((hint) => hint && merged.includes(hint)) || isRiskLikeClaim(claim)) {
      if (rfTemplate.id === "cellular-pam" && (merged.includes("port mapping") || merged.includes("apt power") || merged.includes("routing"))) {
        nextDesignFocus.push(claim);
      } else {
        nextRisks.push(claim);
      }
      continue;
    }

    if (allowedParameterFields.some((field) => field && labelAndTitle.includes(field))) {
      nextKeyParameters.push(claim);
      continue;
    }

    if (rfTemplate.id === "cellular-pam") {
      nextDesignFocus.push(claim);
      continue;
    }

    nextKeyParameters.push(claim);
  }

  return {
    ...normalizedReport,
    keyParameters: nextKeyParameters,
    designFocus: nextDesignFocus.filter((claim, index, list) => list.findIndex((item) => item.id === claim.id) === index),
    risks: nextRisks.filter((claim, index, list) => list.findIndex((item) => item.id === claim.id) === index),
    openQuestions: nextOpenQuestions.filter((claim, index, list) => list.findIndex((item) => item.id === claim.id) === index)
  };
}

function fallbackDeviceClass(report: ReportOutput) {
  const current = (report.deviceIdentity.deviceClass || "").trim();
  if (current && current.toLowerCase() !== "unknown") {
    return current;
  }

  const fromSections = report.sections
    .map((section) => `${section.title}\n${section.body}`)
    .join("\n");
  const fromClaims = report.claims
    .map((claim) => `${claim.label}\n${claim.value ?? ""}\n${claim.body ?? ""}`)
    .join("\n");
  const merged = `${fromSections}\n${fromClaims}`.toLowerCase();
  const templateId = report.deviceIdentity.parameterTemplateId;

  if (templateId === "wifi") return "WiFi Front End Module";
  if (templateId === "cellular-3g4g5g") return "Cellular PAM / PA";
  if (templateId === "power") return "Power";
  if (templateId === "serial-flash") return "Serial NOR Flash";
  if (templateId === "audio") return "Audio";
  if (templateId === "rf-general") return "RF";
  if (merged.includes("wifi")) return "WiFi Front End Module";
  if (merged.includes("cellular") || merged.includes("pam")) return "Cellular PAM / PA";
  if (merged.includes("power") || merged.includes("regulator") || merged.includes("converter")) return "Power";
  return "Generic";
}

function normalizeSectionId(section: ReportOutput["sections"][number]) {
  const normalizedId = (section.id || "").trim().toLowerCase();
  const title = `${section.title}\n${section.body}`.toLowerCase();
  const combined = `${normalizedId}\n${title}`;

  if (
    normalizedId === "device_identity" ||
    normalizedId === "what_this_part_is_for" ||
    normalizedId === "how_to_read_this_datasheet" ||
    normalizedId === "section_by_section_reading_order" ||
    normalizedId === "critical_graphs_and_tables" ||
    normalizedId === "key_parameters" ||
    normalizedId === "risks_and_gotchas" ||
    normalizedId === "intern_action_list" ||
    normalizedId === "open_questions" ||
    normalizedId === "glossary_for_juniors"
  ) {
    return normalizedId;
  }

  if (
    combined.includes("器件身份") ||
    combined.includes("device identity") ||
    combined.includes("第一步：确定身份与用途") ||
    combined.includes("step_1") ||
    combined.includes("step1")
  ) {
    return "device_identity";
  }
  if (combined.includes("做什么") || combined.includes("what this part is for")) return "what_this_part_is_for";
  if (
    combined.includes("怎么读") ||
    combined.includes("how to read") ||
    combined.includes("第二步：关键特性") ||
    combined.includes("feature list") ||
    combined.includes("step_2") ||
    combined.includes("features")
  ) {
    return "how_to_read_this_datasheet";
  }
  if (combined.includes("章节阅读顺序") || combined.includes("reading order")) return "section_by_section_reading_order";
  if (
    combined.includes("重点表格") ||
    combined.includes("graphs and tables") ||
    combined.includes("第三步：理解内部结构") ||
    combined.includes("block diagram") ||
    combined.includes("step_3")
  ) {
    return "critical_graphs_and_tables";
  }
  if (
    combined.includes("关键参数") ||
    combined.includes("key parameters") ||
    combined.includes("第五步：rf 参数") ||
    combined.includes("rf 参数的工程判断") ||
    combined.includes("step_5") ||
    combined.includes("step5")
  ) {
    return "key_parameters";
  }
  if (
    combined.includes("风险") ||
    combined.includes("gotchas") ||
    combined.includes("第四步：区分限制与推荐条件") ||
    combined.includes("第六步：物理落地风险") ||
    combined.includes("absolute max") ||
    combined.includes("recommended operating") ||
    combined.includes("layout") ||
    combined.includes("thermal") ||
    combined.includes("step_4") ||
    combined.includes("step_6") ||
    combined.includes("limits")
  ) {
    return "risks_and_gotchas";
  }
  if (combined.includes("实习生") || combined.includes("next step")) return "intern_action_list";
  if (combined.includes("待确认") || combined.includes("open question")) return "open_questions";
  if (combined.includes("术语") || combined.includes("glossary")) return "glossary_for_juniors";

  return section.id;
}

function normalizeReport(report: ReportOutput): ReportOutput {
  const normalizedKeyParameters = normalizeClaimList(report.keyParameters);
  const normalizedDesignFocus = normalizeClaimList(report.designFocus);
  const normalizedRisks = normalizeClaimList(report.risks);
  const normalizedOpenQuestions = normalizeClaimList(report.openQuestions);
  const normalizedPublicNotes = normalizeClaimList(report.publicNotes);
  const normalizedClaims = normalizeClaimList(report.claims);
  const normalizedCitations = normalizeCitationList(report.citations);
  const normalizedSections = normalizeSectionList(report.sections).map((section) => ({
    ...section,
    id: normalizeSectionId(section),
    citations: section.citations.map(normalizeCitation)
  }));

  const alignedReport = alignRfClaimsWithTemplate({
    ...report,
    keyParameters: normalizedKeyParameters,
    designFocus: normalizedDesignFocus,
    risks: normalizedRisks,
    openQuestions: normalizedOpenQuestions,
    publicNotes: normalizedPublicNotes,
    claims: normalizedClaims,
    citations: normalizedCitations,
    sections: normalizedSections
  });

  return {
    ...alignedReport,
    deviceIdentity: {
      ...alignedReport.deviceIdentity,
      deviceClass: fallbackDeviceClass({
        ...alignedReport,
        sections: normalizedSections
      })
    },
    keyParameters: alignedReport.keyParameters.map(normalizeClaim),
    designFocus: alignedReport.designFocus.map(normalizeClaim),
    risks: alignedReport.risks.map(normalizeClaim),
    openQuestions: alignedReport.openQuestions.map(normalizeClaim),
    publicNotes: alignedReport.publicNotes.map(normalizeClaim),
    citations: alignedReport.citations.map(normalizeCitation),
    sections: normalizedSections,
    claims: alignedReport.claims.map(normalizeClaim)
  };
}

function buildImageContent(images: Array<{ page: number; dataUrl: string }>) {
  return images.flatMap((image) => [
    {
      type: "text",
      text: `这是第 ${image.page} 页图像。`
    },
    {
      type: "image_url",
      image_url: {
        url: image.dataUrl
      }
    }
  ]);
}

function buildInlinePdfPart(buffer: Uint8Array) {
  return {
    inline_data: {
      mime_type: "application/pdf",
      data: toBase64(buffer)
    }
  };
}

async function callGeminiGenerateContent(
  config: GeminiProviderConfig,
  body: Record<string, unknown>,
  signal?: AbortSignal
) {
  if (!config.apiKey) {
    throw new Error("missing GEMINI_API_KEY");
  }

  const startedAtMs = Date.now();
  const endpoint = `${resolveGeminiBaseUrl(config.baseUrl)}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;

  logAnalysisEvent("provider.request.started", {
    provider: "gemini",
    model: config.model,
    endpoint,
    contentCount: Array.isArray(body.contents) ? body.contents.length : null
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": config.apiKey
    },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    logAnalysisEvent(
      "provider.request.failed",
      {
        provider: "gemini",
        model: config.model,
        endpoint,
        status: response.status,
        elapsedMs: elapsedMs(startedAtMs)
      },
      "error"
    );
    throw new Error(`gemini request failed: ${response.status}`);
  }

  logAnalysisEvent("provider.request.completed", {
    provider: "gemini",
    model: config.model,
    endpoint,
    status: response.status,
    elapsedMs: elapsedMs(startedAtMs)
  });

  return (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
}

export class OpenAiLlmProvider implements LlmProvider {
  constructor(private readonly config: OpenAiProviderConfig) {}

  async classifyIdentity(input: IdentityClassificationInput): Promise<IdentityClassification> {
    if (supportsOpenAiResponsesPdf(this.config.model)) {
      logAnalysisEvent("provider.stage.started", {
        stage: "classify_identity",
        provider: "openai-compatible",
        model: this.config.model,
        modality: "pdf-inline",
        transport: "responses",
        fileName: input.fileName,
        taskName: input.taskName,
        pageCount: input.preparation.documentMeta.pageCount
      });
      const promptBundle = buildPromptBundle("classify-identity", {
        templateId: input.preparation.identityCandidates.sku?.toLowerCase().includes("pam") ? "cellular-3g4g5g" : "generic-fallback",
        fileName: input.fileName,
        taskName: input.taskName,
        chipName: input.chipName
      });
      const completionStartedAtMs = Date.now();
      const response = await callResponsesApi(this.config, {
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  promptBundle.systemPrompt,
                  promptBundle.taskPrompt,
                  `本地 identity 候选：${JSON.stringify(input.preparation.identityCandidates)}`,
                  `本地参数候选：${JSON.stringify(input.preparation.localCandidates.slice(0, 12))}`,
                  `公网补充：${JSON.stringify(input.publicContext)}`
                ].join("\n\n")
              },
              {
                type: "input_file",
                filename: input.fileName,
                file_data: buildDataUrlPdf(input.pdfBuffer)
              }
            ]
          }
        ]
      }, input.signal);
      logAnalysisEvent("provider.stage.completed", {
        stage: "classify_identity",
        provider: "openai-compatible",
        model: this.config.model,
        modality: "pdf-inline",
        transport: "responses",
        fileName: input.fileName,
        elapsedMs: elapsedMs(completionStartedAtMs)
      });

      return normalizeIdentityClassification(parseResponsesText<unknown>(response));
    }

    const selectedPages = pickPagesForClassification(input);
    const renderStartedAtMs = Date.now();
    logAnalysisEvent("provider.stage.started", {
      stage: "classify_identity",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-pages-as-images",
      fileName: input.fileName,
      taskName: input.taskName,
      selectedPages
    });
    const images = await renderPdfPagesToImages({
      buffer: input.pdfBuffer,
      pages: selectedPages
    });
    logAnalysisEvent("provider.stage.rendered", {
      stage: "classify_identity",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-pages-as-images",
      fileName: input.fileName,
      renderedPageCount: images.length,
      selectedPages,
      elapsedMs: elapsedMs(renderStartedAtMs)
    });
    const promptBundle = buildPromptBundle("classify-identity", {
      templateId: input.preparation.identityCandidates.sku?.toLowerCase().includes("pam") ? "cellular-3g4g5g" : "generic-fallback",
      fileName: input.fileName,
      taskName: input.taskName,
      chipName: input.chipName
    });
    const completionStartedAtMs = Date.now();
    const response = await callChatCompletion(this.config, {
      messages: [
        {
          role: "system",
          content: promptBundle.systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                promptBundle.taskPrompt,
                `本地 identity 候选：${JSON.stringify(input.preparation.identityCandidates)}`,
                `本地参数候选：${JSON.stringify(input.preparation.localCandidates.slice(0, 12))}`,
                `公网补充：${JSON.stringify(input.publicContext)}`
              ].join("\n\n")
            },
            ...buildImageContent(images)
          ]
        }
      ]
    }, input.signal);
    logAnalysisEvent("provider.stage.completed", {
      stage: "classify_identity",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-pages-as-images",
      fileName: input.fileName,
      renderedPageCount: images.length,
      elapsedMs: elapsedMs(completionStartedAtMs)
    });

    return normalizeIdentityClassification(parseJsonFromMessage<unknown>(response.choices?.[0]?.message?.content));
  }

  async extractKeyParameters(input: ParameterExtractionInput): Promise<ParameterDraft[]> {
    if (!supportsOpenAiResponsesPdf(this.config.model)) {
      return [];
    }

    logAnalysisEvent("provider.stage.started", {
      stage: "extract_fast_parameters",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-inline",
      transport: "responses",
      fileName: input.fileName,
      taskName: input.taskName,
      pageCount: input.preparation.documentMeta.pageCount
    });

    const startedAtMs = Date.now();
    const response = await callResponsesApi(this.config, {
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "你只负责从当前 datasheet PDF 中提取首批关键参数，不要输出完整报告。",
                "只返回严格 JSON：{\"keyParameters\":[{\"name\":\"\",\"value\":\"\",\"citations\":[{\"sourceType\":\"datasheet\",\"page\":1,\"quote\":\"\"}]}]}。",
                "name 优先使用当前 parameter template 的标准字段名。",
                "不要输出风险、开放问题、工程建议。",
                `器件识别：${JSON.stringify(input.identity)}`,
                `参数模板：${JSON.stringify(input.parameterTemplate)}`
              ].join("\n\n")
            },
            {
              type: "input_file",
              filename: input.fileName,
              file_data: buildDataUrlPdf(input.pdfBuffer)
            }
          ]
        }
      ]
    }, input.signal);

    logAnalysisEvent("provider.stage.completed", {
      stage: "extract_fast_parameters",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-inline",
      transport: "responses",
      fileName: input.fileName,
      elapsedMs: elapsedMs(startedAtMs)
    });

    return normalizeParameterDrafts(parseResponsesText<unknown>(response), "gpt-4o");
  }

  async synthesizeReport(input: ReportSynthesisInput): Promise<ReportOutput> {
    if (supportsOpenAiResponsesPdf(this.config.model)) {
      logAnalysisEvent("provider.stage.started", {
        stage: "synthesize_report",
        provider: "openai-compatible",
        model: this.config.model,
        modality: "pdf-inline",
        transport: "responses",
        fileName: input.fileName,
        taskName: input.taskName,
        pageCount: input.preparation.documentMeta.pageCount
      });
      const promptBundle = buildPromptBundle("synthesize-report", {
        templateId: input.identity.parameterTemplateId,
        fileName: input.fileName,
        taskName: input.taskName,
        chipName: input.chipName
      });
      const completionStartedAtMs = Date.now();
      const response = await callResponsesApi(this.config, {
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  promptBundle.systemPrompt,
                  promptBundle.taskPrompt,
                  `器件识别：${JSON.stringify(input.identity)}`,
                  `模板：${JSON.stringify(input.parameterTemplate)}`,
                  `本地增强：${JSON.stringify({
                    complexityFlags: input.preparation.complexityFlags,
                    localCandidates: input.preparation.localCandidates.slice(0, 20),
                    pagePackets: input.preparation.pagePackets
                      .filter((page) => page.isHardPage)
                      .slice(0, 8)
                      .map((page) => ({
                        page: page.page,
                        sectionHints: page.sectionHints,
                        text: page.text
                      })),
                    publicContext: input.publicContext
                  })}`
                ].join("\n\n")
              },
              {
                type: "input_file",
                filename: input.fileName,
                file_data: buildDataUrlPdf(input.pdfBuffer)
              }
            ]
          }
        ]
      }, input.signal);
      logAnalysisEvent("provider.stage.completed", {
        stage: "synthesize_report",
        provider: "openai-compatible",
        model: this.config.model,
        modality: "pdf-inline",
        transport: "responses",
        fileName: input.fileName,
        elapsedMs: elapsedMs(completionStartedAtMs)
      });

      return normalizeReportOutput(parseResponsesText<unknown>(response), input);
    }

    const selectedPages = pickPagesForReport(input);
    const renderStartedAtMs = Date.now();
    logAnalysisEvent("provider.stage.started", {
      stage: "synthesize_report",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-pages-as-images",
      fileName: input.fileName,
      taskName: input.taskName,
      selectedPages
    });
    const images = await renderPdfPagesToImages({
      buffer: input.pdfBuffer,
      pages: selectedPages
    });
    logAnalysisEvent("provider.stage.rendered", {
      stage: "synthesize_report",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-pages-as-images",
      fileName: input.fileName,
      renderedPageCount: images.length,
      selectedPages,
      elapsedMs: elapsedMs(renderStartedAtMs)
    });
    const promptBundle = buildPromptBundle("synthesize-report", {
      templateId: input.identity.parameterTemplateId,
      fileName: input.fileName,
      taskName: input.taskName,
      chipName: input.chipName
    });
    const completionStartedAtMs = Date.now();
    const response = await callChatCompletion(this.config, {
      messages: [
        {
          role: "system",
          content: promptBundle.systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                promptBundle.taskPrompt,
                `器件识别：${JSON.stringify(input.identity)}`,
                `模板：${JSON.stringify(input.parameterTemplate)}`,
                `本地增强：${JSON.stringify({
                  complexityFlags: input.preparation.complexityFlags,
                  localCandidates: input.preparation.localCandidates.slice(0, 20),
                  pagePackets: input.preparation.pagePackets
                    .filter((page) => page.isHardPage)
                    .slice(0, 8)
                    .map((page) => ({
                      page: page.page,
                      sectionHints: page.sectionHints,
                      text: page.text
                    })),
                  publicContext: input.publicContext
                })}`
              ].join("\n\n")
            },
            ...buildImageContent(images)
          ]
        }
      ]
    }, input.signal);
    logAnalysisEvent("provider.stage.completed", {
      stage: "synthesize_report",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-pages-as-images",
      fileName: input.fileName,
      renderedPageCount: images.length,
      elapsedMs: elapsedMs(completionStartedAtMs)
    });
    const rawContent = response.choices?.[0]?.message?.content;

    try {
      return normalizeReportOutput(parseJsonFromMessage<unknown>(rawContent), input);
    } catch (error) {
      const repaired = await repairReportOutput(this.config, rawContent ?? "", input);
      return normalizeReportOutput(repaired, input);
    }
  }

  async answerFollowUp(input: {
    pdfBuffer: Uint8Array;
    fileName: string;
    taskName: string;
    chipName: string;
    preparation: ReportSynthesisInput["preparation"];
    identity: IdentityClassification;
    parameterTemplate: ReportSynthesisInput["parameterTemplate"];
    report: ReportOutput;
    keyParameters: Array<{
      name: string;
      value: string;
      evidenceId: string;
      status: "confirmed" | "needs_review" | "user_corrected";
    }>;
    publicContext: Array<{
      id: string;
      title: string;
      url: string;
      snippet: string;
      sourceType: "public";
    }>;
    question: string;
  }): Promise<FollowUpResponse> {
    if (supportsOpenAiResponsesPdf(this.config.model)) {
      logAnalysisEvent("provider.stage.started", {
        stage: "follow_up",
        provider: "openai-compatible",
        model: this.config.model,
        modality: "pdf-inline",
        transport: "responses",
        fileName: input.fileName,
        taskName: input.taskName,
        pageCount: input.preparation.documentMeta.pageCount
      });
      const promptBundle = buildPromptBundle("follow-up-answer", {
        templateId: input.identity.parameterTemplateId,
        fileName: input.fileName,
        taskName: input.taskName,
        chipName: input.chipName
      });
      const completionStartedAtMs = Date.now();
      const response = await callResponsesApi(this.config, {
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  promptBundle.systemPrompt,
                  promptBundle.taskPrompt,
                  `用户问题：${input.question}`,
                  `器件识别：${JSON.stringify(input.identity)}`,
                  `参数模板：${JSON.stringify(input.parameterTemplate)}`,
                  `当前参数表：${JSON.stringify(input.keyParameters)}`,
                  `当前报告：${JSON.stringify(input.report)}`,
                  `公网补充：${JSON.stringify(input.publicContext)}`
                ].join("\n\n")
              },
              {
                type: "input_file",
                filename: input.fileName,
                file_data: buildDataUrlPdf(input.pdfBuffer)
              }
            ]
          }
        ]
      });
      logAnalysisEvent("provider.stage.completed", {
        stage: "follow_up",
        provider: "openai-compatible",
        model: this.config.model,
        modality: "pdf-inline",
        transport: "responses",
        fileName: input.fileName,
        elapsedMs: elapsedMs(completionStartedAtMs)
      });

      const root = parseResponsesText<Record<string, unknown>>(response);
      const claims = Array.isArray(root.claims) ? normalizeReportOutput({
        executiveSummary: "",
        deviceIdentity: {
          canonicalPartNumber: input.identity.canonicalPartNumber,
          manufacturer: input.identity.manufacturer,
          deviceClass: input.identity.deviceClass,
          parameterTemplateId: input.identity.parameterTemplateId,
          confidence: input.identity.confidence
        },
        keyParameters: [],
        designFocus: [],
        risks: [],
        openQuestions: [],
        publicNotes: [],
        citations: [],
        sections: [],
        claims: root.claims as unknown as ReportClaim[]
      }, {
        pdfBuffer: input.pdfBuffer,
        fileName: input.fileName,
        taskName: input.taskName,
        chipName: input.chipName,
        preparation: input.preparation,
        identity: input.identity,
        parameterTemplate: input.parameterTemplate,
        publicContext: input.publicContext
      }).claims : [];

      return {
        answer: typeof root.answer === "string" ? root.answer.trim() : "",
        claims,
        citations: claims.flatMap((claim) => claim.citations),
        usedSources: Array.isArray(root.usedSources)
          ? root.usedSources.filter((value): value is "datasheet" | "public" | "review" => value === "datasheet" || value === "public" || value === "review")
          : ["datasheet"],
        followUpWarnings: Array.isArray(root.followUpWarnings) ? root.followUpWarnings.filter((item): item is string => typeof item === "string") : [],
        sourceAttribution: {
          mode: input.preparation.documentMeta.extractionMethod === "opendataloader" ? "llm_first_with_odl" : "llm_first"
        }
      };
    }

    const selectedPages = pickPagesForFollowUp({
      pdfBuffer: input.pdfBuffer,
      fileName: input.fileName,
      taskName: input.taskName,
      chipName: input.chipName,
      preparation: input.preparation,
      identity: input.identity,
      parameterTemplate: input.parameterTemplate,
      publicContext: input.publicContext
    });
    const renderStartedAtMs = Date.now();
    logAnalysisEvent("provider.stage.started", {
      stage: "follow_up",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-pages-as-images",
      fileName: input.fileName,
      taskName: input.taskName,
      selectedPages
    });
    const images = await renderPdfPagesToImages({
      buffer: input.pdfBuffer,
      pages: selectedPages
    });
    logAnalysisEvent("provider.stage.rendered", {
      stage: "follow_up",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-pages-as-images",
      fileName: input.fileName,
      renderedPageCount: images.length,
      selectedPages,
      elapsedMs: elapsedMs(renderStartedAtMs)
    });
    const promptBundle = buildPromptBundle("follow-up-answer", {
      templateId: input.identity.parameterTemplateId,
      fileName: input.fileName,
      taskName: input.taskName,
      chipName: input.chipName
    });
    const completionStartedAtMs = Date.now();
    const response = await callChatCompletion(this.config, {
      messages: [
        {
          role: "system",
          content: promptBundle.systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                promptBundle.taskPrompt,
                `用户问题：${input.question}`,
                `器件识别：${JSON.stringify(input.identity)}`,
                `参数模板：${JSON.stringify(input.parameterTemplate)}`,
                `当前参数表：${JSON.stringify(input.keyParameters)}`,
                `当前报告：${JSON.stringify(input.report)}`,
                `公网补充：${JSON.stringify(input.publicContext)}`
              ].join("\n\n")
            },
            ...buildImageContent(images)
          ]
        }
      ]
    });
    logAnalysisEvent("provider.stage.completed", {
      stage: "follow_up",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "pdf-pages-as-images",
      fileName: input.fileName,
      renderedPageCount: images.length,
      elapsedMs: elapsedMs(completionStartedAtMs)
    });

    const root = parseJsonFromMessage<Record<string, unknown>>(response.choices?.[0]?.message?.content);
    const claims = Array.isArray(root.claims) ? normalizeReportOutput({
      executiveSummary: "",
      deviceIdentity: {
        canonicalPartNumber: input.identity.canonicalPartNumber,
        manufacturer: input.identity.manufacturer,
        deviceClass: input.identity.deviceClass,
        parameterTemplateId: input.identity.parameterTemplateId,
        confidence: input.identity.confidence
      },
      keyParameters: [],
      designFocus: [],
      risks: [],
      openQuestions: [],
      publicNotes: [],
      citations: [],
      sections: [],
      claims: root.claims as unknown as ReportClaim[]
    }, {
      pdfBuffer: input.pdfBuffer,
      fileName: input.fileName,
      taskName: input.taskName,
      chipName: input.chipName,
      preparation: input.preparation,
      identity: input.identity,
      parameterTemplate: input.parameterTemplate,
      publicContext: input.publicContext
    }).claims : [];

    return {
      answer: typeof root.answer === "string" ? root.answer.trim() : "",
      claims,
      citations: claims.flatMap((claim) => claim.citations),
      usedSources: Array.isArray(root.usedSources)
        ? root.usedSources.filter((value): value is "datasheet" | "public" | "review" => value === "datasheet" || value === "public" || value === "review")
        : ["datasheet"],
      followUpWarnings: Array.isArray(root.followUpWarnings) ? root.followUpWarnings.filter((item): item is string => typeof item === "string") : [],
      sourceAttribution: {
        mode: input.preparation.documentMeta.extractionMethod === "opendataloader" ? "llm_first_with_odl" : "llm_first"
      }
    };
  }

  async arbitrateParameterConflict(input: ParameterArbitrationInput): Promise<ParameterArbitrationNote | null> {
    if (!supportsOpenAiResponsesPdf(this.config.model)) {
      return null;
    }

    logAnalysisEvent("provider.stage.started", {
      stage: "arbitrate_parameter_conflict",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "text-only",
      transport: "responses",
      fileName: input.fileName,
      taskName: input.taskName,
      fieldName: input.fieldName
    });

    const startedAtMs = Date.now();
    const response = await callResponsesApi(this.config, {
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "你只负责参数冲突仲裁，不重新分析整份 PDF。",
                "只返回严格 JSON：{\"fieldName\":\"\",\"recommendedValue\":\"\",\"decision\":\"prefer_fast|prefer_report|keep_both_needs_review|insufficient_evidence\",\"reason\":\"\",\"reviewSourceLabel\":\"\"}。",
                `字段名：${input.fieldName}`,
                `快参数：${JSON.stringify(input.fastDraft)}`,
                `报告参数：${JSON.stringify(input.reportDraft)}`,
                `参数模板：${JSON.stringify(input.parameterTemplate)}`
              ].join("\n\n")
            }
          ]
        }
      ]
    }, input.signal);

    logAnalysisEvent("provider.stage.completed", {
      stage: "arbitrate_parameter_conflict",
      provider: "openai-compatible",
      model: this.config.model,
      modality: "text-only",
      transport: "responses",
      fileName: input.fileName,
      fieldName: input.fieldName,
      elapsedMs: elapsedMs(startedAtMs)
    });

    return normalizeArbitrationNote(parseResponsesText<unknown>(response), input.fieldName);
  }
}

export class GeminiLlmProvider implements LlmProvider {
  constructor(private readonly config: GeminiProviderConfig) {}

  async classifyIdentity(input: IdentityClassificationInput): Promise<IdentityClassification> {
    logAnalysisEvent("provider.stage.started", {
      stage: "classify_identity",
      provider: "gemini",
      model: this.config.model,
      modality: "pdf-inline",
      fileName: input.fileName,
      taskName: input.taskName,
      pageCount: input.preparation.documentMeta.pageCount
    });
    const promptBundle = buildPromptBundle("classify-identity", {
      templateId: input.preparation.identityCandidates.sku?.toLowerCase().includes("pam") ? "cellular-3g4g5g" : "generic-fallback",
      fileName: input.fileName,
      taskName: input.taskName,
      chipName: input.chipName
    });
    const startedAtMs = Date.now();
    const response = await callGeminiGenerateContent(this.config, {
      systemInstruction: {
        parts: [{ text: promptBundle.systemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [
            buildInlinePdfPart(input.pdfBuffer),
            {
              text: [
                promptBundle.taskPrompt,
                `本地 identity 候选：${JSON.stringify(input.preparation.identityCandidates)}`,
                `本地参数候选：${JSON.stringify(input.preparation.localCandidates.slice(0, 12))}`,
                `公网补充：${JSON.stringify(input.publicContext)}`
              ].join("\n\n")
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0
      }
    }, input.signal);
    logAnalysisEvent("provider.stage.completed", {
      stage: "classify_identity",
      provider: "gemini",
      model: this.config.model,
      modality: "pdf-inline",
      fileName: input.fileName,
      elapsedMs: elapsedMs(startedAtMs)
    });

    return normalizeIdentityClassification(parseGeminiText<unknown>(response));
  }

  async synthesizeReport(input: ReportSynthesisInput): Promise<ReportOutput> {
    logAnalysisEvent("provider.stage.started", {
      stage: "synthesize_report",
      provider: "gemini",
      model: this.config.model,
      modality: "pdf-inline",
      fileName: input.fileName,
      taskName: input.taskName,
      pageCount: input.preparation.documentMeta.pageCount
    });
    const promptBundle = buildPromptBundle("synthesize-report", {
      templateId: input.identity.parameterTemplateId,
      fileName: input.fileName,
      taskName: input.taskName,
      chipName: input.chipName
    });
    const startedAtMs = Date.now();
    const response = await callGeminiGenerateContent(this.config, {
      systemInstruction: {
        parts: [{ text: promptBundle.systemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [
            buildInlinePdfPart(input.pdfBuffer),
            {
              text: [
                promptBundle.taskPrompt,
                `器件识别：${JSON.stringify(input.identity)}`,
                `模板：${JSON.stringify(input.parameterTemplate)}`,
                `本地增强：${JSON.stringify({
                  complexityFlags: input.preparation.complexityFlags,
                  localCandidates: input.preparation.localCandidates.slice(0, 20),
                  pagePackets: input.preparation.pagePackets
                    .filter((page) => page.isHardPage)
                    .slice(0, 8)
                    .map((page) => ({
                      page: page.page,
                      sectionHints: page.sectionHints,
                      text: page.text
                    })),
                  publicContext: input.publicContext
                })}`
              ].join("\n\n")
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0
      }
    }, input.signal);
    logAnalysisEvent("provider.stage.completed", {
      stage: "synthesize_report",
      provider: "gemini",
      model: this.config.model,
      modality: "pdf-inline",
      fileName: input.fileName,
      elapsedMs: elapsedMs(startedAtMs)
    });

    try {
      return normalizeReportOutput(parseGeminiText<unknown>(response), input);
    } catch {
      const rawContent = response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim() ?? "";
      const repaired = await repairReportOutput(this.config, rawContent, input);
      return normalizeReportOutput(repaired, input);
    }
  }

  async answerFollowUp(input: {
    pdfBuffer: Uint8Array;
    fileName: string;
    taskName: string;
    chipName: string;
    preparation: ReportSynthesisInput["preparation"];
    identity: IdentityClassification;
    parameterTemplate: ReportSynthesisInput["parameterTemplate"];
    report: ReportOutput;
    keyParameters: Array<{
      name: string;
      value: string;
      evidenceId: string;
      status: "confirmed" | "needs_review" | "user_corrected";
    }>;
    publicContext: Array<{
      id: string;
      title: string;
      url: string;
      snippet: string;
      sourceType: "public";
    }>;
    question: string;
  }): Promise<FollowUpResponse> {
    logAnalysisEvent("provider.stage.started", {
      stage: "follow_up",
      provider: "gemini",
      model: this.config.model,
      modality: "pdf-inline",
      fileName: input.fileName,
      taskName: input.taskName,
      pageCount: input.preparation.documentMeta.pageCount
    });
    const promptBundle = buildPromptBundle("follow-up-answer", {
      templateId: input.identity.parameterTemplateId,
      fileName: input.fileName,
      taskName: input.taskName,
      chipName: input.chipName
    });
    const startedAtMs = Date.now();
    const response = await callGeminiGenerateContent(this.config, {
      systemInstruction: {
        parts: [{ text: promptBundle.systemPrompt }]
      },
      contents: [
        {
          role: "user",
          parts: [
            buildInlinePdfPart(input.pdfBuffer),
            {
              text: [
                promptBundle.taskPrompt,
                `问题：${input.question}`,
                `器件识别：${JSON.stringify(input.identity)}`,
                `关键参数：${JSON.stringify(input.keyParameters)}`,
                `当前报告：${JSON.stringify(input.report)}`,
                `公网补充：${JSON.stringify(input.publicContext)}`
              ].join("\n\n")
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0
      }
    });
    logAnalysisEvent("provider.stage.completed", {
      stage: "follow_up",
      provider: "gemini",
      model: this.config.model,
      modality: "pdf-inline",
      fileName: input.fileName,
      elapsedMs: elapsedMs(startedAtMs)
    });

    const root = parseGeminiText<LooseObject>(response);
    const claims = Array.isArray(root.claims)
      ? normalizeReportOutput({
          deviceIdentity: {
            canonicalPartNumber: input.identity.canonicalPartNumber,
            manufacturer: input.identity.manufacturer,
            deviceClass: input.identity.deviceClass,
            parameterTemplateId: input.identity.parameterTemplateId,
            confidence: input.identity.confidence
          },
          keyParameters: [],
          designFocus: [],
          risks: [],
          openQuestions: [],
          publicNotes: [],
          citations: [],
          sections: [],
          claims: root.claims,
          executiveSummary: ""
        }, {
          pdfBuffer: input.pdfBuffer,
          fileName: input.fileName,
          taskName: input.taskName,
          chipName: input.chipName,
          preparation: input.preparation,
          identity: input.identity,
          parameterTemplate: input.parameterTemplate,
          publicContext: input.publicContext
        }).claims
      : [];

    return {
      answer: asString(root.answer) || asString(root.response) || "当前已完成基于 PDF 的后续回答。",
      claims,
      citations: claims.flatMap((claim) => claim.citations),
      usedSources: ["datasheet", ...(input.publicContext.length ? (["public"] as const) : [])],
      followUpWarnings: [],
      sourceAttribution: {
        mode: "llm_first",
        llmProvider: "gemini",
        searchProvider: null
      }
    };
  }

}
