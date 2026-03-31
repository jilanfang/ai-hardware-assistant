import { addInitialAnalysisMetadata } from "@/lib/analysis-audit";
import type { AnalysisResult, UploadedPdf } from "@/lib/types";
import { analysisSeeds } from "@/lib/seed";

function fallbackAnalysis(pdf: UploadedPdf): AnalysisResult {
  return {
    summary: `${pdf.chipName} 已完成第一轮快速阅读。当前版本使用前端本地分析链路，适合演示 chat-first、证据跳转和导出闭环。`,
    review:
      "基于当前 datasheet 的第一轮工程判断，建议优先复核绝对最大额定值、推荐工作条件和封装散热相关页码。",
    keyParameters: [
      { name: "Document pages", value: String(pdf.pageCount), evidenceId: "ev-pages", status: "confirmed" },
      { name: "Chip name", value: pdf.chipName, evidenceId: "ev-name", status: "confirmed" },
      { name: "Task", value: pdf.taskName, evidenceId: "ev-task", status: "confirmed" },
      { name: "Source file", value: pdf.fileName, evidenceId: "ev-file", status: "needs_review" }
    ],
    evidence: [
      { id: "ev-pages", label: "文档页数", page: 1, quote: `${pdf.pageCount} pages`, rect: { left: 14, top: 18, width: 34, height: 8 } },
      { id: "ev-name", label: "芯片名", page: 1, quote: pdf.chipName, rect: { left: 16, top: 28, width: 28, height: 8 } },
      { id: "ev-task", label: "任务名", page: 1, quote: pdf.taskName, rect: { left: 18, top: 40, width: 44, height: 8 } },
      { id: "ev-file", label: "源文件", page: 1, quote: pdf.fileName, rect: { left: 18, top: 52, width: 48, height: 8 } }
    ],
    events: []
  };
}

export function generateAnalysis(pdf: UploadedPdf): AnalysisResult {
  const fileKey = `${pdf.fileName} ${pdf.chipName}`.toLowerCase();
  const match = analysisSeeds.find((item) => fileKey.includes(item.match));
  if (!match) {
    return addInitialAnalysisMetadata(fallbackAnalysis(pdf), "llm");
  }

  return addInitialAnalysisMetadata(
    {
    summary: `${pdf.chipName}：${match.summary}`,
    review: match.review,
    keyParameters: [...match.keyParameters],
    evidence: [...match.evidence],
    events: []
  },
    "llm"
  );
}
