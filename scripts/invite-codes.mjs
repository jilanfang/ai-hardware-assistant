import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

import Database from "better-sqlite3";

const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function resolveDatabasePath() {
  return process.env.ATLAS_DB_PATH || join(process.cwd(), ".atlas", "atlas.db");
}

function ensureDatabase() {
  const dbPath = resolveDatabasePath();
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT,
      used_at TEXT,
      used_by_user_id TEXT
    );
  `);
  return db;
}

function nowIso() {
  return new Date().toISOString();
}

function randomChunk(length) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (value) => INVITE_ALPHABET[value % INVITE_ALPHABET.length]).join("");
}

function generateInviteCode() {
  return `ATLAS-${randomChunk(4)}-${randomChunk(4)}`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const part = rest[index];
    if (!part.startsWith("--")) continue;

    const key = part.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, options };
}

function createInviteCodes(db, { count, createdBy }) {
  const codes = [];

  while (codes.length < count) {
    const code = generateInviteCode();
    const exists = db.prepare("SELECT 1 FROM invite_codes WHERE code = ?").get(code);
    if (exists) continue;

    const row = {
      id: `invite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code,
      status: "active",
      createdAt: nowIso(),
      createdBy: createdBy ?? null
    };

    db.prepare(`
      INSERT INTO invite_codes (id, code, status, created_at, created_by, used_at, used_by_user_id)
      VALUES (@id, @code, @status, @createdAt, @createdBy, NULL, NULL)
    `).run(row);

    codes.push(row);
  }

  return codes;
}

function printCsv(rows) {
  const header = "code,status,created_by";
  const lines = rows.map((row) => [row.code, row.status, row.createdBy ?? ""].join(","));
  process.stdout.write(`${[header, ...lines].join("\n")}\n`);
}

function run() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const db = ensureDatabase();

  try {
    if (command !== "generate") {
      throw new Error("usage: node scripts/invite-codes.mjs generate [--count 20] [--created-by atlas01]");
    }

    const count = Number.parseInt(options.count ?? "20", 10);
    if (!Number.isFinite(count) || count <= 0) {
      throw new Error("count must be a positive integer");
    }

    const rows = createInviteCodes(db, {
      count,
      createdBy: options["created-by"]?.trim() || null
    });
    printCsv(rows);
  } finally {
    db.close();
  }
}

run();
