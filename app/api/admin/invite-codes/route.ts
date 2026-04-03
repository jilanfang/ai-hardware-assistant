import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth";
import { createAuditEvent } from "@/lib/auth-db";
import { isAdminUsername } from "@/lib/admin";
import { createInviteCodes, listInviteCodes } from "@/lib/invite-codes";

function requireAdmin(request: Request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!isAdminUsername(user.username)) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  const auth = requireAdmin(request);
  if (auth.error) return auth.error;

  return NextResponse.json({ inviteCodes: listInviteCodes() });
}

export async function POST(request: Request) {
  const auth = requireAdmin(request);
  if (auth.error) return auth.error;

  const inviteCodes = createInviteCodes(auth.user.username, 20);
  createAuditEvent({
    userId: auth.user.id,
    eventType: "export_json",
    payload: { action: "invite_codes_generated", count: inviteCodes.length },
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent")
  });

  return NextResponse.json({ inviteCodes });
}
