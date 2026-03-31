# Pin2pin Atlas

`Pin2pin Atlas` is the current internal-test datasheet workspace in the `Pin2pin.ai` product line.

Its job is not to act like a generic hardware copilot. Its job is to help engineers turn unstructured electronics materials into verifiable structured outputs.

This repository currently has one product shell and one shipped scene:

- evidence-backed datasheet deep reading

## Why This Exists

Electronics engineers repeatedly lose time in the same low-leverage loops:

- reading long English datasheets
- extracting parameters and hidden conditions
- jumping between PDFs, notes, and Excel
- rebuilding first-pass outputs that still need manual verification

The problem is not lack of information. The problem is slow verification.

So the product principle is simple:

`Do not replace engineering judgment. Shorten the path to verification.`

## Phase-1 Product Definition

The current product is:

- an evidence workspace
- task-thread based
- scene-based rather than role-based
- grounded in source references and validation actions

It is not:

- a generic office automation assistant
- a broad electronics engineer copilot
- a black-box recommendation engine
- a complete BOM, testing, or FA platform

## Current Shipped Scene

The shipped scene in this repo is still the datasheet scene.

Today it supports:

- upload one datasheet PDF
- run a first-pass analysis job
- show summary, review, and key parameters in a single task thread
- jump back to PDF evidence and page-level highlights
- keep follow-up Q&A grounded in extracted evidence
- export current outputs
- gate the workspace with internal username/password login
- record basic audit events for login, analysis, follow-up, parameter writeback, and export

This is the first trust loop we are trying to boil completely.

## Current Scope Boundary

This repository is currently scoped only to datasheet PDF work.

It does not currently include:

- screenshot or instrument capture ingestion
- image-first OCR workflows
- test-report template filling
- generic structured-output automation outside datasheet reading

## Current Workflow

1. Upload one datasheet PDF.
2. Start analysis and show task progress in the right-hand thread.
3. Review extracted results and evidence-linked parameters.
4. Jump back into the source PDF to verify.
5. Ask grounded follow-up questions.
6. Export the current result.

## Product Principles

- Evidence first.
- Verification beats black-box confidence.
- One task thread per work item.
- Results stay inside the thread instead of scattering into detached cards.
- Narrow scene scope beats broad assistant scope.
- Boil the current lake before opening the next one.

## Current Repository Scope

This repository currently focuses on:

- datasheet parsing and extraction
- evidence modeling and validation UX
- task-thread interaction flow
- grounded exports
- category-aware parameter naming
- internal-test auth and audit plumbing
- relay-provider aware model routing with explicit `provider/model` combinations
- reusable model benchmark tooling for response speed and quality comparison

It does not yet include:

- multi-tenant production account infrastructure
- general office automation
- autonomous schematic review
- fully automated part recommendation
- screenshot or capture-grounded extraction
- a broad hardware workflow suite

## Product Direction

The current direction is intentionally narrower than the broader company story:

1. harden the datasheet trust loop
2. improve extraction quality, evidence precision, and reviewed export behavior
3. validate repeated internal-test usage before reopening adjacent scenes

## Key Documents

- [`docs/INDEX.md`](docs/INDEX.md): current vs historical document map
- [`task_plan.md`](task_plan.md): current active backlog
- [`progress.md`](progress.md): current recovery state
- [`docs/strategy/2026-03-28-office-hours-alignment.md`](docs/strategy/2026-03-28-office-hours-alignment.md): historical alignment discussion, now partially superseded by the datasheet-only scope
- [`docs/strategy/2026-03-28-phase1-decision-record.md`](docs/strategy/2026-03-28-phase1-decision-record.md): historical decision record with superseded items marked
- [`docs/strategy/atlas-holding-pattern-2026-03-28.md`](docs/strategy/atlas-holding-pattern-2026-03-28.md): current GTM holding pattern; keep validating the wedge, but do not move Atlas into the public acquisition funnel yet
- [`docs/product/mvp-prd.md`](docs/product/mvp-prd.md): current product requirements
- [`docs/product/datasheet-dual-route-reading-strategy.md`](docs/product/datasheet-dual-route-reading-strategy.md): dual-route datasheet reading strategy, shared methodology, prompt system, and teaching-style report contract
- [`docs/product/interaction-details.md`](docs/product/interaction-details.md): interaction rules for the workspace
- [`docs/product/product-design.md`](docs/product/product-design.md): current workspace shell and design rules
- [`docs/engineering/technical-architecture.md`](docs/engineering/technical-architecture.md): current and target architecture
- [`docs/engineering/lyapi-model-routing-and-pdf-compatibility.md`](docs/engineering/lyapi-model-routing-and-pdf-compatibility.md): verified relay model names, PDF-direct compatibility, and current routing recommendation
- [`docs/engineering/model-benchmarking.md`](docs/engineering/model-benchmarking.md): benchmark configuration, artifact schema, and current provider/model conclusions
- [`docs/ops/atlas-private-beta-deployment.md`](docs/ops/atlas-private-beta-deployment.md): single-server deployment, account provisioning, and audit reporting

## Scraper Utilities

The repository also contains fixture-first supplier scraping utilities for structured component metadata experiments.

Current available command:

- `npm run mouser:rf-front-end -- --limit 3`

This command reads from the checked-in Mouser RF Front End fixtures by default and writes:

- `lib/generated/mouser-rf-front-end-products.json`
- `lib/generated/mouser-rf-front-end-products.csv`
- `lib/generated/mouser-rf-front-end-progress.json`

Useful flags:

- `--limit <N>`: only emit the first `N` products
- `--resume`: skip product URLs already recorded in the progress file
- `--input-dir <path>`: override the fixture directory
- `--output-dir <path>`: override the output directory

## Relay Smoke Check

Before changing model routing, verify relay-side PDF compatibility:

- `npm run lyapi:pdf-smoke -- gemini ./tmp-sample.pdf gemini-3-flash-preview`
- `npm run lyapi:pdf-smoke -- responses ./tmp-sample.pdf gpt-4o`

## Model Benchmark

Atlas now treats `provider/model` as the benchmark target, not just `model`.

- run a reusable benchmark scenario:
  - `npm run benchmark:model -- --scenario config/benchmarks/upf5755-report.json`
- current production recommendation from the checked-in benchmark artifact:
  - fast parameters: `lyapi/gpt-4o`
  - full report: `lyapi/gemini-3.1-pro-preview`
  - fallback: `lyapi/gpt-4.1`
  - secondary fallback: `vectorengine/gpt-4.1`

## Pipeline Mode

Atlas now supports two runtime modes:

- `ANALYSIS_PIPELINE_MODE=single`
  - default
  - one `provider/model` produces the full result directly
- `ANALYSIS_PIPELINE_MODE=staged`
  - enables fast parameters + full report + arbitration

If you do not need fast/slow/cross-check behavior, keep the app on `single`.

## Production Preflight

Before starting the app on a real server, run:

- `npm run preflight:prod`

This checks the minimum production contract:

- `SESSION_SECRET`
- `ATLAS_DB_PATH`
- `ANALYSIS_JOB_STORE_DIR`
- primary `ANALYSIS_LLM_PROVIDER` and `ANALYSIS_LLM_MODEL`
- the corresponding provider API key
- writability of the configured SQLite and job-store paths
