# MVP Hardening Execution Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the shipped single-PDF real-analysis MVP so it is trustworthy enough for dogfooding and small-scale external MVP usage before expanding scope.

**Architecture:** Keep the current chat-first upload -> async-job -> analysis -> evidence loop intact. Improve the weakest trust boundaries in order: upload guardrails first, then honest/grounded follow-up behavior, then durable job state, then parser/evidence precision.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, current local parser stack (`pdfjs-dist`, `textutil`, raw fallback)

---

## Scope Challenge

### What Already Exists
- `app/api/analysis/route.ts`
  - already accepts upload and exposes `POST` submit + `GET` polling
- `lib/analysis-jobs.ts`
  - already provides an async-job shell with `processing -> complete|failed`
- `lib/server-analysis.ts`
  - already implements a real parser stack plus `complete|partial|failed`
- `components/workspace.tsx`
  - already renders upload, processing, result, failure, parameter review, evidence focus, and follow-up input
- `tests/analysis-jobs.test.ts`
  - already covers job lifecycle basics
- `tests/analysis.test.ts`
  - already covers parser complete / partial / failed behavior
- `tests/workspace.test.tsx`
  - already covers processing, result render, evidence jump, parameter edit, and partial messaging

### NOT In Scope
- Multi-PDF comparison
- Share-page workflow
- Auth and invitation system
- Full production parser-worker deployment
- Final styled report artifacts
- Broad category system redesign

### Minimal Change Rule
- Reuse the current API shape and UI contract.
- Do not introduce a new service layer unless the current files become unmanageably mixed.
- Prefer adding guardrails and dependencies through the existing modules first.

## Current System Diagram

```text
User uploads PDF
  |
  v
POST /api/analysis
  |
  v
createAnalysisJob()
  |
  +--> store processing snapshot in memory
  |
  +--> analyzePdfBuffer()
         |
         +--> pdfjs-dist
         +--> textutil fallback
         +--> raw string fallback
         |
         +--> complete | partial | failed
  |
  v
GET /api/analysis?jobId=...
  |
  v
Workspace renders result
  |
  +--> evidence jump / highlight
  +--> confirm / edit parameter
  +--> follow-up question
  +--> export PDF / Word / CSV
```

## Recommended Execution Order

```text
1. Upload guardrails
   -> stop bad inputs early

2. Honest follow-up behavior
   -> remove fake intelligence risk

3. Durable job state
   -> stop losing jobs between requests / restarts

4. Parser + evidence hardening
   -> improve extraction quality once the trust boundary is stable
```

### Task 1: Add Upload Guardrails Before Parsing

**Files:**
- Modify: `app/api/analysis/route.ts`
- Modify: `lib/types.ts`
- Modify: `components/workspace.tsx`
- Modify: `tests/workspace.test.tsx`
- Modify: `tests/analysis.test.ts`

- [ ] Step 1: Write failing UI tests for rejected uploads.
- [ ] Step 2: Write failing route-level tests or parser-entry tests for oversized, empty, wrong-type, and clearly non-text-friendly inputs.
- [ ] Step 3: Add a narrow request contract for:
  - max file size
  - allowed MIME / extension
  - optional page-count or extracted-text precheck
- [ ] Step 4: Return clear user-facing error messages for rejected files before long parsing starts.
- [ ] Step 5: Render those guardrail failures in the existing chat-first failure card instead of inventing a new screen.
- [ ] Step 6: Run targeted tests for upload guardrails.
- [ ] Step 7: Commit.

**Definition of done**
- Unsupported or obviously bad inputs fail fast.
- The user sees a concrete reason, not a generic “解析失败”.
- The current happy path remains unchanged.

### Task 2: Make Follow-Up Q&A Honest Before Making It Smart

**Files:**
- Modify: `components/workspace.tsx`
- Modify: `lib/types.ts` if needed for explicit follow-up state
- Modify: `tests/workspace.test.tsx`
- Optional Modify: `docs/interaction-details.md`

- [ ] Step 1: Write a failing UI test that distinguishes the current placeholder follow-up behavior from the desired honest behavior.
- [ ] Step 2: Choose one narrow MVP-safe mode:
  - grounded follow-up using current parsed analysis only
  - or explicit “not yet grounded” response that tells the user what is and is not being answered
- [ ] Step 3: Implement the minimal behavior in the existing message flow.
- [ ] Step 4: Ensure the response never implies it read more than the current parsed result actually contains.
- [ ] Step 5: Add tests for:
  - empty question blocked
  - question after result works
  - user sees honest boundary messaging
- [ ] Step 6: Run targeted workspace tests.
- [ ] Step 7: Commit.

**Opinionated recommendation**
- Start with honest boundary messaging unless grounded Q&A can be implemented in the same diff with clear source limits.
- For MVP trust, “honest but limited” beats “fluent but fake.”

### Task 3: Replace In-Memory Jobs With Minimal Durable State

**Files:**
- Modify: `lib/analysis-jobs.ts`
- Modify: `app/api/analysis/route.ts`
- Create or Modify: `lib/analysis-store.ts`
- Modify: `tests/analysis-jobs.test.ts`
- Modify: `tests/workspace.test.tsx`
- Optional Modify: `docs/technical-architecture.md`

- [ ] Step 1: Write failing tests for job recovery beyond a single in-memory map lifecycle.
- [ ] Step 2: Introduce one minimal persistence layer with explicit interface:
  - create job
  - update job result
  - get job by id
