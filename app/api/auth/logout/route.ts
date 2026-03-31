import { NextResponse } from "next/server";

import { createClearedSessionCookieValue, getAuthenticatedUser, revokeRequestSession } from "@/lib/auth";
import { createAuditEvent } from "@/lib/auth-db";

export async function POST(request: Request) {
  const user = getAuthenticatedUser(request);
  const revoked = revokeRequestSession(request);

  if (user && revoked) {
    createAuditEvent({
      userId: user.id,
      eventType: "logout",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent")
    });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set("set-cookie", createClearedSessionCookieValue());
  return response;
}
