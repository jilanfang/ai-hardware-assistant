import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

function resolveDatabasePath() {
  return process.env.ATLAS_DB_PATH || join(process.cwd(), ".atlas", "atlas.db");
}

function ensureDatabase() {
  const dbPath = resolveDatabasePath();
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
  `);
  return db;
}

function nowIso() {
  return new Date().toISOString();
}

function randomPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const part = rest[index];
    if (!part.startsWith("--")) {
      continue;
    }

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

async function insertUser(db, { username, displayName, password }) {
  const normalizedUsername = username.trim();
  const normalizedDisplayName = (displayName || normalizedUsername).trim();
  const createdAt = nowIso();
  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, status, created_at, last_login_at)
    VALUES (?, ?, ?, ?, 'active', ?, NULL)
  `).run(id, normalizedUsername, passwordHash, normalizedDisplayName, createdAt);

  return {
    username: normalizedUsername,
    password,
    displayName: normalizedDisplayName,
    status: "active"
  };
}

function printCsv(rows) {
  const header = "username,password,display_name,status";
  const lines = rows.map((row) => [row.username, row.password, row.displayName, row.status].join(","));
  process.stdout.write(`${[header, ...lines].join("\n")}\n`);
}

async function run() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const db = ensureDatabase();

  try {
    if (command === "create") {
      const username = options.username?.trim();
      if (!username) {
        throw new Error("missing --username");
      }

      const row = await insertUser(db, {
        username,
        displayName: options["display-name"],
        password: options.password?.trim() || randomPassword()
      });
      printCsv([row]);
      return;
    }

    if (command === "import") {
      const inputPath = options.input?.trim();
      if (!inputPath) {
        throw new Error("missing --input");
      }

      const usernames = readFileSync(inputPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const rows = [];
      for (const username of usernames) {
        rows.push(
          await insertUser(db, {
            username,
            password: randomPassword()
          })
        );
      }

      printCsv(rows);
      return;
    }

    throw new Error("usage: node scripts/admin-users.mjs <create|import> [options]");
  } finally {
    db.close();
  }
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
