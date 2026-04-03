import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth";
import { getAnalysisJobPdf } from "@/lib/analysis-jobs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "missing jobId" }, { status: 400 });
  }

  const pdfBuffer = getAnalysisJobPdf(jobId);
  if (!pdfBuffer) {
    return NextResponse.json({ error: "pdf payload not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(pdfBuffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${encodeURIComponent(jobId)}.pdf"`,
      "cache-control": "private, max-age=60"
    }
  });
}
