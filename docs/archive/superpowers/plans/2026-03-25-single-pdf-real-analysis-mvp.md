# Single PDF Real Analysis MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace deterministic seed-based single-PDF analysis with a real upload-to-analysis pipeline while keeping the current chat-first workspace and evidence-verification UX.

**Architecture:** Introduce a narrow server-side analysis flow with async-job semantics: the UI uploads one PDF, creates an analysis job, polls status, and renders a normalized single-document result. Parser-specific output is translated into a small UI-facing analysis contract so the existing chat-first experience stays mostly intact.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Normalize The MVP Scope In Project Docs

**Files:**
- Modify: `docs/handoff-recovery.md`
- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `findings.md`

- [ ] Update the project memory files so the source of truth reflects the current prototype state.
- [ ] Record that the near-term MVP target is now single-PDF first-pass analysis, not replacement comparison.
- [ ] Capture the new next step as the real parsing/analysis pipeline.

### Task 2: Write Failing Domain Tests For Real Analysis States

**Files:**
- Modify: `tests/analysis.test.ts`
- Modify: `tests/workspace.test.tsx`
- Modify: `lib/types.ts`

- [ ] Add a failing domain test for analysis jobs that move through `processing`, `complete`, `partial`, and `failed`.
- [ ] Add a failing UI test that shows a processing state after upload before analysis finishes.
- [ ] Add a failing UI test for partial-result messaging.
- [ ] Run the targeted tests and confirm they fail for the missing real-analysis flow.

### Task 3: Introduce The Server-Side Analysis Contract

**Files:**
- Create: `app/api/analysis/route.ts`
- Modify: `lib/types.ts`
- Modify: `lib/analysis.ts`
- Create: `lib/server-analysis.ts`

- [ ] Define the single-PDF analysis job request and response schema.
- [ ] Add a server-side analysis entry point that accepts one uploaded PDF.
- [ ] Keep the first implementation narrow and local, but shape it like an async job API.
- [ ] Normalize parser output into the UI-facing analysis result contract.

### Task 4: Wire The Workspace To Real Analysis Status

**Files:**
- Modify: `components/workspace.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

- [ ] Replace direct client-side `generateAnalysis` calls with the new analysis API flow.
- [ ] Render explicit `processing`, `partial`, and `failed` states in the chat-first message stream.
- [ ] Preserve the existing evidence click and PDF preview behavior.
- [ ] Keep the upload interaction and result-first layout intact.

### Task 5: Tighten Verification And Update Project Memory

**Files:**
- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `findings.md`

- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Record the shipped state of the real single-PDF analysis pipeline.
- [ ] Capture the remaining post-MVP gaps without re-expanding scope into comparison features.
