import { createHash } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import Database from "better-sqlite3";

type UserStatus = "active" | "disabled";

export type AuthUserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
};

export type SessionRecord = {
  id: string;
  userId: string;
  sessionTokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
};

export type AuditEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "analysis_created"
  | "analysis_completed"
  | "analysis_failed"
  | "followup_asked"
  | "parameter_confirmed"
  | "parameter_corrected"
  | "export_json"
  | "export_html"
  | "export_csv";

type AuditEventRecord = {
  id: string;
  userId: string | null;
  eventType: AuditEventType;
  eventTime: string;
  jobId: string | null;
  targetType: string | null;
  targetId: string | null;
  payloadJson: string | null;
  ip: string | null;
  userAgent: string | null;
};

type DailyAuditSummary = {
  activeUsers: number;
  loginSuccessCount: number;
  loginFailedCount: number;
  analysisCreatedCount: number;
  analysisCompletedCount: number;
  analysisFailedCount: number;
  followupAskedCount: number;
  parameterConfirmedCount: number;
  parameterCorrectedCount: number;
  exportJsonCount: number;
  exportHtmlCount: number;
  exportCsvCount: number;
};

let database: Database.Database | null = null;
let currentDbPath: string | null = null;

function nowIso() {
  return new Date().toISOString();
}

export function resolveAuthDatabasePath() {
  return process.env.ATLAS_DB_PATH || join(process.cwd(), ".atlas", "atlas.db");
}

function ensureDatabase() {
  const dbPath = resolveAuthDatabasePath();
  if (database && currentDbPath === dbPath) {
    return database;
  }

  if (database) {
    database.close();
  }

  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      event_type TEXT NOT NULL,
      event_time TEXT NOT NULL,
      job_id TEXT,
      target_type TEXT,
      target_id TEXT,
      payload_json TEXT,
      ip TEXT,
      user_agent TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(session_token_hash);
    CREATE INDEX IF NOT EXISTS idx_audit_events_time ON audit_events(event_time);
    CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
  `);

  database = db;
  currentDbPath = dbPath;
  return db;
}

function mapUser(row: Record<string, unknown> | undefined): AuthUserRecord | null {
  if (!row) return null;
  return {
    id: String(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    displayName: String(row.display_name),
    status: String(row.status) as UserStatus,
    createdAt: String(row.created_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null
  };
}

function mapSession(row: Record<string, unknown> | undefined): SessionRecord | null {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sessionTokenHash: String(row.session_token_hash),
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    lastSeenAt: String(row.last_seen_at),
    ip: row.ip ? String(row.ip) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null
  };
}

export function createUser(input: {
  id?: string;
  username: string;
  passwordHash: string;
  displayName: string;
  status?: UserStatus;
  createdAt?: string;
  lastLoginAt?: string | null;
}) {
  const db = ensureDatabase();
  const record = {
    id: input.id ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: input.username.trim(),
    passwordHash: input.passwordHash,
    displayName: input.displayName.trim(),
    status: input.status ?? "active",
    createdAt: input.createdAt ?? nowIso(),
    lastLoginAt: input.lastLoginAt ?? null
  };

  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, status, created_at, last_login_at)
    VALUES (@id, @username, @passwordHash, @displayName, @status, @createdAt, @lastLoginAt)
  `).run(record);

  return findUserByUsername(record.username)!;
}

export function findUserByUsername(username: string) {
  const db = ensureDatabase();
  const row = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username.trim()) as Record<string, unknown> | undefined;
  return mapUser(row);
}

export function findUserById(userId: string) {
  const db = ensureDatabase();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as Record<string, unknown> | undefined;
  return mapUser(row);
}

export function updateUserLastLogin(userId: string, at = nowIso()) {
  ensureDatabase().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(at, userId);
}

