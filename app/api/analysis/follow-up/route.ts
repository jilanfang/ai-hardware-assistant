import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { recordAuditEvent } from "@/lib/audit";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  appendAnalysisJobFollowUpMessage,
  getAnalysisJob,
  getAnalysisJobDocumentMeta,
  getAnalysisJobPdf
} from "@/lib/analysis-jobs";
import { answerAnalysisFollowUp } from "@/lib/server-analysis";

export const runtime = "nodejs";
const SAFE_FOLLOW_UP_ERROR = "follow-up temporarily unavailable";

export async function POST(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    jobId?: string;
    question?: string;
  };

  if (!body.jobId || !body.question?.trim()) {
    return NextResponse.json({ error: "missing follow-up fields" }, { status: 400 });
  }

  const snapshot = getAnalysisJob(body.jobId);
  if (!snapshot?.analysis) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  if (!snapshot.analysis.report || snapshot.analysis.parameterReconciliation?.fullReportCompleted === false) {
    return NextResponse.json({ error: "full report not ready" }, { status: 409 });
  }

  const pdfBuffer = getAnalysisJobPdf(body.jobId);
  if (!pdfBuffer) {
    return NextResponse.json({ error: "pdf payload not found" }, { status: 404 });
  }
  const meta = getAnalysisJobDocumentMeta(body.jobId);

  try {
    const result = await answerAnalysisFollowUp({
      pdfBuffer,
      fileName: meta?.fileName ?? `${snapshot.analysis.identity?.canonicalPartNumber ?? "document"}.pdf`,
      taskName: meta?.taskName ?? snapshot.analysis.summary ?? "follow-up",
      chipName: meta?.chipName ?? snapshot.analysis.identity?.canonicalPartNumber ?? "Unknown",
      question: body.question.trim(),
      analysis: snapshot.analysis
    });

    const messageId = randomUUID();
    const createdAt = new Date().toISOString();
    appendAnalysisJobFollowUpMessage(body.jobId, {
      id: messageId,
      question: body.question.trim(),
      answer: result.answer,
      claims: result.claims,
      citations: result.citations,
      warnings: result.followUpWarnings,
      usedSources: result.usedSources,
      sourceAttribution: result.sourceAttribution ?? null,
      createdAt
    });

    recordAuditEvent(request, {
      userId: user.id,
      eventType: "followup_asked",
      jobId: body.jobId,
      targetType: "followup",
      targetId: messageId,
      payload: {
        question: body.question.trim().slice(0, 240),
        usedSources: result.usedSources
      }
    });

    return NextResponse.json({
      messageId,
      createdAt,
      answer: result.answer,
      claims: result.claims,
      citations: result.citations,
      warnings: result.followUpWarnings,
      usedSources: result.usedSources,
      sourceAttribution: result.sourceAttribution ?? null
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && (error.message === "job not found" || error.message === "full report not ready")
            ? error.message
            : SAFE_FOLLOW_UP_ERROR
      },
      { status: 500 }
    );
  }
}
