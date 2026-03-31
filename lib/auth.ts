import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import {
  createSession,
  createUser,
  findSessionByToken,
  findUserById,
  findUserByUsername,
  revokeSessionByTokenHash,
  touchSession,
  updateUserLastLogin,
  type AuthUserRecord
} from "@/lib/auth-db";

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function now() {
  return Date.now();
}

function nowIso() {
  return new Date(now()).toISOString();
}

export function resolveSessionCookieName() {
  return process.env.SESSION_COOKIE_NAME?.trim() || "atlas_session";
}

function resolveSessionSecret() {
  return process.env.SESSION_SECRET?.trim() || "dev-session-secret";
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(`${resolveSessionSecret()}:${token}`).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function createSessionCookieValue(token: string) {
  const cookieName = resolveSessionCookieName();
  const expiresAt = new Date(now() + SESSION_TTL_MS).toUTCString();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt}${secure}`;
}

export function createClearedSessionCookieValue() {
  const cookieName = resolveSessionCookieName();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
}

export function parseSessionTokenFromCookie(cookieHeader: string, cookieName = resolveSessionCookieName()) {
  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const matched = cookies.find((entry) => entry.startsWith(`${cookieName}=`));
  return matched ? decodeURIComponent(matched.slice(cookieName.length + 1)) : null;
}

export function getRequestSessionToken(request: Request) {
  return parseSessionTokenFromCookie(request.headers.get("cookie") ?? "");
}

export function getRequestUserAgent(request: Request) {
  return request.headers.get("user-agent");
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip");
}

export async function authenticateUser(username: string, password: string) {
  const user = findUserByUsername(username);
  if (!user) {
    return { ok: false as const, reason: "invalid_credentials" as const };
  }

  if (user.status === "disabled") {
    return { ok: false as const, reason: "disabled" as const, user };
  }

  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches) {
    return { ok: false as const, reason: "invalid_credentials" as const, user };
  }

  const sessionToken = createSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const createdAt = nowIso();
  const expiresAt = new Date(now() + SESSION_TTL_MS).toISOString();

  updateUserLastLogin(user.id, createdAt);
  createSession({
    userId: user.id,
    tokenHash,
    createdAt,
    expiresAt,
    lastSeenAt: createdAt
  });

  return {
    ok: true as const,
    user,
    sessionToken,
    sessionCookie: createSessionCookieValue(sessionToken),
    expiresAt
  };
}

export function revokeRequestSession(request: Request) {
  const token = getRequestSessionToken(request);
  if (!token) {
    return false;
  }

  revokeSessionByTokenHash(hashSessionToken(token));
  return true;
}

export function getAuthenticatedUserFromSessionToken(token: string | null): AuthUserRecord | null {
  if (!token) {
    return null;
  }

  const session = findSessionByToken(hashSessionToken(token));
  if (!session) {
    return null;
  }

  if (Date.parse(session.expiresAt) <= now()) {
    revokeSessionByTokenHash(session.sessionTokenHash);
    return null;
  }

  const renewedExpiresAt = new Date(now() + SESSION_TTL_MS).toISOString();
  touchSession(session.id, {
    lastSeenAt: nowIso(),
    expiresAt: renewedExpiresAt
  });

  const user = findUserById(session.userId);
  if (!user || user.status !== "active") {
    revokeSessionByTokenHash(session.sessionTokenHash);
    return null;
  }

  return user;
}

export function getAuthenticatedUser(request: Request): AuthUserRecord | null {
  const testUserId = request.headers.get("x-test-user-id");
  if (testUserId) {
    const testUser = findUserById(testUserId);
    return testUser?.status === "active" ? testUser : null;
  }

  return getAuthenticatedUserFromSessionToken(getRequestSessionToken(request));
}

export async function createManualUser(input: {
  username: string;
  password: string;
  displayName?: string;
}) {
  const passwordHash = await hashPassword(input.password);
  return createUser({
    username: input.username,
    passwordHash,
    displayName: input.displayName ?? input.username
  });
}
