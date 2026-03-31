# Single PDF Chat-First MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable single-PDF, chat-first datasheet-analysis prototype with PDF preview, evidence jumping, and export downloads.

**Architecture:** A lightweight `Next.js` frontend prototype with deterministic local analysis data. The left chat column owns task creation and all result rendering, while the right PDF canvas only renders the currently focused evidence target. Analysis and export generation live in pure helper modules to keep future backend replacement simple.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Project Bootstrap

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `next-env.d.ts`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`

- [ ] Add the minimal Next.js and Vitest configuration aligned with `ai-quality`.
- [ ] Verify the project can run typecheck, tests, and build commands.

### Task 2: Domain Tests First

**Files:**
- Create: `tests/analysis.test.ts`
- Create: `tests/exports.test.ts`
- Create: `tests/workspace.test.tsx`
- Create: `lib/analysis.ts`
- Create: `lib/exports.ts`
- Create: `lib/types.ts`

- [ ] Write failing tests for deterministic analysis output from one uploaded PDF record.
- [ ] Write failing tests for export file creation metadata and parameter-table cleanliness.
- [ ] Write failing UI tests for chat-first empty state, upload flow, and evidence click behavior.
- [ ] Run the tests and confirm they fail for the expected missing-implementation reasons.

### Task 3: Minimal Domain Implementation

**Files:**
- Create: `lib/seed.ts`
- Modify: `lib/analysis.ts`
- Modify: `lib/exports.ts`
- Modify: `lib/types.ts`

- [ ] Implement the smallest pure functions that satisfy the failing domain tests.
- [ ] Keep evidence anchors deterministic and simple.
- [ ] Keep exported parameter rows to `name + value`.

### Task 4: Chat-First Workspace

**Files:**
- Create: `components/workspace.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

- [ ] Implement the two-column chat-first UI.
- [ ] Keep task creation, upload, analysis blocks, evidence links, and export buttons inside the left message flow.
- [ ] Keep the right side as a passive PDF canvas with empty-state hint and focused evidence state.
- [ ] Re-run the UI tests until they pass.

### Task 5: Verification And Project Memory

**Files:**
- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `findings.md`

- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Update project progress and findings with the shipped prototype state.
- [ ] Record any remaining gaps that still need real parser/LLM integration.
