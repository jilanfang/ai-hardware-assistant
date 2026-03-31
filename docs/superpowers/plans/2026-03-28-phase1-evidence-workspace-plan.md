# Phase 1 Evidence Workspace Implementation Plan

> Historical execution plan.
>
> This plan was useful when the repo still framed capture as the next slice.
> It is no longer an active execution plan for this repository.
> Current source of truth is `task_plan.md`, and the capture spec referenced here was moved to:
> `/Users/jilanfang/ai-hardware-assistant/docs/archive/product/capture-scene-prd.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-anchor the repo around a single phase-1 product definition: an evidence workspace that ships datasheet deep reading first and prepares the next screenshot-to-structured-output slice without reopening broad platform scope.

**Architecture:** Keep one product shell and one task-thread interaction model. Complete the current datasheet trust loop end-to-end first, then add a clearly separate “capture-to-structured-output” scene on top of the same evidence-first primitives instead of branching into generic office automation or broad copilot behavior.

**Tech Stack:** Next.js, React, TypeScript, Vitest, current local analysis job model, current PDF evidence canvas, checked-in product docs under `docs/`.

---

## File Structure

- Modify: `/Users/jilanfang/ai-hardware-assistant/README.md`
  - Reframe the repo as a phase-1 evidence workspace instead of a narrow single-PDF tool with drifting long-term language.
- Modify: `/Users/jilanfang/ai-hardware-assistant/task_plan.md`
  - Replace the current DigiKey-only execution framing with a product-aligned backlog that still preserves parser/taxonomy work as supporting work, not the product goal itself.
- Modify: `/Users/jilanfang/ai-hardware-assistant/progress.md`
  - Record the strategy pivot so recovery state matches the new phase-1 definition.
- Modify: `/Users/jilanfang/ai-hardware-assistant/docs/product/mvp-prd.md`
  - Align product requirements with the approved phase-1 boundary and explicitly define what is excluded.
- Modify: `/Users/jilanfang/ai-hardware-assistant/docs/product/interaction-details.md`
  - Reflect the task-thread workspace as the single interaction shell for both present and next scenes.
- Modify: `/Users/jilanfang/ai-hardware-assistant/docs/engineering/technical-architecture.md`
  - Separate “shipped datasheet scene” from “planned capture scene” and define reuse points.
- Create: `/Users/jilanfang/ai-hardware-assistant/docs/product/capture-scene-prd.md`
  - Write the next-slice spec for screenshot/capture-to-structured-output.
- Modify: `/Users/jilanfang/ai-hardware-assistant/components/workspace.tsx`
  - Only after docs are aligned, tighten copy and scene language so the UI reflects the new product framing.
- Modify: `/Users/jilanfang/ai-hardware-assistant/tests/workspace.test.tsx`
  - Keep UI tests aligned with the updated product language and scene framing.

## Task 1: Align Source Of Truth Docs

**Files:**
- Modify: `/Users/jilanfang/ai-hardware-assistant/README.md`
- Modify: `/Users/jilanfang/ai-hardware-assistant/task_plan.md`
- Modify: `/Users/jilanfang/ai-hardware-assistant/progress.md`
- Test: no automated tests; manual diff review

- [ ] **Step 1: Read the current top-level docs side by side**

Run: `sed -n '1,220p' README.md && sed -n '1,220p' task_plan.md && sed -n '1,220p' progress.md`

Expected: top-level docs still over-index on the current DigiKey/parser framing and do not cleanly express the approved phase-1 product definition.

- [ ] **Step 2: Rewrite the top-level product sentence in `README.md`**

Make the repo description explicitly say the product is an evidence workspace for electronics documents and data, shipping datasheet deep reading first and preparing screenshot-to-structured-output next.

- [ ] **Step 3: Rewrite the goal and current phase in `task_plan.md`**

Replace the current goal text with a product-level goal such as:

```md
## Goal
Ship phase 1 of the evidence workspace: finish the datasheet trust loop, then prepare the next capture-to-structured-output slice.
```

Expected scope split:
- `Now`: docs alignment, datasheet trust loop hardening, evidence precision, smoke validation
- `Next`: capture-scene spec and architecture prep
- `Later`: screenshot ingestion and template export implementation

- [ ] **Step 4: Update `progress.md` so recovery state matches the new direction**

Record that the repo is no longer interpreted as “DigiKey taxonomy alignment” alone. Parser/taxonomy work remains supporting infrastructure for the datasheet scene.

- [ ] **Step 5: Review the diff for coherence**

Run: `git diff -- README.md task_plan.md progress.md`

Expected: all three files describe the same phase-1 product in consistent language.

## Task 2: Align Product Docs To The Approved Boundary

**Files:**
- Modify: `/Users/jilanfang/ai-hardware-assistant/docs/product/mvp-prd.md`
- Modify: `/Users/jilanfang/ai-hardware-assistant/docs/product/interaction-details.md`
- Modify: `/Users/jilanfang/ai-hardware-assistant/docs/engineering/technical-architecture.md`
- Test: no automated tests; manual consistency check

- [ ] **Step 1: Identify outdated language that implies broader or different scope**

Run: `rg -n "replacement|comparison|share|single-PDF|single PDF|platform|report page|BOM workflow|testing/report automation suite" docs/product docs/engineering`

Expected: find wording that needs consolidation into the approved phase-1 framing.

- [ ] **Step 2: Update `docs/product/mvp-prd.md`**

Ensure it clearly states:
- shipped first slice = datasheet deep reading with evidence
- next validated slice = capture-to-structured-output
- excluded = generic office automation, autonomous review, black-box recommendations

- [ ] **Step 3: Update `docs/product/interaction-details.md`**

Ensure it states:
- one task thread per work item
- one evidence canvas
- one output stream
- future scenes reuse the same shell rather than introducing a parallel UI

- [ ] **Step 4: Update `docs/engineering/technical-architecture.md`**

Add a concrete architectural split:
- `Scene A`: document-grounded datasheet reading
- `Scene B`: capture-grounded structured output

Document what is reused:
- task-thread model
- evidence model
- export model
- scene-specific parser layer

- [ ] **Step 5: Run a consistency grep**

Run: `rg -n "evidence workspace|capture-to-structured-output|generic office|autonomous schematic|black-box" docs/product docs/engineering README.md task_plan.md`

Expected: the new framing appears in the right places without contradictory older language dominating the docs.

## Task 3: Write The Next-Slice Spec For Capture-To-Structured-Output

**Files:**
- Create: `/Users/jilanfang/ai-hardware-assistant/docs/product/capture-scene-prd.md`
- Test: no automated tests; manual review

- [ ] **Step 1: Define the narrow input/output contract**

Write the new doc around one repeated loop:
- input: screenshot or instrument capture plus optional template / DS reference
- output: extracted structured values plus optional first-pass conclusion draft

- [ ] **Step 2: Specify the MVP user journey**

Document the happy path:
1. Upload one or more captures
2. Review extracted marker values
3. Correct any wrong values
4. Export structured output
5. Optionally generate a report draft

- [ ] **Step 3: Specify trust requirements**

The doc must explicitly require:
- value-by-value review before export
- visible source crop or capture anchor per extracted value
- no black-box conclusion without a traceable input basis

- [ ] **Step 4: Specify what is excluded**

Explicitly exclude:
- arbitrary chart understanding
- full FA diagnosis automation
- broad OCR ingestion of every lab artifact
- generic PPT / Word office automation

- [ ] **Step 5: Review the finished spec**

Run: `sed -n '1,240p' docs/product/capture-scene-prd.md`

Expected: a tight next-slice spec that can later drive implementation without reopening broad scope.

## Task 4: Reflect The New Product Language In The Current UI

**Files:**
- Modify: `/Users/jilanfang/ai-hardware-assistant/components/workspace.tsx`
- Modify: `/Users/jilanfang/ai-hardware-assistant/tests/workspace.test.tsx`
- Test: `/Users/jilanfang/ai-hardware-assistant/tests/workspace.test.tsx`

- [ ] **Step 1: Identify copy that still frames the app too narrowly or inconsistently**

Run: `rg -n "datasheet|PDF|报告|导出|任务|AI Task" components/workspace.tsx tests/workspace.test.tsx`

Expected: find copy that should better express “evidence workspace” while still matching the shipped datasheet slice.

- [ ] **Step 2: Tighten the workspace copy**

Adjust only user-facing copy that matters now. Keep the current layout and behavior intact. The current scene should still read as datasheet-first, but with wording that does not block the next capture scene.

- [ ] **Step 3: Update or add tests for the revised language**

Keep test assertions aligned with the new copy without weakening behavior coverage.

- [ ] **Step 4: Run the focused UI test file**

Run: `npm test -- tests/workspace.test.tsx`

Expected: PASS

## Task 5: Finish The Datasheet Trust Loop Before Adding A New Scene

**Files:**
- Modify: `/Users/jilanfang/ai-hardware-assistant/task_plan.md`
- Reference: `/Users/jilanfang/ai-hardware-assistant/lib/server-analysis.ts`
- Reference: `/Users/jilanfang/ai-hardware-assistant/lib/generated/digikey-taxonomy.json`
- Reference: `/Users/jilanfang/ai-hardware-assistant/components/workspace.tsx`
- Test: existing analysis and workspace suites

- [ ] **Step 1: Reframe parser/taxonomy work as support work, not the product itself**

Update backlog wording so taxonomy work is clearly in service of the datasheet trust loop: better extraction, better evidence, better grounded comparison.

- [ ] **Step 2: Define the datasheet exit criteria**

Add explicit criteria to `task_plan.md`, for example:
- evidence-linked outputs feel trustworthy in manual smoke checks
- category naming is consistent for current supported families
- partial vs complete states are meaningfully different
- one external user can complete upload -> verify -> export without guidance

- [ ] **Step 3: Preserve the capture scene as a next-slice backlog item**

Add a `Next` item that links directly to `docs/product/capture-scene-prd.md` once created.

- [ ] **Step 4: Review backlog coherence**

Run: `sed -n '1,220p' task_plan.md`

Expected: product-level backlog order is obvious and no longer starts with infrastructure wording detached from the approved phase-1 narrative.

## Task 6: Verify The Plan’s Intended Outcome In The Repo

**Files:**
- Modify: any files from Tasks 1-5
- Test: full verification commands below

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: PASS

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: PASS

- [ ] **Step 3: Review final doc diff**

Run: `git diff -- README.md task_plan.md progress.md docs/product/mvp-prd.md docs/product/interaction-details.md docs/engineering/technical-architecture.md docs/product/capture-scene-prd.md components/workspace.tsx tests/workspace.test.tsx`

Expected: the repo now tells one coherent story: one evidence workspace, datasheet scene first, capture scene next.

- [ ] **Step 4: Prepare execution checkpoint**

Summarize:
- what changed in source-of-truth docs
- whether UI copy changed
- whether capture-scene spec is now ready for execution planning

## Notes For Execution

- Do not add implementation for screenshot ingestion in this plan. This plan only prepares the repo so that work can start cleanly.
- Do not reopen generic AI office automation ideas during execution.
- Do not split the product into persona-specific homepages, persona-specific card stacks, or role-first navigation. Persona support must remain inside the same AI-native task-thread interface.
- When in doubt, reject any change that does not help a user verify electronics material faster.

## Suggested Commit Boundaries

1. `docs: align phase1 evidence workspace narrative`
2. `docs: add capture scene product spec`
3. `feat: tighten workspace language to evidence workspace framing`

## Execution Handoff

Plan complete and saved to `/Users/jilanfang/ai-hardware-assistant/docs/superpowers/plans/2026-03-28-phase1-evidence-workspace-plan.md`.

Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, faster iteration on doc and product-boundary cleanup.
2. Inline Execution - execute tasks in this session using the plan as written, with checkpoints after the doc/source-of-truth tasks.
