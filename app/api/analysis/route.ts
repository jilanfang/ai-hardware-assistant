import { NextResponse } from "next/server";

import { applyParameterActionToAnalysis } from "@/lib/analysis-audit";
import { recordAuditEvent } from "@/lib/audit";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  createAnalysisJob,
  getAnalysisJob,
  getAnalysisJobDocumentMeta,
  listRecentAnalysisJobs,
  updateAnalysisJob
} from "@/lib/analysis-jobs";
import { readPdfPageCount } from "@/lib/pdf-page-count";
import { validateUploadedFile } from "@/lib/upload-validation";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "cache-control": "no-store"
};

async function readFileBuffer(file: File) {
  if (typeof file.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer());
  }

  return new Uint8Array(await new Response(file).arrayBuffer());
}

export async function GET(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({
      jobs: listRecentAnalysisJobs()
    });
  }

  const job = getAnalysisJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  const documentMeta = getAnalysisJobDocumentMeta(jobId);

  return NextResponse.json({
    ...job,
    documentMeta,
    pdfUrl: `/api/analysis/file?jobId=${encodeURIComponent(jobId)}`
  }, {
    headers: NO_STORE_HEADERS
  });
}

export async function POST(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const uploadError = validateUploadedFile(file);
  if (uploadError) {
    return NextResponse.json({ error: uploadError }, { status: 400 });
  }

  const taskName = String(formData.get("taskName") || file.name.replace(/\.pdf$/i, ""));
  const chipName = String(formData.get("chipName") || file.name.replace(/\.pdf$/i, ""));
  const buffer = await readFileBuffer(file);
  const initialPageCount = (await readPdfPageCount(buffer)) ?? 1;

  const job = createAnalysisJob({
    fileName: file.name,
    taskName,
    chipName,
    buffer,
    initialPageCount
  });

  recordAuditEvent(request, {
    userId: user.id,
    eventType: "analysis_created",
    jobId: job.jobId,
    targetType: "analysis_job",
    targetId: job.jobId,
    payload: {
      fileName: file.name,
      taskName,
      chipName,
      status: job.status
    }
  });

  return NextResponse.json({
    ...job,
    documentMeta: getAnalysisJobDocumentMeta(job.jobId),
    pdfUrl: `/api/analysis/file?jobId=${encodeURIComponent(job.jobId)}`
  });
}

export async function PATCH(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    jobId?: string;
    parameterName?: string;
    evidenceId?: string;
    action?: "confirm" | "edit";
    nextValue?: string;
  };

  if (!body.jobId || !body.parameterName || !body.evidenceId || !body.action) {
    return NextResponse.json({ error: "missing patch fields" }, { status: 400 });
  }

  const { jobId, parameterName, evidenceId, action, nextValue } = body;

  const updated = updateAnalysisJob(jobId, (snapshot) => {
    if (!snapshot.analysis) {
      return snapshot;
    }

    return {
      ...snapshot,
      analysis: applyParameterActionToAnalysis(snapshot.analysis, {
        action,
        parameterName,
        evidenceId,
        nextValue
      })
    };
  });

  if (!updated) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  recordAuditEvent(request, {
    userId: user.id,
    eventType: action === "confirm" ? "parameter_confirmed" : "parameter_corrected",
    jobId,
    targetType: "parameter",
    targetId: `${parameterName}:${evidenceId}`,
    payload: {
      parameterName,
      evidenceId,
      action,
      nextValue: nextValue ?? null
    }
  });

  return NextResponse.json({
    ...updated,
    documentMeta: getAnalysisJobDocumentMeta(jobId),
    pdfUrl: `/api/analysis/file?jobId=${encodeURIComponent(jobId)}`
  });
}