export function createSession(input: {
  id?: string;
  userId: string;
  tokenHash: string;
  createdAt?: string;
  expiresAt: string;
  lastSeenAt?: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const db = ensureDatabase();
  const createdAt = input.createdAt ?? nowIso();
  const lastSeenAt = input.lastSeenAt ?? createdAt;
  const id = input.id ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  db.prepare(`
    INSERT INTO sessions (id, user_id, session_token_hash, created_at, expires_at, last_seen_at, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.userId, input.tokenHash, createdAt, input.expiresAt, lastSeenAt, input.ip ?? null, input.userAgent ?? null);

  return mapSession(
    db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Record<string, unknown> | undefined
  )!;
}

export function findSessionByToken(tokenOrHash: string) {
  const db = ensureDatabase();
  const directRow = db
    .prepare("SELECT * FROM sessions WHERE session_token_hash = ?")
    .get(tokenOrHash) as Record<string, unknown> | undefined;
  if (directRow) {
    return mapSession(directRow);
  }

  const sessionSecret = process.env.SESSION_SECRET?.trim() || "dev-session-secret";
  const hashedToken = createHash("sha256").update(`${sessionSecret}:${tokenOrHash}`).digest("hex");
  const row = db
    .prepare("SELECT * FROM sessions WHERE session_token_hash = ?")
    .get(hashedToken) as Record<string, unknown> | undefined;
  return mapSession(row);
}

export function findSessionById(sessionId: string) {
  const db = ensureDatabase();
  const row = db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as Record<string, unknown> | undefined;
  return mapSession(row);
}

export function touchSession(sessionId: string, input: { lastSeenAt?: string; expiresAt?: string }) {
  const nextLastSeenAt = input.lastSeenAt ?? nowIso();
  ensureDatabase()
    .prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?")
    .run(nextLastSeenAt, input.expiresAt ?? nextLastSeenAt, sessionId);
}

export function revokeSession(sessionId: string) {
  ensureDatabase().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function revokeSessionByTokenHash(tokenHash: string) {
  ensureDatabase().prepare("DELETE FROM sessions WHERE session_token_hash = ?").run(tokenHash);
}

export function createAuditEvent(input: {
  id?: string;
  userId?: string | null;
  eventType: AuditEventType;
  eventTime?: string;
  jobId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const db = ensureDatabase();
  const record: AuditEventRecord = {
    id: input.id ?? `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId ?? null,
    eventType: input.eventType,
    eventTime: input.eventTime ?? nowIso(),
    jobId: input.jobId ?? null,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    payloadJson: input.payload ? JSON.stringify(input.payload) : null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null
  };

  db.prepare(`
    INSERT INTO audit_events (id, user_id, event_type, event_time, job_id, target_type, target_id, payload_json, ip, user_agent)
    VALUES (@id, @userId, @eventType, @eventTime, @jobId, @targetType, @targetId, @payloadJson, @ip, @userAgent)
  `).run(record);
}

function countEvents(date: string, eventType: AuditEventType) {
  const db = ensureDatabase();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM audit_events WHERE substr(event_time, 1, 10) = ? AND event_type = ?")
    .get(date, eventType) as { count: number };
  return row.count;
}

export function getDailyAuditSummary(date: string): DailyAuditSummary {
  const db = ensureDatabase();
  const row = db
    .prepare("SELECT COUNT(DISTINCT user_id) as count FROM audit_events WHERE substr(event_time, 1, 10) = ? AND user_id IS NOT NULL")
    .get(date) as { count: number };

  return {
    activeUsers: row.count,
    loginSuccessCount: countEvents(date, "login_success"),
    loginFailedCount: countEvents(date, "login_failed"),
    analysisCreatedCount: countEvents(date, "analysis_created"),
    analysisCompletedCount: countEvents(date, "analysis_completed"),
    analysisFailedCount: countEvents(date, "analysis_failed"),
    followupAskedCount: countEvents(date, "followup_asked"),
    parameterConfirmedCount: countEvents(date, "parameter_confirmed"),
    parameterCorrectedCount: countEvents(date, "parameter_corrected"),
    exportJsonCount: countEvents(date, "export_json"),
    exportHtmlCount: countEvents(date, "export_html"),
    exportCsvCount: countEvents(date, "export_csv")
  };
}

export function resetAuthDatabase() {
  if (database) {
    database.close();
    database = null;
  }

  const dbPath = currentDbPath ?? resolveAuthDatabasePath();
  currentDbPath = null;
  rmSync(dbPath, { force: true });
}
