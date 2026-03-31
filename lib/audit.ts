import { createAuditEvent, type AuditEventType } from "@/lib/auth-db";
import { getAuthenticatedUser, getRequestIp, getRequestUserAgent } from "@/lib/auth";

export function recordAuditEvent(
  request: Request,
  input: {
    eventType: AuditEventType;
    userId?: string | null;
    jobId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    payload?: Record<string, unknown> | null;
    eventTime?: string;
  }
) {
  const authenticatedUser = input.userId === undefined ? getAuthenticatedUser(request) : null;
  createAuditEvent({
    userId: input.userId === undefined ? authenticatedUser?.id ?? null : input.userId ?? null,
    eventType: input.eventType,
    eventTime: input.eventTime,
    jobId: input.jobId,
    targetType: input.targetType,
    targetId: input.targetId,
    payload: input.payload,
    ip: getRequestIp(request),
    userAgent: getRequestUserAgent(request)
  });
}
