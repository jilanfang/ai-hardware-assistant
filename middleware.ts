import { NextResponse } from "next/server";
import { resolveSessionCookieName } from "@/lib/runtime-env";

function hasSessionCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${resolveSessionCookieName()}=`));
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/healthz" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/auth/")
  );
}

function isProtectedApiPath(pathname: string) {
  return pathname === "/api/audit" || pathname === "/api/analysis" || pathname.startsWith("/api/analysis/");
}

export function middleware(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname === "/login" && request.method === "POST") {
    return NextResponse.rewrite(new URL("/api/auth/login", request.url));
  }

  if (pathname === "/logout" && request.method === "POST") {
    return NextResponse.rewrite(new URL("/api/auth/logout", request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    if (isProtectedApiPath(pathname)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", `${pathname}${url.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
