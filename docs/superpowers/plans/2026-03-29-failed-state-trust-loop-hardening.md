# Failed State Trust-Loop Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make failed analysis states more actionable by preserving specific failure guidance instead of collapsing everything into one generic retry message.

**Architecture:** Keep the existing analysis job snapshot shape and task-thread rendering, but preserve source-specific failure warnings from the analysis pipeline through the job layer into the workspace. Limit scope to failure-state messaging only; do not redesign partial or delayed flows.

**Tech Stack:** TypeScript, Next.js route/job layer, React workspace UI, Vitest

---

### Task 1: Preserve source-specific failed warnings in the job layer

**Files:**
- Modify: `tests/analysis-jobs.test.ts`
- Modify: `lib/analysis-jobs.ts`

- [ ] **Step 1: Write the failing test**
Add a test proving that when analysis returns `status: "failed"` with a specific warning like “当前 PDF 未能提取到可用文本…”, the job snapshot preserves that warning instead of replacing it with the generic retry text.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- tests/analysis-jobs.test.ts`
Expected: FAIL because the current job layer overwrites failed warnings with a generic message.

- [ ] **Step 3: Write minimal implementation**
Update the job layer to prefer the analysis result warning for failed states and only fall back to the generic message when no specific warning exists.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test -- tests/analysis-jobs.test.ts`
Expected: PASS

### Task 2: Surface the preserved failure guidance in the workspace

**Files:**
- Modify: `tests/workspace.test.tsx`
- Modify: `components/workspace.tsx`

- [ ] **Step 1: Write the failing test**
Add a workspace test proving that a failed upload caused by a non-text PDF shows the text-layer-specific guidance in the task thread and marks the task as `解析失败`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test -- tests/workspace.test.tsx`
Expected: FAIL because the workspace currently collapses that case into the generic failure copy.

- [ ] **Step 3: Write minimal implementation**
Ensure the workspace continues to surface the warning supplied by the failed snapshot without overriding it.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test -- tests/workspace.test.tsx`
Expected: PASS

### Task 3: Verify the narrowed trust-loop change

**Files:**
- Modify: `progress.md`
- Modify: `findings.md`

- [ ] **Step 1: Run focused verification**
Run: `npm test -- tests/analysis-jobs.test.ts tests/workspace.test.tsx`
Expected: PASS

- [ ] **Step 2: Run adjacent verification**
Run: `npm test -- tests/analysis-route.test.ts tests/analysis.test.ts`
Expected: PASS

- [ ] **Step 3: Update task files**
Record that failed states now preserve actionable source-specific guidance instead of collapsing into one generic message.
