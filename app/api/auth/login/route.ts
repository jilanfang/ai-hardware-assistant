import { NextResponse } from "next/server";

import { authenticateUser, getRequestIp, getRequestUserAgent } from "@/lib/auth";
import { createAuditEvent } from "@/lib/auth-db";

async function parseLoginPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      returnTo?: string;
    };

    return {
      username: body.username?.trim() ?? "",
      password: body.password ?? "",
      returnTo: body.returnTo?.trim() || "/"
    };
  }

  const formData = await request.formData();
  return {
    username: String(formData.get("username") || "").trim(),
    password: String(formData.get("password") || ""),
    returnTo: String(formData.get("returnTo") || "/").trim() || "/"
  };
}

export async function POST(request: Request) {
  const { username, password, returnTo } = await parseLoginPayload(request);
  const isJsonRequest = (request.headers.get("content-type") ?? "").includes("application/json");
  const ip = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

  if (!username || !password) {
    if (isJsonRequest) {
      return NextResponse.json({ error: "用户名和密码不能为空。" }, { status: 400 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("returnTo", returnTo || "/");
    return NextResponse.redirect(loginUrl);
  }

  const result = await authenticateUser(username, password);
  if (!result.ok) {
    createAuditEvent({
      userId: result.reason === "disabled" ? result.user.id : null,
      eventType: "login_failed",
      payload: { username, reason: result.reason },
      ip,
      userAgent
    });

    if (result.reason === "disabled") {
      return NextResponse.json({ error: "该账号已停用。" }, { status: 403 });
    }

    if (isJsonRequest) {
      return NextResponse.json({ error: "用户名或密码错误。" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("returnTo", returnTo || "/");
    return NextResponse.redirect(loginUrl);
  }

  createAuditEvent({
    userId: result.user.id,
    eventType: "login_success",
    payload: { username: result.user.username },
    ip,
    userAgent
  });

  if (isJsonRequest) {
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

  const response = NextResponse.redirect(new URL(returnTo || "/", request.url));
  response.headers.set("set-cookie", result.sessionCookie);
  return response;
}
