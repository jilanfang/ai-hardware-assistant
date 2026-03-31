import { mkdtempSync, readFileSync } from "node:fs";
import { cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

const ROOT = "/Users/jilanfang/ai-hardware-assistant";
const SCRIPT_PATH = join(ROOT, "scripts/digikey_taxonomy/fetch_digikey_taxonomy.py");
const FIXTURES_DIR = join(ROOT, "scripts/digikey_taxonomy/fixtures");

describe("DigiKey taxonomy fetch script", () => {
  test("defaults to checked-in fixtures when no online source is available", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "digikey-taxonomy-default-"));
    const outputPath = join(tempDir, "digikey-taxonomy.json");

    execFileSync(join(ROOT, ".venv/bin/python"), [SCRIPT_PATH, "--output", outputPath], {
      cwd: ROOT,
      stdio: "pipe"
    });

    const generated = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      categories: Array<{ slug: string; parameterFields: Array<{ normalizedName: string }> }>;
    };

    expect(generated.categories).toHaveLength(3);
    expect(
      generated.categories.find((item) => item.slug === "rf-front-end-lna-pa")?.parameterFields.map((field) => field.normalizedName)
    ).toEqual(expect.arrayContaining(["RF Type", "Frequency", "Features"]));
  });

  test("ignores stale DigiKey clearance by default and still builds from fixtures", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "digikey-taxonomy-stale-clearance-"));
    const outputPath = join(tempDir, "digikey-taxonomy.json");

    execFileSync(join(ROOT, ".venv/bin/python"), [SCRIPT_PATH, "--output", outputPath], {
      cwd: ROOT,
      stdio: "pipe",
      env: {
        ...process.env,
        DIGIKEY_CF_CLEARANCE: "stale-clearance-token"
      }
    });

    const generated = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      categories: Array<{ slug: string }>;
    };

    expect(generated.categories.map((item) => item.slug)).toEqual(
      expect.arrayContaining([
        "rf-front-end-lna-pa",
        "voltage-regulators-dc-dc-switching-regulators",
        "voltage-regulators-linear-low-drop-out-ldo-regulators"
      ])
    );
  });

  test("builds the expected taxonomy from local fixtures", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "digikey-taxonomy-"));
    const outputPath = join(tempDir, "digikey-taxonomy.json");
    const fixturesCopy = join(tempDir, "fixtures");

    cpSync(FIXTURES_DIR, fixturesCopy, { recursive: true });

    execFileSync(
      join(ROOT, ".venv/bin/python"),
      [SCRIPT_PATH, "--input-dir", fixturesCopy, "--output", outputPath],
      {
        cwd: ROOT,
        stdio: "pipe"
      }
    );

    const generated = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      source: string;
      fetchedAt: string;
      categories: Array<{
        slug: string;
        categoryPath: string[];
        parameterFields: Array<{ normalizedName: string }>;
      }>;
    };

    expect(generated.source).toBe("digikey");
    expect(generated.fetchedAt).toMatch(/Z$/);

    const rfCategory = generated.categories.find((item) => item.slug === "rf-front-end-lna-pa");
    const pmicCategory = generated.categories.find(
      (item) => item.slug === "voltage-regulators-dc-dc-switching-regulators"
    );
    const ldoCategory = generated.categories.find(
      (item) => item.slug === "voltage-regulators-linear-low-drop-out-ldo-regulators"
    );

    expect(rfCategory?.categoryPath).toEqual(["RF and Wireless", "RF Front End (LNA + PA)"]);
    expect(rfCategory?.parameterFields.map((field) => field.normalizedName)).toEqual(
      expect.arrayContaining(["RF Type", "Frequency", "Features", "Package / Case", "Supplier Device Package"])
    );

    expect(pmicCategory?.categoryPath).toEqual([
      "Integrated Circuits (ICs)",
      "Power Management (PMIC)",
      "Voltage Regulators - DC DC Switching Regulators"
    ]);
    expect(pmicCategory?.parameterFields.map((field) => field.normalizedName)).toEqual(
      expect.arrayContaining([
        "Function",
        "Voltage - Input (Min)",
        "Voltage - Input (Max)",
        "Current - Output",
        "Frequency - Switching",
        "Supplier Device Package"
      ])
    );

    expect(ldoCategory?.categoryPath).toEqual([
      "Integrated Circuits (ICs)",
      "Power Management (PMIC)",
      "Voltage Regulators - Linear, Low Drop Out (LDO) Regulators"
    ]);
    expect(ldoCategory?.parameterFields.map((field) => field.normalizedName)).toEqual(
      expect.arrayContaining([
        "Output Type",
        "Voltage - Input (Max)",
        "Voltage - Output (Min/Fixed)",
        "Voltage Dropout (Max)",
        "Current - Output",
        "Supplier Device Package"
      ])
    );
  });

  test("requires explicit live refresh and fails fast when DigiKey blocks the request", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "digikey-taxonomy-live-refresh-"));
    const outputPath = join(tempDir, "digikey-taxonomy.json");

    expect(() =>
      execFileSync(join(ROOT, ".venv/bin/python"), [SCRIPT_PATH, "--refresh-live", "--output", outputPath], {
        cwd: ROOT,
        stdio: "pipe",
        env: {
          ...process.env,
          DIGIKEY_CF_CLEARANCE: "stale-clearance-token"
        }
      })
    ).toThrowError(/DigiKey .*blocked|challenged/i);
  });
});
