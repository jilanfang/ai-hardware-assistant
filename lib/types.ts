export type UploadedPdf = {
  id: string;
  taskName: string;
  chipName: string;
  fileName: string;
  pageCount: number;
  objectUrl: string;
};

export type EvidenceTarget = {
  id: string;
  label: string;
  page: number;
  quote: string;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

export type ParameterStatus = "confirmed" | "needs_review" | "user_corrected";

export type ParameterProvenance = {
  extractedBy:
    | "opendataloader"
    | "llm"
    | "gpt4o_fast_pass"
    | "gemini_report_pass"
    | "system_reconciled"
    | "system_arbitrated"
    | "user_confirmed"
    | "user_corrected";
  confidence: "high" | "review" | "user_verified";
  confidenceReason: string;
  sourcePages: number[];
  sourceQuote: string;
};

export type ParameterDraft = {
  name: string;
  value: string;
  sourceType: "datasheet" | "public" | "review";
  citations: ClaimCitation[];
  producer: string;
};

export type ArbitrationDecision =
  | "prefer_fast"
  | "prefer_report"
  | "keep_both_needs_review"
  | "insufficient_evidence";

export type ParameterArbitrationNote = {
  fieldName: string;
  decision: ArbitrationDecision;
  recommendedValue: string;
  reason: string;
  reviewSourceLabel: string;
};

export type ParameterConflict = {
  fieldName: string;
  fastValue: string;
  reportValue: string;
  fastCitations: ClaimCitation[];
  reportCitations: ClaimCitation[];
};

export type ParameterReconciliation = {
  fastPassCompleted: boolean;
  fullReportCompleted: boolean;
  conflictCount: number;
  conflicts: ParameterConflict[];
  missingFromFastPass: string[];
  missingFromReportPass: string[];
  arbitrationNotes: ParameterArbitrationNote[];
};

export type ParameterItem = {
  name: string;
  value: string;
  evidenceId: string;
  status: ParameterStatus;
  provenance?: ParameterProvenance;
};

export type AnalysisEvent = {
  id: string;
  type: "analysis_created" | "parameter_confirmed" | "parameter_corrected";
  summary: string;
  createdAt: string;
  parameterName?: string;
  evidenceId?: string;
};

export type PublicContext = {
  id: string;
  title: string;
  url: string;
  snippet: string;
  sourceType: "public";
};

export type DocumentPreparation = {
  identityCandidates: {
    sku: string | null;
    manufacturer: string | null;
    documentTitle: string | null;
    aliases: string[];
  };
  documentMeta: {
    fileName: string;
    pageCount: number;
    textCoverage: number;
    extractionMethod: "opendataloader" | "none";
  };
  pagePackets: Array<{
    page: number;
    text: string;
    sectionHints: string[];
    isHardPage: boolean;
  }>;
  localCandidates: Array<{
    name: string;
    value: string;
    page: number;
    quote: string;
    confidence: number;
  }>;
  complexityFlags: {
    twoColumn: boolean;
    tableHeavy: boolean;
    imageHeavy: boolean;
    watermarkHeavy: boolean;
    crossPageTableLikely: boolean;
    lowTextReliability: boolean;
  };
};

export type IdentityClassification = {
  canonicalPartNumber: string;
  manufacturer: string;
  deviceClass: string;
  parameterTemplateId: string;
  focusChecklist: string[];
  publicContext: PublicContext[];
  confidence: number;
};

export type ParameterTemplate = {
  id: string;
  label: string;
  deviceClass: string;
  focusAreas: string[];
  fields: Array<{
    name: string;
    description: string;
  }>;
};

export type ClaimCitation = {
  id: string;
  sourceType: "datasheet" | "public";
  page?: number;
  quote?: string;
  url?: string;
  title?: string;
  snippet?: string;
};

export type ReportClaim = {
  id: string;
  label: string;
  value?: string;
  title?: string;
  body?: string;
  sourceType: "datasheet" | "public" | "review";
  citations: ClaimCitation[];
};

export type ReportOutput = {
  executiveSummary: string;
  deviceIdentity: {
    canonicalPartNumber: string;
    manufacturer: string;
    deviceClass: string;
    parameterTemplateId: string;
    confidence: number;
  };
  keyParameters: ReportClaim[];
  designFocus: ReportClaim[];
  risks: ReportClaim[];
  openQuestions: ReportClaim[];
  publicNotes: ReportClaim[];
  citations: ClaimCitation[];
  sections: Array<{
    id: string;
    title: string;
    body: string;
    sourceType: "datasheet" | "public" | "review";
    citations: ClaimCitation[];
  }>;
  claims: ReportClaim[];
};

export type FollowUpResponse = {
  messageId?: string;
  createdAt?: string;
  answer: string;
  claims: ReportClaim[];
  citations: ClaimCitation[];
  usedSources: Array<"datasheet" | "public" | "review">;
  followUpWarnings: string[];
  sourceAttribution?: SourceAttribution | null;
};

export type FollowUpMessage = {
  id: string;
  question: string;
  answer: string;
  claims: ReportClaim[];
  citations: ClaimCitation[];
  warnings: string[];
  usedSources: Array<"datasheet" | "public" | "review">;
  sourceAttribution?: SourceAttribution | null;
  createdAt: string;
};

export type SourceAttribution = {
  mode: "llm_first" | "llm_first_with_odl" | "failed";
  llmProvider?: string | null;
  llmTarget?: string | null;
  searchProvider?: string | null;
  documentPath?: "pdf_direct" | "image_fallback" | "unknown";
  pipelineMode?: "single" | "staged" | null;
};

export type AnalysisResult = {
  summary: string;
  review: string;
  pipelineMode?: "single" | "staged" | null;
  keyParameters: ParameterItem[];
  evidence: EvidenceTarget[];
  events?: AnalysisEvent[];
  identity?: IdentityClassification | null;
  report?: ReportOutput | null;
  preparationMeta?: {
    pageCount: number;
    textCoverage: number;
    extractionMethod: "opendataloader" | "none";
    localCandidateCount: number;
    complexityFlags: DocumentPreparation["complexityFlags"];
  } | null;
  parameterReconciliation?: ParameterReconciliation | null;
  fastParametersReadyAt?: string | null;
  fullReportReadyAt?: string | null;
  sourceAttribution?: SourceAttribution | null;
};

export type AnalysisStatus = "processing" | "complete" | "partial" | "failed";

export type AnalysisJobResult = {
  status: AnalysisStatus;
  warnings: string[];
  analysis: AnalysisResult;
};

export type AnalysisJobSnapshot = {
  jobId: string;
  status: AnalysisStatus;
  warnings: string[];
  analysis?: AnalysisResult;
  followUpMessages: FollowUpMessage[];
  updatedAt: string;
  documentMeta?: AnalysisJobDocumentMeta | null;
  pdfUrl?: string;
};

export type AnalysisJobDocumentMeta = {
  fileName: string;
  taskName: string;
  chipName: string;
  pageCount: number;
};

export type RecentAnalysisJob = {
  jobId: string;
  status: AnalysisStatus;
  updatedAt: string;
  documentMeta: AnalysisJobDocumentMeta | null;
  hasAnalysis: boolean;
  followUpCount: number;
};

export type AnalysisDocumentViewModel = {
  taskMeta: {
    taskName: string;
    chipName: string;
    sourceFile: string;
    pageCount: number;
  };
  identity: AnalysisResult["identity"] | null;
  executiveSummary: string;
  reportSections: NonNullable<AnalysisResult["report"]>["sections"];
  parameterRows: Array<{
    name: string;
    value: string;
    status: ParameterStatus;
    statusLabel: string;
    evidence: {
      label: string;
      page: number;
      quote: string;
    } | null;
  }>;
  publicNotes: ReportClaim[];
  followUpTranscript: FollowUpMessage[];
  sourceAttribution: AnalysisResult["sourceAttribution"] | null;
  events: AnalysisEvent[];
};

export type CorrectionEvent = {
  id: string;
  parameterName: string;
  evidenceId: string;
  previousValue: string;
  correctedValue: string;
  action: "confirm" | "edit";
  createdAt: string;
};

export type ExportArtifact = {
  fileName: string;
  mimeType: string;
  content: string;
};