- [ ] Step 3: Keep the existing API contract unchanged for the UI.
- [ ] Step 4: Prefer the simplest durable mechanism available for MVP:
  - file-backed local store for dogfooding
  - or database-backed store if already available in repo context
- [ ] Step 5: Add cleanup / expiry rules so old jobs do not accumulate forever.
- [ ] Step 6: Add tests for:
  - processing snapshot persisted
  - completed snapshot persisted
  - failed snapshot persisted
  - missing job handled clearly
- [ ] Step 7: Run targeted tests, then full suite.
- [ ] Step 8: Commit.

**Decision note**
- If no durable backend is already present, use the smallest reversible store that preserves the API contract.
- Do not pull in a full queue system yet.

### Task 4: Harden Parser Quality And Evidence Precision

**Files:**
- Modify: `lib/server-analysis.ts`
- Modify: `lib/types.ts` if evidence metadata expands
- Modify: `tests/analysis.test.ts`
- Modify: `tests/workspace.test.tsx`
- Optional Modify: `findings.md`

- [ ] Step 1: Write failing parser tests for the most important missing extraction cases from real datasheets.
- [ ] Step 2: Expand parameter extraction carefully without turning the file into an uncontrolled regex pile.
- [ ] Step 3: Improve evidence assignment so page targeting is more accurate before attempting true bounding boxes.
- [ ] Step 4: If rect precision cannot be real yet, keep the heuristic rectangles but label the limitation clearly in docs and UX.
- [ ] Step 5: Add tests for:
  - more than one real datasheet family
  - noisy but parseable text
  - partial parse with still-usable evidence
  - evidence landing on the correct later page
- [ ] Step 6: Run targeted parser tests, then full suite.
- [ ] Step 7: Commit.

**Complexity guard**
- If `lib/server-analysis.ts` starts mixing too many concerns, split only once:
  - extraction helpers
  - parameter matchers
  - evidence builders

### Task 5: Tighten Polling And Failure UX

**Files:**
- Modify: `components/workspace.tsx`
- Modify: `tests/workspace.test.tsx`
- Optional Modify: `docs/product-design.md`

- [ ] Step 1: Write failing UI tests for timeout and delayed completion behavior.
- [ ] Step 2: Make polling budget explicit and configurable.
- [ ] Step 3: Improve timeout copy so the user knows whether to retry, wait, or upload a better file.
- [ ] Step 4: Ensure delayed jobs do not create duplicate or contradictory cards in the chat stream.
- [ ] Step 5: Run targeted UI tests.
- [ ] Step 6: Commit.

### Task 6: Full Verification And Documentation Cleanup

**Files:**
- Modify: `README.md` if behavior changed
- Modify: `docs/handoff-recovery.md`
- Modify: `docs/technical-architecture.md`
- Modify: `task_plan.md`
- Modify: `progress.md`
- Modify: `findings.md`

- [ ] Step 1: Update docs to match the hardened MVP behavior.
- [ ] Step 2: Add an ASCII failure-mode diagram if the parsing / job path changed materially.
- [ ] Step 3: Run:
  - `npm test`
  - `npm run typecheck`
  - `npm run build`
- [ ] Step 4: Record what is still intentionally not solved.
- [ ] Step 5: Commit.

## Test Coverage Diagram

```text
Upload
  |- valid pdf -> processing -> complete
  |- valid pdf -> processing -> partial
  |- valid pdf -> processing -> failed
  |- invalid input -> fast reject

Result
  |- summary renders
  |- review renders
  |- parameter list renders
  |- low-confidence parameter confirm
  |- low-confidence parameter edit

Evidence
  |- click evidence -> page jump
  |- current evidence -> highlight overlay
  |- later-page evidence -> correct page target

Follow-up
  |- no result yet -> blocked
  |- result exists -> answer or boundary response
  |- out-of-scope question -> explicit limitation

Jobs
  |- processing snapshot saved
  |- complete snapshot saved
  |- failed snapshot saved
  |- missing snapshot handled

Performance / resilience
  |- timeout path
  |- bad file fast reject
  |- weak text -> partial path
```

## Failure Modes To Design For

| Codepath | Realistic Failure | Test Needed | Error Handling Needed | User Sees Clear Output? |
|----------|-------------------|-------------|-----------------------|-------------------------|
| Upload submit | oversize / wrong input | yes | yes | yes |
| Job polling | job lost after restart | yes | yes | yes |
| Parser | scanned PDF yields almost no text | already partial/failed, expand | yes | yes |
| Evidence | quote matched on wrong page | yes | partial | should remain explicit |
| Follow-up | answer sounds grounded but is not | yes | yes | must be explicit |

## Opinionated Recommendation

For this MVP, the best order is:
1. guardrails
2. honest follow-up boundary
3. durable jobs
4. parser quality

That order matches the real trust boundary:
- first stop obviously bad input
- then stop fake intelligence
- then stop losing work
- then improve result quality

## Exit Criteria For “MVP Still OK”

Treat the MVP as ready for broader external testing only when all of these are true:
- bad uploads fail fast with specific user messaging
- follow-up behavior is honest or grounded
- jobs survive beyond one process lifetime
- parser partial / failed states remain explicit
- full test suite, typecheck, and build all pass
