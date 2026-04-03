import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resetAuthDatabase } from "@/lib/auth-db";

let authDbDir: string;

describe("admin scripts", () => {
  beforeEach(() => {
    authDbDir = mkdtempSync(join(tmpdir(), "atlas-admin-script-"));
    process.env.ATLAS_DB_PATH = join(authDbDir, "atlas.db");
    resetAuthDatabase();
  });

  afterEach(() => {
    resetAuthDatabase();
    delete process.env.ATLAS_DB_PATH;
    rmSync(authDbDir, { recursive: true, force: true });
  });

  test("invite code script creates 20 readable active invite codes by default", () => {
    const output = execFileSync("node", ["scripts/invite-codes.mjs", "generate", "--created-by", "atlas01"], {
      cwd: process.cwd(),
      env: { ...process.env },
      encoding: "utf8"
    });

    const lines = output.trim().split("\n");

    expect(lines[0]).toBe("code,status,created_by");
    expect(lines).toHaveLength(21);
    expect(lines.slice(1).every((line) => /^ATLAS-[A-Z2-9]{4}-[A-Z2-9]{4},active,atlas01$/.test(line))).toBe(true);
  });
});
