import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

const ROOT = "/Users/jilanfang/ai-hardware-assistant";
const SCRIPT_PATH = join(ROOT, "scripts/mouser_rf_front_end/scrape_rf_front_end.py");
const FIXTURES_DIR = join(ROOT, "scripts/mouser_rf_front_end/fixtures");

function runScraper(args: string[]) {
  return execFileSync(join(ROOT, ".venv/bin/python"), [SCRIPT_PATH, ...args], {
    cwd: ROOT,
    stdio: "pipe"
  });
}

describe("Mouser RF Front End scraper", () => {
  test("builds records from local fixtures and captures category metadata", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mouser-rf-front-end-"));
    const fixturesCopy = join(tempDir, "fixtures");
    const outputDir = join(tempDir, "output");

    cpSync(FIXTURES_DIR, fixturesCopy, { recursive: true });

    runScraper(["--input-dir", fixturesCopy, "--output-dir", outputDir, "--limit", "25"]);

    const generated = JSON.parse(
      readFileSync(join(outputDir, "mouser-rf-front-end-products.json"), "utf-8")
    ) as {
      source: string;
      categoryName: string;
      categoryUrl: string;
      products: Array<{
        detail_url: string;
        manufacturer?: string;
        manufacturer_part_number?: string;
        mouser_part_number?: string;
      }>;
    };

    expect(generated.source).toBe("mouser");
    expect(generated.categoryName).toBe("RF Front End");
    expect(generated.categoryUrl).toContain("/rf-front-end/");
    expect(generated.products.length).toBeGreaterThan(0);
    expect(generated.products[0]?.detail_url).toContain("/ProductDetail/");
    expect(generated.products[0]?.manufacturer).toBeTruthy();
  });

  test("writes both JSON and CSV with stable detail fields", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mouser-rf-front-end-export-"));
    const fixturesCopy = join(tempDir, "fixtures");
    const outputDir = join(tempDir, "output");

    cpSync(FIXTURES_DIR, fixturesCopy, { recursive: true });

    runScraper(["--input-dir", fixturesCopy, "--output-dir", outputDir, "--limit", "25"]);

    const generated = JSON.parse(
      readFileSync(join(outputDir, "mouser-rf-front-end-products.json"), "utf-8")
    ) as {
      products: Array<{
        detail_url: string;
        manufacturer?: string;
        manufacturer_part_number?: string;
        mouser_part_number?: string;
        datasheet_url?: string | null;
      }>;
    };
    const csv = readFileSync(join(outputDir, "mouser-rf-front-end-products.csv"), "utf-8");
    const target = generated.products.find((product) =>
      product.detail_url.includes("/ProductDetail/Skyworks-Solutions-Inc/RFX2401C")
    );

    expect(target?.detail_url).toContain("/ProductDetail/");
    expect(target?.manufacturer).toBe("Skyworks Solutions, Inc.");
    expect(target?.manufacturer_part_number).toBe("RFX2401C");
    expect(target?.mouser_part_number).toBeTruthy();
    expect(target?.datasheet_url).toBeTruthy();

    expect(csv).toContain("detail_url");
    expect(csv).toContain("manufacturer");
    expect(csv).toContain("manufacturer_part_number");
    expect(csv).toContain("mouser_part_number");
    expect(csv).toContain("Skyworks Solutions, Inc.");
    expect(csv).toContain("RFX2401C");
  });

  test("keeps sample rows aligned with their own category-page fields", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mouser-rf-front-end-clean-"));
    const fixturesCopy = join(tempDir, "fixtures");
    const outputDir = join(tempDir, "output");

    cpSync(FIXTURES_DIR, fixturesCopy, { recursive: true });

    runScraper(["--input-dir", fixturesCopy, "--output-dir", outputDir, "--limit", "3"]);

    const generated = JSON.parse(
      readFileSync(join(outputDir, "mouser-rf-front-end-products.json"), "utf-8")
    ) as {
      products: Array<{
        detail_url: string;
        manufacturer?: string;
        manufacturer_part_number?: string;
        mouser_part_number?: string;
        description?: string;
        datasheet_url?: string | null;
        stock?: string;
        pricing?: string;
      }>;
    };

    expect(generated.products[0]).toMatchObject({
      manufacturer: "Qorvo",
      manufacturer_part_number: "QPF4557TR13",
      mouser_part_number: "772-QPF4557TR13",
      stock: "2,465 In Stock"
    });
    expect(generated.products[0]?.description).toContain("5GHz Wi-Fi 7 High Power Front End Module");
    expect(generated.products[0]?.datasheet_url).toBeFalsy();
    expect(generated.products[0]?.pricing).toContain("1:$3.32");

    expect(generated.products[1]).toMatchObject({
      manufacturer: "Nisshinbo Micro Devices",
      manufacturer_part_number: "NJG1156PCD-TE1",
      mouser_part_number: "513-NJG1156PCD-TE1",
      datasheet_url: "https://www.njr.com/electronic_device/PDF/NJG1156PCD_E.pdf",
      stock: "33,220 In Stock"
    });
    expect(generated.products[1]?.pricing).toBe(
      "1:$2.45 | 10:$2.12 | 25:$2.00 | 100:$1.84 | 250:$1.74 | 500:$1.67 | 1,000:$1.37 | 3,000:$1.30 | 6,000:$1.27"
    );

    expect(generated.products[2]).toMatchObject({
      manufacturer: "Qorvo",
      manufacturer_part_number: "QPB9850TR7",
      mouser_part_number: "772-QPB9850TR7",
      stock: "1,332 In Stock"
    });
    expect(generated.products[2]?.pricing).toBe(
      "1:$15.77 | 25:$11.83 | 100:$8.87 | 250:$7.36 | 500:$6.62 | 1,000:$5.96 | 2,500:$5.90"
    );
  });

  test("writes category_path to csv in human-readable form", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mouser-rf-front-end-csv-"));
    const fixturesCopy = join(tempDir, "fixtures");
    const outputDir = join(tempDir, "output");

    cpSync(FIXTURES_DIR, fixturesCopy, { recursive: true });

    runScraper(["--input-dir", fixturesCopy, "--output-dir", outputDir, "--limit", "1"]);

    const csv = readFileSync(join(outputDir, "mouser-rf-front-end-products.csv"), "utf-8");

    expect(csv).toContain(
      "All Products > Semiconductors > Integrated Circuits - ICs > Wireless & RF Integrated Circuits > RF Front End"
    );
    expect(csv).not.toContain("['All Products'");
  });

  test("resume mode skips already completed detail urls", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "mouser-rf-front-end-resume-"));
    const fixturesCopy = join(tempDir, "fixtures");
    const outputDir = join(tempDir, "output");
    const progressPath = join(outputDir, "mouser-rf-front-end-progress.json");

    cpSync(FIXTURES_DIR, fixturesCopy, { recursive: true });
    mkdirSync(outputDir, { recursive: true });

    writeFileSync(
      progressPath,
      JSON.stringify(
        {
          categoryUrl:
            "https://www.mouser.com/c/semiconductors/integrated-circuits-ics/wireless-rf-integrated-circuits/rf-front-end/",
          completedDetailUrls: [
            "https://www.mouser.com/ProductDetail/Skyworks-Solutions-Inc/RFX2401C?qs=dBWc1juS%252B3ydEXrKsuxQ7A%3D%3D"
          ]
        },
        null,
        2
      ),
      "utf-8"
    );

    runScraper(["--input-dir", fixturesCopy, "--output-dir", outputDir, "--limit", "1", "--resume"]);

    const generated = JSON.parse(
      readFileSync(join(outputDir, "mouser-rf-front-end-products.json"), "utf-8")
    ) as {
      products: Array<{ detail_url: string }>;
    };

    expect(
      generated.products.filter(
        (product) =>
          product.detail_url ===
          "https://www.mouser.com/ProductDetail/Skyworks-Solutions-Inc/RFX2401C?qs=dBWc1juS%252B3ydEXrKsuxQ7A%3D%3D"
      )
    ).toHaveLength(0);
  });
});
