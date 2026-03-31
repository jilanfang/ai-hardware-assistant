import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

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
  `);
  return db;
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith("--")) {
      continue;
    }

    const key = part.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function countEvents(db, date, eventType) {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM audit_events WHERE substr(event_time, 1, 10) = ? AND event_type = ?")
    .get(date, eventType);
  return row.count;
}

function getDailyAuditSummary(db, date) {
  const activeUsersRow = db
    .prepare("SELECT COUNT(DISTINCT user_id) as count FROM audit_events WHERE substr(event_time, 1, 10) = ? AND user_id IS NOT NULL")
    .get(date);

  return {
    activeUsers: activeUsersRow.count,
    loginSuccessCount: countEvents(db, date, "login_success"),
    loginFailedCount: countEvents(db, date, "login_failed"),
    analysisCreatedCount: countEvents(db, date, "analysis_created"),
    analysisCompletedCount: countEvents(db, date, "analysis_completed"),
    analysisFailedCount: countEvents(db, date, "analysis_failed"),
    followupAskedCount: countEvents(db, date, "followup_asked"),
    parameterConfirmedCount: countEvents(db, date, "parameter_confirmed"),
    parameterCorrectedCount: countEvents(db, date, "parameter_corrected"),
    exportJsonCount: countEvents(db, date, "export_json"),
    exportHtmlCount: countEvents(db, date, "export_html"),
    exportCsvCount: countEvents(db, date, "export_csv")
  };
}

function toCsv(result) {
  const header = Object.keys(result).join(",");
  const values = Object.values(result).join(",");
  return `${header}\n${values}\n`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const date = options.date?.trim() || todayDate();
  const format = options.format?.trim() || "json";
  const db = ensureDatabase();

  try {
    const result = {
      date,
      ...getDailyAuditSummary(db, date)
    };

    if (format === "csv") {
      process.stdout.write(toCsv(result));
      return;
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    db.close();
  }
}

run();
