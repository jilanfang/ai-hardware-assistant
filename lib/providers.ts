import type {
  DocumentPreparation,
  FollowUpResponse,
  IdentityClassification,
  ParameterArbitrationNote,
  ParameterDraft,
  ParameterTemplate,
  PublicContext,
  ReportOutput
} from "@/lib/types";
import { MockLlmProvider, MockSearchProvider } from "@/lib/mock-providers";
import { GeminiLlmProvider, OpenAiLlmProvider } from "@/lib/real-provider";

export type IdentityClassificationInput = {
  pdfBuffer: Uint8Array;
  fileName: string;
  taskName: string;
  chipName: string;
  preparation: DocumentPreparation;
  publicContext: PublicContext[];
  signal?: AbortSignal;
};

export type ReportSynthesisInput = {
  pdfBuffer: Uint8Array;
  fileName: string;
  taskName: string;
  chipName: string;
  preparation: DocumentPreparation;
  identity: IdentityClassification;
  parameterTemplate: ParameterTemplate;
  publicContext: PublicContext[];
  signal?: AbortSignal;
};

export type ParameterExtractionInput = {
  pdfBuffer: Uint8Array;
  fileName: string;
  taskName: string;
  chipName: string;
  preparation: DocumentPreparation;
  identity: IdentityClassification;
  parameterTemplate: ParameterTemplate;
  publicContext: PublicContext[];
  signal?: AbortSignal;
};

export type ParameterArbitrationInput = {
  fileName: string;
  taskName: string;
  chipName: string;
  preparation: DocumentPreparation;
  identity: IdentityClassification;
  parameterTemplate: ParameterTemplate;
  fieldName: string;
  fastDraft: ParameterDraft | null;
  reportDraft: ParameterDraft | null;
  signal?: AbortSignal;
};

export type LlmProvider = {
  classifyIdentity(input: IdentityClassificationInput): Promise<IdentityClassification>;
  extractKeyParameters?(input: ParameterExtractionInput): Promise<ParameterDraft[]>;
  synthesizeReport(input: ReportSynthesisInput): Promise<ReportOutput>;
  arbitrateParameterConflict?(input: ParameterArbitrationInput): Promise<ParameterArbitrationNote | null>;
  answerFollowUp(input: {
    pdfBuffer: Uint8Array;
    fileName: string;
    taskName: string;
    chipName: string;
    preparation: DocumentPreparation;
    identity: IdentityClassification;
    parameterTemplate: ParameterTemplate;
    report: ReportOutput;
    keyParameters: Array<{
      name: string;
      value: string;
      evidenceId: string;
      status: "confirmed" | "needs_review" | "user_corrected";
    }>;
    publicContext: PublicContext[];
    question: string;
  }): Promise<FollowUpResponse>;
};

export type SearchProvider = {
  searchPartContext(input: {
    sku: string | null;
    manufacturer: string | null;
  }): Promise<PublicContext[]>;
};

export type AnalysisProviderSuite = {
  identityProvider: LlmProvider;
  fastParameterProvider: LlmProvider;
  reportProvider: LlmProvider;
  arbitrationProvider: LlmProvider | null;
  followUpProvider: LlmProvider;
};

export type AnalysisPipelineMode = "single" | "staged";

type ProviderSelection = {
  llmProvider: LlmProvider | null;
  analysisSuite: AnalysisProviderSuite | null;
  pipelineMode: AnalysisPipelineMode;
  searchProvider: SearchProvider | null;
  llmProviderName: string | null;
  llmModelName: string | null;
  searchProviderName: string | null;
};

const MODEL_PROFILE_MAP = {
  default: "gemini-3-flash-preview",
  premium: "gemini-3.1-pro-preview",
  cn: "kimi-k2.5",
  budget: "qwen3.5-flash"
} as const;

function resolveConfiguredModelName() {
  const explicitModel = process.env.ANALYSIS_LLM_MODEL?.trim();
  if (explicitModel) {
    return explicitModel;
  }

  const profile = process.env.ANALYSIS_LLM_PROFILE?.trim() as keyof typeof MODEL_PROFILE_MAP | undefined;
  if (profile && profile in MODEL_PROFILE_MAP) {
    return MODEL_PROFILE_MAP[profile];
  }

  return MODEL_PROFILE_MAP.default;
}

function resolveConfiguredModelNameFrom(explicitModel?: string | null, profileName?: string | null) {
  if (explicitModel?.trim()) {
    return explicitModel.trim();
  }

  const profile = profileName?.trim() as keyof typeof MODEL_PROFILE_MAP | undefined;
  if (profile && profile in MODEL_PROFILE_MAP) {
    return MODEL_PROFILE_MAP[profile];
  }

  return MODEL_PROFILE_MAP.default;
}

