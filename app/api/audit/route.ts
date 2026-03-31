import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { getAuthenticatedUser } from "@/lib/auth";
import type { AuditEventType } from "@/lib/auth-db";

export async function POST(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    eventType?: AuditEventType;
    jobId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    payload?: Record<string, unknown> | null;
  };

  if (!body.eventType) {
    return NextResponse.json({ error: "missing eventType" }, { status: 400 });
  }

  recordAuditEvent(request, {
    userId: user.id,
    eventType: body.eventType,
    jobId: body.jobId ?? null,
    targetType: body.targetType ?? null,
    targetId: body.targetId ?? null,
    payload: body.payload ?? null
  });

  return NextResponse.json({ ok: true });
}
