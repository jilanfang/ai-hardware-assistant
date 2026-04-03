import { NextResponse } from "next/server";

import { getRequestIp, getRequestUserAgent, registerUser } from "@/lib/auth";
import { createAuditEvent } from "@/lib/auth-db";
import { recordSignupAttempt } from "@/lib/signup-rate-limit";
import { isSelfServiceSignupEnabled } from "@/lib/runtime-env";

async function parseRegisterPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      displayName?: string;
      inviteCode?: string;
    };

    return {
      username: body.username?.trim() ?? "",
      password: body.password ?? "",
      displayName: body.displayName?.trim() ?? "",
      inviteCode: body.inviteCode?.trim() ?? ""
    };
  }

  const formData = await request.formData();
  return {
    username: String(formData.get("username") || "").trim(),
    password: String(formData.get("password") || ""),
    displayName: String(formData.get("displayName") || "").trim(),
    inviteCode: String(formData.get("inviteCode") || "").trim()
  };
}

export async function POST(request: Request) {
  const { username, password, displayName, inviteCode } = await parseRegisterPayload(request);
  const ip = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  if (!isSelfServiceSignupEnabled()) {
    createAuditEvent({
      eventType: "register_failed",
      payload: { reason: "signup_disabled", username },
      ip,
      userAgent
    });
    return NextResponse.json({ error: "当前未开放公开注册。" }, { status: 403 });
  }

  if (!username || !password) {
    createAuditEvent({
      eventType: "register_failed",
      payload: { reason: "missing_credentials", username },
      ip,
      userAgent
    });
    return NextResponse.json({ error: "用户名和密码不能为空。" }, { status: 400 });
  }

  const rateLimit = recordSignupAttempt(ip);
  if (rateLimit.limited) {
    createAuditEvent({
      eventType: "register_failed",
      payload: { reason: "rate_limited", username },
      ip,
      userAgent
    });
    return NextResponse.json({ error: "注册过于频繁，请稍后再试。" }, { status: 429 });
  }

  const result = await registerUser({ username, password, displayName, inviteCode });

  if (!result.ok) {
    const status =
      result.reason === "username_taken" ? 409 : result.reason === "invalid_invite_code" ? 403 : 400;
    const error =
      result.reason === "username_taken"
        ? "用户名已存在。"
        : result.reason === "password_too_short"
          ? "密码至少需要 8 位。"
          : result.reason === "invalid_username"
            ? "用户名只能包含字母、数字、下划线或连字符，长度 3 到 32 位。"
            : result.reason === "invalid_invite_code"
              ? "邀请码无效。"
              : "注册失败，请稍后重试。";

    createAuditEvent({
      eventType: "register_failed",
      payload: { reason: result.reason, username },
      ip,
      userAgent
    });

    return NextResponse.json({ error }, { status });
  }

  createAuditEvent({
    userId: result.user.id,
    eventType: "register_success",
    payload: { username: result.user.username, via: "self_register" },
    ip,
    userAgent
  });

  createAuditEvent({
    userId: result.user.id,
    eventType: "login_success",
    payload: { username: result.user.username, via: "self_register" },
    ip,
    userAgent
  });

  const response = NextResponse.json({
    user: {
      id: result.user.id,
      username: result.user.username,
      displayName: result.user.displayName
    }
  });
  response.headers.set("set-cookie", result.sessionCookie);
  return response;
}