function isRuntimeLlmProvider(providerName: string | null) {
  return providerName === "openai" || providerName === "gemini" || Boolean(providerName && resolveRelayConfig(providerName));
}

type ProviderRuntimeConfig = {
  providerName: string | null;
  modelName: string | null;
  baseUrl?: string;
  apiKey?: string;
};

function resolveRelayConfig(providerName: string) {
  const normalized = providerName.trim().toLowerCase();

  if (normalized === "lyapi") {
    return {
      protocolProvider: "gemini",
      apiKey: process.env.LYAPI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "",
      baseUrl: process.env.LYAPI_BASE_URL?.trim() || process.env.OPENAI_BASE_URL?.trim() || "https://lyapi.com"
    };
  }

  if (normalized === "vectorengine") {
    return {
      protocolProvider: "gemini",
      apiKey: process.env.VECTORENGINE_API_KEY?.trim() || "",
      baseUrl: process.env.VECTORENGINE_BASE_URL?.trim() || "https://api.vectorengine.ai"
    };
  }

  return null;
}

function prefersGeminiTransport(modelName: string | null) {
  if (!modelName) {
    return false;
  }

  return modelName.trim().toLowerCase().startsWith("gemini-");
}

function instantiateLlmProvider(config: ProviderRuntimeConfig): LlmProvider | null {
  if (!config.providerName) {
    return null;
  }

  if (config.providerName === "mock" || config.providerName === "default") {
    return new MockLlmProvider();
  }

  const relay = resolveRelayConfig(config.providerName);
  if (relay) {
    if (prefersGeminiTransport(config.modelName)) {
      return new GeminiLlmProvider({
        apiKey: config.apiKey?.trim() || relay.apiKey,
        model: config.modelName ?? MODEL_PROFILE_MAP.default,
        baseUrl: config.baseUrl?.trim() || relay.baseUrl
      });
    }

    return new OpenAiLlmProvider({
      apiKey: config.apiKey?.trim() || relay.apiKey,
      model: config.modelName ?? MODEL_PROFILE_MAP.default,
      baseUrl: config.baseUrl?.trim() || relay.baseUrl
    });
  }

  if (config.providerName === "gemini") {
    return new GeminiLlmProvider({
      apiKey: config.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "",
      model: config.modelName ?? MODEL_PROFILE_MAP.default,
      baseUrl: config.baseUrl?.trim() || process.env.GEMINI_BASE_URL?.trim() || process.env.OPENAI_BASE_URL?.trim() || undefined
    });
  }

  if (config.providerName === "openai") {
    return new OpenAiLlmProvider({
      apiKey: config.apiKey?.trim() || process.env.OPENAI_API_KEY?.trim() || "",
      model: config.modelName ?? MODEL_PROFILE_MAP.default,
      baseUrl: config.baseUrl?.trim() || process.env.OPENAI_BASE_URL?.trim() || undefined
    });
  }

  return null;
}

function hasStageSpecificProviderConfig() {
  return [
    "ANALYSIS_IDENTITY_LLM_PROVIDER",
    "ANALYSIS_IDENTITY_LLM_MODEL",
    "ANALYSIS_FAST_LLM_PROVIDER",
    "ANALYSIS_FAST_LLM_MODEL",
    "ANALYSIS_REPORT_LLM_PROVIDER",
    "ANALYSIS_REPORT_LLM_MODEL",
    "ANALYSIS_ARBITRATION_LLM_PROVIDER",
    "ANALYSIS_ARBITRATION_LLM_MODEL",
    "ANALYSIS_FOLLOW_UP_LLM_PROVIDER",
    "ANALYSIS_FOLLOW_UP_LLM_MODEL"
  ].some((name) => Boolean(process.env[name]?.trim()));
}

function resolveAnalysisPipelineMode(): AnalysisPipelineMode {
  return process.env.ANALYSIS_PIPELINE_MODE?.trim().toLowerCase() === "staged" ? "staged" : "single";
}

