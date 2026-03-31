import type { AnalysisJobResult, AnalysisResult, ParameterItem } from "@/lib/types";

export type BatchSummaryRow = {
  chip_name: string;
  source_file: string;
  status: string;
  template_id: string;
  canonical_part_number: string;
  manufacturer: string;
  device_class: string;
  report_key_parameter_count: number;
  final_key_parameter_count: number;
  summary: string;
};

export type BatchParameterRow = {
  chip_name: string;
  source_file: string;
  template_id: string;
  parameter_name: string;
  parameter_value: string;
  status: string;
  extracted_by: string;
  confidence: string;
  confidence_reason: string;
  source_pages: string;
  source_quote: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function flattenSummaryValue(value: unknown): string {
  if (typeof value === "string") {
    return normalizeWhitespace(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => flattenSummaryValue(entry))
      .filter(Boolean)
      .join(" | ");
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = [
      record.executiveSummary,
      record.summary,
      record.body,
      record.value,
      record.title,
      record.label,
      record.text
    ];

    for (const candidate of preferred) {
      const flattened = flattenSummaryValue(candidate);
      if (flattened) {
        return flattened;
      }
    }

    return Object.values(record)
      .map((entry) => flattenSummaryValue(entry))
      .filter(Boolean)
      .join(" | ");
  }

  return "";
}

export function pickBatchSummaryText(analysis: AnalysisResult): string {
  const candidates: unknown[] = [
    analysis.report?.executiveSummary,
    analysis.summary,
    analysis.review,
    analysis.report?.sections.slice(0, 2).map((section) => section.body)
  ];

  for (const candidate of candidates) {
    const flattened = flattenSummaryValue(candidate);
    if (flattened) {
      return flattened;
    }
  }

  return "";
}

export function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function buildBatchSummaryRow(input: {
  chipName: string;
  sourceFile: string;
  result: AnalysisJobResult;
}): BatchSummaryRow {
  const { chipName, sourceFile, result } = input;
  const identity = result.analysis.identity;
  const report = result.analysis.report;

  return {
    chip_name: chipName,
    source_file: sourceFile,
    status: result.status,
    template_id: identity?.parameterTemplateId ?? "",
    canonical_part_number: identity?.canonicalPartNumber ?? "",
    manufacturer: identity?.manufacturer ?? "",
    device_class: identity?.deviceClass ?? "",
    report_key_parameter_count: report?.keyParameters.length ?? 0,
    final_key_parameter_count: result.analysis.keyParameters.length,
    summary: pickBatchSummaryText(result.analysis)
  };
}

function buildParameterRow(input: {
  chipName: string;
  sourceFile: string;
  templateId: string;
  parameter: ParameterItem;
}): BatchParameterRow {
  const { chipName, sourceFile, templateId, parameter } = input;
  const provenance = parameter.provenance;

  return {
    chip_name: chipName,
    source_file: sourceFile,
    template_id: templateId,
    parameter_name: parameter.name,
    parameter_value: parameter.value,
    status: parameter.status,
    extracted_by: provenance?.extractedBy ?? "",
    confidence: provenance?.confidence ?? "",
    confidence_reason: provenance?.confidenceReason ?? "",
    source_pages: provenance?.sourcePages.join("|") ?? "",
    source_quote: provenance?.sourceQuote ?? ""
  };
}

export function buildBatchParameterRows(input: {
  chipName: string;
  sourceFile: string;
  result: AnalysisJobResult;
}): BatchParameterRow[] {
  const templateId = input.result.analysis.identity?.parameterTemplateId ?? "";

  return input.result.analysis.keyParameters.map((parameter) =>
    buildParameterRow({
      chipName: input.chipName,
      sourceFile: input.sourceFile,
      templateId,
      parameter
    })
  );
}

export function buildBatchSummaryCsv(rows: BatchSummaryRow[]) {
  const header = [
    "chip_name",
    "source_file",
    "status",
    "template_id",
    "canonical_part_number",
    "manufacturer",
    "device_class",
    "report_key_parameter_count",
    "final_key_parameter_count",
    "summary"
  ];

  const body = rows.map((row) =>
    [
      row.chip_name,
      row.source_file,
      row.status,
      row.template_id,
      row.canonical_part_number,
      row.manufacturer,
      row.device_class,
      row.report_key_parameter_count,
      row.final_key_parameter_count,
      row.summary
    ]
      .map(csvEscape)
      .join(",")
  );

  return [header.join(","), ...body].join("\n");
}

export function buildBatchParametersCsv(rows: BatchParameterRow[]) {
  const header = [
    "chip_name",
    "source_file",
    "template_id",
    "parameter_name",
    "parameter_value",
    "status",
    "extracted_by",
    "confidence",
    "confidence_reason",
    "source_pages",
    "source_quote"
  ];

  const body = rows.map((row) =>
    [
      row.chip_name,
      row.source_file,
      row.template_id,
      row.parameter_name,
      row.parameter_value,
      row.status,
      row.extracted_by,
      row.confidence,
      row.confidence_reason,
      row.source_pages,
      row.source_quote
    ]
      .map(csvEscape)
      .join(",")
  );

  return [header.join(","), ...body].join("\n");
}
