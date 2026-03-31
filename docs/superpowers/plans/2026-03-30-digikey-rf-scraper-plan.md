# Mouser RF Front End Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a resumable Mouser scraper for the `RF Front End` category that exports both `JSON` and `CSV` from category-page and detail-page data.

**Architecture:** Add one focused Python CLI scraper under `scripts/` that follows the existing `scrapling` pattern in this repository. Keep parsing and export logic inside the script for v1, drive it with fixture-backed tests from Vitest, and persist resume state in `lib/generated`.

**Tech Stack:** Python CLI script, `scrapling`, Vitest script tests, checked-in HTML fixtures

---

### Task 1: Capture stable fixture inputs

**Files:**
- Create: `scripts/mouser_rf_front_end/fixtures/.gitkeep`
- Create: `scripts/mouser_rf_front_end/fixtures/rf-front-end-category.html`
- Create: `scripts/mouser_rf_front_end/fixtures/rfx2401c-detail.html`

- [ ] **Step 1: Save one category-page fixture**
Capture the current RF Front End category HTML into `scripts/mouser_rf_front_end/fixtures/rf-front-end-category.html`.

- [ ] **Step 2: Save one detail-page fixture**
Capture the current Mouser `RFX2401C` detail HTML into `scripts/mouser_rf_front_end/fixtures/rfx2401c-detail.html`.

- [ ] **Step 3: Verify fixtures exist**
Run: `find scripts/mouser_rf_front_end/fixtures -maxdepth 1 -type f | sort`
Expected: both HTML fixtures are present

### Task 2: Define parser and export behavior with failing tests

**Files:**
- Create: `tests/mouser-rf-front-end-scraper.test.ts`
- Test: `tests/mouser-rf-front-end-scraper.test.ts`

- [ ] **Step 1: Write the failing test for category parsing**
Add a test that runs the future Python scraper in fixture mode and expects at least one product URL plus category-level metadata in the JSON output.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- tests/mouser-rf-front-end-scraper.test.ts`
Expected: FAIL because the scraper script does not exist yet

- [ ] **Step 3: Write the failing test for detail parsing and export**
Add a test that expects the output `JSON` and `CSV` to include `detail_url`, `manufacturer`, `manufacturer_part_number`, `mouser_part_number`, and `datasheet_url` for the fixture-backed sample.

- [ ] **Step 4: Run test to verify it fails**
Run: `npm test -- tests/mouser-rf-front-end-scraper.test.ts`
Expected: FAIL because the parser/export behavior does not exist yet

- [ ] **Step 5: Write the failing test for resume behavior**
Add a test that seeds a progress file with one completed product URL, reruns the scraper with `--resume`, and expects no duplicate record for that URL.

- [ ] **Step 6: Run test to verify it fails**
Run: `npm test -- tests/mouser-rf-front-end-scraper.test.ts`
Expected: FAIL because resume handling does not exist yet

### Task 3: Implement the minimal scraper CLI

**Files:**
- Create: `scripts/mouser_rf_front_end/scrape_rf_front_end.py`
- Modify: `package.json`

- [ ] **Step 1: Add the minimal Python CLI skeleton**
Create `scripts/mouser_rf_front_end/scrape_rf_front_end.py` with argument parsing for `--limit`, `--resume`, `--output-dir`, `--save-html`, and fixture override inputs.

- [ ] **Step 2: Implement fixture-backed category parsing**
Add minimal code to parse category HTML, extract product detail URLs and lightweight list metadata, and build in-memory records.

- [ ] **Step 3: Implement fixture-backed detail parsing**
Add minimal code to parse detail HTML and merge stable fields into each product record.

- [ ] **Step 4: Implement JSON and CSV export**
Write outputs to the configured output directory and serialize `product_attributes` into a stable string form for CSV.

- [ ] **Step 5: Add a package script**
Add an npm script entry such as `mouser:rf-front-end` that invokes `.venv/bin/python scripts/mouser_rf_front_end/scrape_rf_front_end.py`.

- [ ] **Step 6: Run targeted tests to verify green**
Run: `npm test -- tests/mouser-rf-front-end-scraper.test.ts`
Expected: PASS

### Task 4: Add resumable progress handling

**Files:**
- Modify: `scripts/mouser_rf_front_end/scrape_rf_front_end.py`
- Test: `tests/mouser-rf-front-end-scraper.test.ts`

- [ ] **Step 1: Implement progress-state persistence**
Write a progress JSON file that tracks completed `detail_url` entries and last update time.

- [ ] **Step 2: Implement resume loading and deduplication**
When `--resume` is passed, load progress state, skip completed URLs, and avoid duplicate JSON or CSV rows.

- [ ] **Step 3: Run targeted tests to verify green**
Run: `npm test -- tests/mouser-rf-front-end-scraper.test.ts`
Expected: PASS

### Task 5: Validate the end-to-end sample flow

**Files:**
- Modify: `README.md`
- Modify: `progress.md`
- Modify: `findings.md`

- [ ] **Step 1: Add usage notes**
Document the new sample-first Mouser RF scraper command and output files in `README.md`.

- [ ] **Step 2: Run the scraper in sample mode**
Run: `npm run mouser:rf-front-end -- --limit 3`
Expected: script exits 0 and writes `JSON`, `CSV`, and progress output

- [ ] **Step 3: Verify resume mode**
Run: `npm run mouser:rf-front-end -- --limit 3 --resume`
Expected: no duplicate rows for already completed URLs

- [ ] **Step 4: Run the targeted automated test suite**
Run: `npm test -- tests/mouser-rf-front-end-scraper.test.ts tests/digikey-taxonomy-script.test.ts`
Expected: PASS

- [ ] **Step 5: Update task tracking files**
Record the Mouser RF scraper contract, sample verification status, and remaining live-crawl risks in `progress.md` and `findings.md`.