function resolveStageConfig(stage: "identity" | "fast" | "report" | "arbitration" | "follow_up", fallbackProviderName: string | null) {
  const prefix =
    stage === "follow_up" ? "ANALYSIS_FOLLOW_UP_LLM" : `ANALYSIS_${stage.toUpperCase()}_LLM`;

  const providerName = process.env[`${prefix}_PROVIDER`]?.trim() || fallbackProviderName;
  const explicitModel = process.env[`${prefix}_MODEL`]?.trim() || null;
  const explicitProfile = process.env[`${prefix}_PROFILE`]?.trim() || process.env.ANALYSIS_LLM_PROFILE?.trim() || null;

  return {
    providerName,
    modelName:
      isRuntimeLlmProvider(providerName)
        ? resolveConfiguredModelNameFrom(explicitModel, explicitProfile)
        : null,
    baseUrl: process.env[`${prefix}_BASE_URL`]?.trim() || undefined,
    apiKey: process.env[`${prefix}_API_KEY`]?.trim() || undefined
  } satisfies ProviderRuntimeConfig;
}

class CompositeLlmProvider implements LlmProvider {
  constructor(private readonly suite: AnalysisProviderSuite) {}

  classifyIdentity(input: IdentityClassificationInput): Promise<IdentityClassification> {
    return this.suite.identityProvider.classifyIdentity(input);
  }

  async extractKeyParameters(input: ParameterExtractionInput): Promise<ParameterDraft[]> {
    return (await this.suite.fastParameterProvider.extractKeyParameters?.(input)) ?? [];
  }

  synthesizeReport(input: ReportSynthesisInput): Promise<ReportOutput> {
    return this.suite.reportProvider.synthesizeReport(input);
  }

  async arbitrateParameterConflict(input: ParameterArbitrationInput): Promise<ParameterArbitrationNote | null> {
    return (await this.suite.arbitrationProvider?.arbitrateParameterConflict?.(input)) ?? null;
  }

  answerFollowUp(input: {
    pdfBuffer: Uint8Array;
    fileName: string;
    taskName: string;
    chipName: string;
    preparation: DocumentPreparation;
    identity: IdentityClassification;
    parameterTemplate: ParameterTemplate;
    report: ReportOutput;
    keyParameters: Array<{
      name: string;
      value: string;
      evidenceId: string;
      status: "confirmed" | "needs_review" | "user_corrected";
    }>;
    publicContext: PublicContext[];
    question: string;
  }): Promise<FollowUpResponse> {
    return this.suite.followUpProvider.answerFollowUp(input);
  }
}

export function resolveConfiguredProviders(): ProviderSelection {
  const pipelineMode = resolveAnalysisPipelineMode();
  const llmProviderName = process.env.ANALYSIS_LLM_PROVIDER?.trim() || null;
  const searchProviderName = process.env.ANALYSIS_SEARCH_PROVIDER?.trim() || null;
  const stageSpecificConfigured = pipelineMode === "staged" && hasStageSpecificProviderConfig();
  const llmModelName =
    isRuntimeLlmProvider(llmProviderName)
      ? resolveConfiguredModelName()
      : null;
  const llmProvider = instantiateLlmProvider({
    providerName: llmProviderName,
    modelName: llmModelName
  });
  const searchProvider =
    searchProviderName === "mock" || searchProviderName === "default" ? new MockSearchProvider() : null;

  const analysisSuite = (() => {
    if (!stageSpecificConfigured) {
      return llmProvider
        ? {
            identityProvider: llmProvider,
            fastParameterProvider: llmProvider,
            reportProvider: llmProvider,
            arbitrationProvider: llmProvider,
            followUpProvider: llmProvider
          }
        : null;
    }

    const identityProvider = instantiateLlmProvider(resolveStageConfig("identity", llmProviderName))
      ?? instantiateLlmProvider(resolveStageConfig("report", llmProviderName));
    const fastParameterProvider = instantiateLlmProvider(resolveStageConfig("fast", llmProviderName));
    const reportProvider = instantiateLlmProvider(resolveStageConfig("report", llmProviderName));
    const followUpProvider = instantiateLlmProvider(resolveStageConfig("follow_up", llmProviderName)) ?? reportProvider;
    const arbitrationProvider = instantiateLlmProvider(resolveStageConfig("arbitration", llmProviderName));

    if (!identityProvider || !fastParameterProvider || !reportProvider || !followUpProvider) {
      return null;
    }

    return {
      identityProvider,
      fastParameterProvider,
      reportProvider,
      arbitrationProvider,
      followUpProvider
    } satisfies AnalysisProviderSuite;
  })();

  return {
    pipelineMode,
    llmProvider: stageSpecificConfigured && analysisSuite ? new CompositeLlmProvider(analysisSuite) : llmProvider,
    analysisSuite,
    searchProvider,
    llmProviderName: analysisSuite && stageSpecificConfigured ? "composite" : llmProviderName,
    llmModelName: analysisSuite && stageSpecificConfigured
      ? resolveStageConfig("report", llmProviderName).modelName
      : llmModelName,
    searchProviderName
  };
}
