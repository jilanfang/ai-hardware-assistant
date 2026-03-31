type AnalysisLogLevel = "info" | "error";

type AnalysisLogPayload = Record<string, unknown>;

function safeJson(payload: AnalysisLogPayload) {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ message: "unserializable analysis payload" });
  }
}

export function logAnalysisEvent(event: string, payload: AnalysisLogPayload, level: AnalysisLogLevel = "info") {
  const line = `[analysis-observability] ${event} ${safeJson(payload)}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  console.info(line);
}
