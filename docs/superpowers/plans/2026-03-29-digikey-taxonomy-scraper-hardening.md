# DigiKey Taxonomy Scraper Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DigiKey taxonomy generation reproducible by default and require explicit intent before attempting live network refreshes.

**Architecture:** Keep the checked-in fixtures as the default source for local taxonomy generation, add an explicit CLI flag for live refresh, and preserve the existing output shape. Harden only the fetch path selection and its tests; do not redesign parsing or taxonomy structure.

**Tech Stack:** Python CLI script, Vitest script tests, checked-in HTML fixtures

---

### Task 1: Lock default fixture-first behavior

**Files:**
- Modify: `tests/digikey-taxonomy-script.test.ts`
- Modify: `scripts/digikey_taxonomy/fetch_digikey_taxonomy.py`

- [ ] **Step 1: Write the failing test**
Add a test proving the script still succeeds from fixtures even when `DIGIKEY_CF_CLEARANCE` is present but invalid, as long as no explicit live-refresh flag is set.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- tests/digikey-taxonomy-script.test.ts`
Expected: the new test fails because the current script prefers online fetch when clearance is present.

- [ ] **Step 3: Write minimal implementation**
Change the CLI contract so fixture-backed generation remains the default path and live fetching only runs behind an explicit flag.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test -- tests/digikey-taxonomy-script.test.ts`
Expected: PASS

### Task 2: Add explicit live-refresh contract coverage

**Files:**
- Modify: `tests/digikey-taxonomy-script.test.ts`
- Modify: `scripts/digikey_taxonomy/fetch_digikey_taxonomy.py`

- [ ] **Step 1: Write the failing test**
Add a test proving an explicit live-refresh mode fails fast with a clear error when clearance is invalid and no fallback should occur.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- tests/digikey-taxonomy-script.test.ts`
Expected: the new test fails because the explicit online-only contract does not exist yet.

- [ ] **Step 3: Write minimal implementation**
Add a CLI flag for live refresh and keep error messaging explicit when DigiKey blocks the request.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test -- tests/digikey-taxonomy-script.test.ts`
Expected: PASS

### Task 3: Verify the touched area end to end

**Files:**
- Modify: `package.json`
- Modify: `progress.md`
- Modify: `findings.md`

- [ ] **Step 1: Align command naming if needed**
Ensure `package.json` exposes the stable default and a clearly named explicit refresh command.

- [ ] **Step 2: Run targeted verification**
Run: `npm test -- tests/digikey-taxonomy-script.test.ts`
Expected: PASS

- [ ] **Step 3: Run broader verification**
Run: `npm test -- tests/digikey-taxonomy-script.test.ts tests/digikey-taxonomy.test.ts tests/analysis.test.ts`
Expected: PASS

- [ ] **Step 4: Update task files**
Record the new scraper contract and remaining blocker around valid DigiKey clearance.
