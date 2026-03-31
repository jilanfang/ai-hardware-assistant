# Pin2pin Atlas Handoff and Recovery

> Current operational recovery note for the repo.
> Updated for the datasheet-only internal-test build on 2026-03-30.

## Current State
This repository is no longer in a documentation-only state, and it is no longer in a deterministic-analysis-only state either.

A working single-PDF result-first workspace is already built. The current shipped loop is:
- login with assigned username/password
- upload one datasheet PDF
- reject unsupported, empty, or oversized uploads before parsing
- create an analysis job through `/api/analysis`
- show explicit `processing`, `partial`, and `failed` states
- when polling times out, keep the job resumable instead of forcing a re-upload
- return a real first-pass analysis result from server-side parsing
- validate parameters against the evidence canvas
- persist parameter provenance and user confirmation/correction events in the analysis snapshot
- continue with result-gated follow-up questions that state their grounding boundary
- export the current result as JSON, HTML, or CSV
- record login and core task actions into SQLite audit events

The current highest-value gap is now parser quality and evidence precision, not basic UI scaffolding.

## Project Direction
`Pin2pin.ai` is the parent brand. This repository currently aligns to the `Pin2pin Atlas` product line.

The current shipped wedge is:

`Sell to consumption-electronics hardware engineers, in domestic-substitution and pin-to-pin replacement evaluation workflows, with evidence-backed datasheet parameter comparison, condition-difference analysis, and risk analysis reports.`

## What Is Already Documented
- `docs/product/mvp-prd.md`
  - current single-PDF MVP scope
  - future commercial direction
  - current top-level user journey
- `docs/product/product-design.md`
  - current result-first workspace design
  - shell structure
  - evidence-linked UI principles
- `docs/product/interaction-details.md`
  - current upload, processing, result, validation, and export flows
- `docs/engineering/technical-architecture.md`
  - current repo implementation
  - current parser stack
  - future target architecture
- `docs/ops/atlas-private-beta-deployment.md`
  - current subdomain deployment, provisioning, and audit query path
- `docs/strategy/mvp-freeze-and-experiment.md`
  - historical wedge discussion, no longer the active repo scope
- `docs/archive/superpowers/`
  - archived prototype-era specs and implementation plans
- `task_plan.md`
  - the only active execution backlog

## Current Key Decisions
- Keep PRD non-technical.
- Keep the current repo narrow around datasheet understanding, evidence validation, and reviewed export.
- Treat the current shipped UI as a result-first workspace rather than a share page.
- Treat CSV as the reviewed structured reuse artifact.
- Require evidence-linked validation wherever practical.
- Use defensive constraints early rather than broad feature scope.
- Favor a single-server architecture that can deploy and recover quickly.
- Keep execution scope to one uploaded datasheet PDF, one first-pass analysis result, and evidence-backed follow-up questions.
- Defer comparison and adjacent workflows until the single-document real-analysis loop is stable.

## Current Technical Direction
Current repo implementation:
- web app: `Next.js` app router
- auth/audit store: `SQLite`
- analysis entry: `app/api/analysis/route.ts`
- job model: local durable async-job snapshots
- parser stack: `pdfjs-dist` -> macOS `textutil` -> raw PDF-string fallback
- parser safety: extractor timeout guards plus early raw-text fallback when usable
- evidence model: page-aware anchors with heuristic rectangles
- deploy entry: `next start` behind `Nginx` on `atlas.pin2pin.ai`

Target next architecture:
- keep the single-node deploy stable first
- improve parser quality and evidence precision
- decide later whether auth/audit and job state need to leave the current local-store model

## What Is Ready
- Product wedge
- MVP output model
- Updated PRD structure
- Current user journey docs
- Manual-delivery validation plan
- High-level technical direction
- A working result-first single-PDF workspace with real server-side analysis
- `/api/analysis` async submit + polling flow
- Upload guardrails shared by UI and API
- Local durable job snapshots for processing / complete / failed states
- Parameter provenance metadata and analysis event logs stored inside job snapshots
- SQLite-backed users, sessions, and audit events
- Explicit `processing`, `partial`, and `failed` UX states
- Delayed-job UX that lets the user keep waiting on the same analysis job
- Real PDF preview with page jumps and coordinate-based evidence highlight overlay
- Result-gated follow-up UI with explicit first-pass grounding and page-level evidence references
- Test coverage for route guardrails, real analysis jobs, exports, and workspace behavior

## What Is Not Fully Frozen Yet
- Exact parameter extraction quality standard beyond the current heuristics
- Exact evidence precision standard beyond page-level jumps plus heuristic rectangles
- Durable uploaded-file storage beyond the current local workspace model
- Richer follow-up Q&A grounded in parsed document content beyond first-pass summaries
- Long-term account model beyond internal-test usernames
- Automated reporting beyond query/CLI level

None of these should block the next implementation slice.

## Recommended Next Step
The highest-value next step is:

`Harden the single-PDF real-analysis loop before expanding scope.`

That means:
1. improve parser quality and parameter extraction coverage
2. improve evidence precision beyond heuristic rectangles when possible
3. tighten timeout / delayed-job UX now that local durability exists
4. keep the existing result-first and evidence-validation UX stable
5. validate the current private-beta operational path on the target server

## Recovery Instructions
If this thread is resumed later, restore context in this order:

1. Read `task_plan.md`
2. Read this handoff file
3. Read `docs/product/mvp-prd.md`
4. Read `docs/product/product-design.md`
5. Read `docs/product/interaction-details.md`
6. Read `docs/engineering/technical-architecture.md`
7. Read `docs/ops/atlas-private-beta-deployment.md`
8. Read `app/api/analysis/route.ts`, `lib/analysis-jobs.ts`, `lib/server-analysis.ts`, and `components/workspace.tsx`
9. Read `docs/archive/` only if historical context is actually needed
10. Continue from parser/evidence hardening, operational deployment prep, or the next agreed user-facing slice

## Suggested Resume Prompt
If you want to resume later with minimal friction, use a prompt like:

`Continue Pin2pin Atlas from docs/handoff/recovery.md. Use task_plan.md as the only active backlog. The current repo is a datasheet-only internal-test app with SQLite auth/audit, local durable analysis jobs, and result-first evidence validation. Focus next on parser hardening, evidence precision, or deployment prep.`
