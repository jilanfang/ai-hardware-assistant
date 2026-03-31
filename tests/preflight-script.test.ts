import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

let tempDir: string;

describe("preflight script", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "atlas-preflight-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("fails in production when required env vars are missing", () => {
    expect(() =>
      execFileSync("node", ["scripts/preflight.mjs"], {
        cwd: "/Users/jilanfang/ai-hardware-assistant",
        env: {
          ...process.env,
          NODE_ENV: "production"
        },
        encoding: "utf8",
        stdio: "pipe"
      })
    ).toThrow(/missing SESSION_SECRET/);
  });

  test("passes with a complete production config and writable paths", () => {
    const dbPath = join(tempDir, "atlas.db");
    const jobsDir = join(tempDir, "jobs");

    const output = execFileSync("node", ["scripts/preflight.mjs"], {
      cwd: "/Users/jilanfang/ai-hardware-assistant",
      env: {
        ...process.env,
        NODE_ENV: "production",
        SESSION_SECRET: "prod-secret",
        ATLAS_DB_PATH: dbPath,
        ANALYSIS_JOB_STORE_DIR: jobsDir,
        ANALYSIS_LLM_PROVIDER: "lyapi",
        ANALYSIS_LLM_MODEL: "gemini-3.1-pro-preview",
        LYAPI_API_KEY: "lyapi-key"
      },
      encoding: "utf8",
      stdio: "pipe"
    });

    expect(output).toContain("Production preflight passed");
  });
});
