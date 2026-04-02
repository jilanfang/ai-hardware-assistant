# Runtime Attribution And Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make runtime attribution and observability consistent for staged complete, partial, and failed datasheet analysis results.

**Architecture:** Extend the existing `sourceAttribution` object and `logAnalysisEvent` payloads in `lib/server-analysis.ts` instead of introducing a new runtime metadata layer. Match the repository's current test style by adding narrow assertions in backend and workspace tests.

**Tech Stack:** TypeScript, Next.js server pipeline, React workspace, Vitest

---

### Task 1: Lock the missing backend behavior with failing tests

**Files:**
- Modify: `tests/analysis.test.ts`

- [x] **Step 1: Write the failing test for staged final attribution**
Add a test proving the staged final result preserves `llmTarget`, `documentPath`, and `pipelineMode` inside `analysis.sourceAttribution`.

- [x] **Step 2: Run test to verify it fails**
Run: `npm test -- tests/analysis.test.ts`
Expected: FAIL because the staged final result currently drops some runtime attribution fields.

- [x] **Step 3: Write the failing test for observability payload completeness**
Add a test that expects the relevant completion or failure log lines to include concrete runtime fields and stage context.

- [x] **Step 4: Run test to verify it fails**
Run: `npm test -- tests/analysis.test.ts`
Expected: FAIL because current logs do not carry the full runtime payload consistently.

### Task 2: Lock the workspace regression with a failing test

**Files:**
- Modify: `tests/workspace.test.tsx`

- [x] **Step 1: Write the failing test**
Add a test proving a completed staged analysis renders a concrete runtime path note when the fixture includes full staged attribution (`llmTarget`, `documentPath`, `pipelineMode`).

- [x] **Step 2: Run test to verify it fails**
Run: `npm test -- tests/workspace.test.tsx`
Expected: FAIL because the completed staged fixture currently lacks full runtime attribution.

- [x] **Step 3: Add the sparse-snapshot regression**
Add a second workspace assertion proving a sparse or legacy attribution snapshot does not render the misleading `未记录模型 · 路径未知 · unknown` placeholder.

- [x] **Step 4: Re-run the workspace test file**
Run: `npm test -- tests/workspace.test.tsx`
Expected: FAIL before implementation, then PASS after the runtime-note behavior is corrected.

### Task 3: Implement the minimal runtime-field propagation

**Files:**
- Modify: `lib/server-analysis.ts`
- Modify: `components/workspace.tsx`

- [x] **Step 1: Fill staged final `sourceAttribution` fields**
Preserve `llmTarget`, `documentPath`, and `pipelineMode` on the staged final result.

- [x] **Step 2: Normalize observability payloads**
Add the same runtime fields to the relevant completion, partial, and failure log events without introducing a new helper layer unless the file already has a clear local pattern for it.

- [x] **Step 3: Normalize runtime-note rendering in the workspace**
Ensure the workspace renders the concrete runtime note when attribution is complete, and suppresses misleading placeholder output when a legacy snapshot only carries sparse attribution.

- [x] **Step 4: Run targeted tests to verify green**
Run: `npm test -- tests/analysis.test.ts tests/workspace.test.tsx`
Expected: PASS

### Task 4: Verify adjacent trust-loop behavior and update task files

**Files:**
- Modify: `progress.md`
- Modify: `findings.md`

- [x] **Step 1: Run adjacent verification**
Run: `npm test -- tests/analysis-route.test.ts tests/analysis-jobs.test.ts tests/follow-up-route.test.ts`
Expected: PASS

- [x] **Step 2: Update task files**
Record that staged complete results and observability logs now carry the same runtime attribution fields as degraded states.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 1 issue, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**UNRESOLVED:** 0

**VERDICT:** ENG CLEARED — ready to implement.
