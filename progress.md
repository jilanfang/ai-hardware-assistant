# Progress Log

## Checkpoint Summary

- Snapshot ID: 20260331-191933-phase21-runtime-attribution-observability
- Saved At: 2026-03-31 19:19 CST
- Project Path: /Users/jilanfang/ai-hardware-assistant
- Current Phase: Phase 21 datasheet trust-loop hardening on top of relay-backed PDF direct routing, with datasheet deep reading as the only in-scope shipped scene.

## Actions Completed

- Added internal-test auth: username/password login, SQLite users and sessions, logout flow, and protected workspace/API access.
- Added SQLite audit events for login, analysis, follow-up, parameter writeback, and export actions.
- Added admin scripts for manual account creation/import and daily audit summary export.
- Added single-server deployment documentation for `atlas.pin2pin.ai`, `Nginx`, `systemd`, and environment setup.
- Updated the repo docs so current source-of-truth files now reflect the datasheet-only internal-test scope.
- Moved the capture-scene PRD out of the active product docs and into archive.
- Restored the active checkpoint from `.task-archive/current.md` and backed up the previously active planning files.
- Reconciled the archive mismatch between the older snapshot body and the newer project state.
- Confirmed current repo state includes DigiKey-aligned field naming and the LDO grounded category.
- Hardened the DigiKey taxonomy fetch contract so default local generation stays fixture-backed even if a stale `DIGIKEY_CF_CLEARANCE` is present.
- Added script tests covering both fixture-first default behavior and explicit live-refresh failure behavior.
- Corrected the active task framing after user clarification: DigiKey is a one-time taxonomy calibration input, not an ongoing product line or recurring workstream.
- Restored the repo-level source of truth to the datasheet trust loop, and later removed the capture-next framing from active repo scope.
- Ran a real browser smoke on `http://127.0.0.1:3111` with `tmp-SKY85755-11.pdf`.
- Verified the real flow reaches `已完成` and renders the processing timeline, DigiKey-aligned RF parameters, review-needed actions, export actions, and follow-up composer in one task thread.
- Verified the current SKY85755 smoke does not show an evidence-jump bug: the clicked RF evidence remained on page 1 because the extracted quote is actually on page 1 in the real PDF text.
- Hardened failed-state trust-loop behavior so a failed scanned/no-text-layer PDF can keep source-specific warning copy and failed-analysis summary/review in the task thread instead of collapsing to one generic retry message.
- Tightened analysis job lookup semantics by recording each job's store directory, so snapshot reads and writebacks no longer depend on whichever analysis store env var happens to be active later.
- Isolated `analysis-route` tests onto per-test temporary job stores so route verification no longer flakes when other suites mutate `ANALYSIS_JOB_STORE_DIR`.
- Investigated the real `S55643-51Q.pdf` case and confirmed the page-count disagreement was not fabricated by the parser: both `pdfjs` and macOS metadata report 43 pages for that file, while the workspace UI had still been showing the hard-coded upload default `26`.
- Fixed the workspace preview toolbar to adopt the analyzed `Document pages` value after results arrive instead of keeping the stale upload default.
- Added a narrow cellular-PAM extraction path for the real `S55643-51Q` datasheet so the analysis now surfaces actionable fields such as package, RFFE bus, maximum linear output power, and supported bands instead of only a page count plus weak generic matches.
- Added a fixture-first Mouser `RF Front End` scraper that emits `JSON`, `CSV`, and resumable progress state from a category page plus detail-page HTML.
- Captured fresh Mouser category/detail fixtures through a real browser session because direct HTTP requests in this environment returned denied pages while browser rendering succeeded.
- Promoted relay provider selection to a first-class runtime concept instead of treating `openai` or `gemini` as the only real providers.
- Added peer relay providers in code and docs:
  - `lyapi`
  - `vectorengine`
- Switched the analysis runtime to explicit `provider/model` selection so `lyapi/gpt-4o` and `vectorengine/gpt-4o` are treated as distinct targets.
- Landed the reusable model benchmark system:
  - benchmark core in `lib/model-benchmark.ts`
  - scenario-driven runner in `scripts/model-benchmark.ts`
  - checked-in scenario in `config/benchmarks/upf5755-report.json`
- Standardized the quality baseline to:
  - `lyapi/gemini-3.1-pro-preview = 100`
- Captured the current practical routing recommendation from the real UPF5755 benchmark and manual review:
  - fast parameters: `lyapi/gpt-4o`
  - full report: `lyapi/gemini-3.1-pro-preview`
  - first fallback: `lyapi/gpt-4.1`
  - second fallback: `vectorengine/gpt-4.1`
- Added `ANALYSIS_PIPELINE_MODE=single|staged`:
  - `single` is now the default runtime
  - `staged` remains available for fast-parameters + full-report + arbitration orchestration
- Updated workspace timeline handling and backend orchestration so the UI and server both understand the single-vs-staged split.
- Resynced top-level engineering and ops docs so they now match the current relay-backed PDF-direct path, benchmark workflow, and optional staged mode.
- Removed leaked API keys from the checked-in benchmark artifact and tightened artifact hygiene guidance in docs.
- Extended `sourceAttribution` into the shared runtime explainability contract across backend, UI, exports, and observability.
- Analysis results now preserve `llmTarget`, `documentPath`, and `pipelineMode` for complete, partial, and failed states instead of only coarse provider metadata.
- Workspace task-thread states now show a concise runtime note that explains the selected `provider/model`, PDF-direct vs fallback path, and whether the note is diagnostic or still incomplete.
- Exported JSON and HTML artifacts now carry the same runtime explainability fields shown in the workspace so trust-loop verification stays aligned outside the app.
- Observability payloads now include the richer runtime attribution fields at pipeline start so provider/model and document-path behavior can be inspected from logs.
- Staged completed analysis results now preserve the same runtime attribution fields as partial and failed states instead of dropping `llmTarget`, `documentPath`, and `pipelineMode` at the final handoff.
- Analysis observability logs now carry consistent runtime fields after document preparation, including staged partial and completed events, so provider/model, document path, and pipeline mode can be read from one line.
- The workspace no longer renders the misleading fallback note `未记录模型 · 路径未知 · unknown` when an older snapshot carries only sparse attribution.
- Tightened the completed-state workspace regression so it now asserts the concrete staged runtime note instead of only asserting the broken placeholder is absent.
- Saved a fresh Phase 21 checkpoint so `.task-archive/current.md` now points at the active datasheet trust-loop state instead of the old Phase 19 DigiKey snapshot.
- Export builders now preserve the full parameter set across CSV, HTML, Word, PDF, and JSON instead of hiding `needs_review` rows in CSV.
- Export outputs now use one shared Chinese trust label set: `已确认 / 待确认 / 人工修正`, while JSON still preserves the original machine-readable `status` enum.
- Delayed workspace tasks now preserve already-earned staged progress instead of falling back to the single-pipeline timeline after polling ages out.
- Added production preflight hardening so real-server startup now checks required secrets, storage paths, provider config, and path writability before `next start`.
- Production session handling no longer silently falls back to `dev-session-secret`; local development keeps the old fallback only outside production.

## Next Actions

- Finish the datasheet trust loop around evidence-linked reading, grounded extraction, and clear degraded states.
- Verify the private-beta deployment path on the target server.
- Tighten backups, retention, and operational checklists around SQLite and local job snapshots.
- Run more real-PDF benchmark scenarios beyond UPF5755 so the provider/model recommendation is not anchored to a single RF FEM case.
- Add stronger runtime observability around:
  - provider/model
  - PDF-direct vs image-fallback path
  - per-stage latency
  - failure point
- Decide whether the staged mode should stay purely optional for internal operators or later surface as an explicit experiment flag.

## Files Created/Modified

- /Users/jilanfang/ai-hardware-assistant/task_plan.md
- /Users/jilanfang/ai-hardware-assistant/progress.md
- /Users/jilanfang/ai-hardware-assistant/findings.md
- /Users/jilanfang/ai-hardware-assistant/README.md
- /Users/jilanfang/ai-hardware-assistant/.env.example
- /Users/jilanfang/ai-hardware-assistant/docs/ops/atlas-private-beta-deployment.md
- /Users/jilanfang/ai-hardware-assistant/docs/archive/product/capture-scene-prd.md
- /Users/jilanfang/ai-hardware-assistant/scripts/admin-users.mjs
- /Users/jilanfang/ai-hardware-assistant/scripts/audit-summary.mjs
- /Users/jilanfang/ai-hardware-assistant/docs/superpowers/plans/2026-03-29-digikey-taxonomy-scraper-hardening.md
- /Users/jilanfang/ai-hardware-assistant/package.json
- /Users/jilanfang/ai-hardware-assistant/scripts/digikey_taxonomy/fetch_digikey_taxonomy.py
- /Users/jilanfang/ai-hardware-assistant/tests/digikey-taxonomy-script.test.ts
- /Users/jilanfang/ai-hardware-assistant/docs/superpowers/plans/2026-03-29-failed-state-trust-loop-hardening.md
- /Users/jilanfang/ai-hardware-assistant/lib/analysis-jobs.ts
- /Users/jilanfang/ai-hardware-assistant/components/workspace.tsx
- /Users/jilanfang/ai-hardware-assistant/tests/analysis-jobs.test.ts
- /Users/jilanfang/ai-hardware-assistant/tests/analysis-route.test.ts
- /Users/jilanfang/ai-hardware-assistant/tests/workspace.test.tsx
- /Users/jilanfang/ai-hardware-assistant/tests/mouser-rf-front-end-scraper.test.ts
- /Users/jilanfang/ai-hardware-assistant/scripts/mouser_rf_front_end/scrape_rf_front_end.py
- /Users/jilanfang/ai-hardware-assistant/scripts/mouser_rf_front_end/fixtures/.gitkeep
- /Users/jilanfang/ai-hardware-assistant/scripts/mouser_rf_front_end/fixtures/rf-front-end-category.html
- /Users/jilanfang/ai-hardware-assistant/scripts/mouser_rf_front_end/fixtures/rfx2401c-detail.html
- /Users/jilanfang/ai-hardware-assistant/lib/providers.ts
- /Users/jilanfang/ai-hardware-assistant/lib/model-benchmark.ts
- /Users/jilanfang/ai-hardware-assistant/lib/server-analysis.ts
- /Users/jilanfang/ai-hardware-assistant/lib/types.ts
- /Users/jilanfang/ai-hardware-assistant/lib/exports.ts
- /Users/jilanfang/ai-hardware-assistant/scripts/model-benchmark.ts
- /Users/jilanfang/ai-hardware-assistant/config/benchmarks/upf5755-report.json
- /Users/jilanfang/ai-hardware-assistant/artifacts/model-benchmark-upf5755.json
- /Users/jilanfang/ai-hardware-assistant/tests/providers.test.ts
- /Users/jilanfang/ai-hardware-assistant/tests/model-benchmark.test.ts
- /Users/jilanfang/ai-hardware-assistant/docs/superpowers/specs/2026-03-30-digikey-rf-scraper-design.md
- /Users/jilanfang/ai-hardware-assistant/docs/superpowers/plans/2026-03-30-digikey-rf-scraper-plan.md
- /Users/jilanfang/ai-hardware-assistant/docs/engineering/lyapi-model-routing-and-pdf-compatibility.md
- /Users/jilanfang/ai-hardware-assistant/docs/engineering/model-benchmarking.md
- /Users/jilanfang/ai-hardware-assistant/docs/engineering/technical-architecture.md
- /Users/jilanfang/ai-hardware-assistant/docs/engineering/2026-03-30-datasheet-analysis-path-drift-postmortem.md
- /Users/jilanfang/ai-hardware-assistant/docs/INDEX.md
- /Users/jilanfang/ai-hardware-assistant/docs/superpowers/specs/2026-03-31-runtime-attribution-observability-design.md
- /Users/jilanfang/ai-hardware-assistant/docs/superpowers/specs/2026-03-31-export-status-clarity-design.md
- /Users/jilanfang/ai-hardware-assistant/docs/superpowers/plans/2026-03-31-runtime-attribution-observability-plan.md
- /Users/jilanfang/ai-hardware-assistant/docs/superpowers/plans/2026-03-31-export-status-clarity-plan.md
- /Users/jilanfang/ai-hardware-assistant/tests/exports.test.ts
- /Users/jilanfang/ai-hardware-assistant/task_plan.md.bak-20260329-113142
- /Users/jilanfang/ai-hardware-assistant/progress.md.bak-20260329-113142
- /Users/jilanfang/ai-hardware-assistant/findings.md.bak-20260329-113142

## Verification Results

| Check | Status | Details |
| --- | --- | --- |
| `.task-archive/current.md` restore pointer | passed | Restored from the active project checkpoint and reconciled with current repo state. |
| `npm test -- tests/digikey-taxonomy-script.test.ts` | passed | Default fixture-first behavior and explicit live-refresh contract both passed. |
| `npm test -- tests/digikey-taxonomy-script.test.ts tests/digikey-taxonomy.test.ts tests/analysis.test.ts` | passed | Script contract change did not break taxonomy matching or real SKY85755-11 parsing. |
| Real browser smoke on local app | passed | Uploaded `tmp-SKY85755-11.pdf` through the live UI and reached completed analysis with thread, parameters, exports, and composer visible. |
| `npm test -- tests/workspace.test.tsx` | passed | Failed scanned/no-text-layer snapshots now keep actionable text-layer guidance visible in the task thread. |
| `npm test -- tests/analysis-jobs.test.ts tests/workspace.test.tsx tests/analysis-route.test.ts tests/analysis.test.ts` | passed | Failed-state trust-loop hardening and adjacent job/route flows are green together with 51/51 tests passing. |
| `npm test -- tests/analysis.test.ts tests/workspace.test.tsx` | passed | Real SKY85755 and real S55643-51Q parsing plus workspace page-count rendering both passed together. |
| `npm test -- tests/analysis-route.test.ts tests/analysis-jobs.test.ts` | passed | Job snapshot persistence and route writeback paths remained green after the S55643 extraction changes. |
| `npm test -- tests/mouser-rf-front-end-scraper.test.ts` | passed | Mouser fixture-backed `JSON + CSV + resume` contract is green. |
| `npm run mouser:rf-front-end -- --limit 3 --output-dir /tmp/mouser-rf-front-end-sample` | passed | Wrote sample `JSON`, `CSV`, and progress outputs from the checked-in Mouser fixtures. |
| `npm test -- tests/mouser-rf-front-end-scraper.test.ts tests/digikey-taxonomy-script.test.ts` | passed | New Mouser scraper did not regress the existing DigiKey taxonomy script contract. |
| `npm test` | passed | Full suite green after auth, audit, admin scripts, and doc-aligned behavior changes. |
| `npm run typecheck` | passed | Type checks green after adding the SQLite type package and final doc/runtime changes. |
| `npm test -- tests/providers.test.ts tests/model-benchmark.test.ts` | passed | Relay provider routing and benchmark-scoring contracts are green. |
| `npm test -- tests/providers.test.ts tests/analysis.test.ts tests/workspace.test.tsx` | passed | Runtime provider/model selection and single-vs-staged workspace behavior stayed green together. |
| `npm test -- tests/analysis.test.ts tests/workspace.test.tsx tests/exports.test.ts` | passed | Runtime explainability contract stayed green across backend, workspace, and exports with 75/75 tests passing. |
| `npm test -- tests/analysis-route.test.ts tests/analysis-jobs.test.ts tests/follow-up-route.test.ts` | passed | Adjacent trust-loop route and job flows remained green after the runtime explainability changes with 23/23 tests passing. |
| `npm test -- tests/workspace.test.tsx` | passed | Completed staged runtime-note regression now asserts the concrete `provider/model + document path + pipeline mode` string with 47/47 tests passing. |
| `npm test -- tests/analysis.test.ts tests/workspace.test.tsx` | passed | Staged complete runtime attribution, staged partial observability payloads, and the workspace runtime-note regression are green with 69/69 tests passing. |
| `npm test -- tests/analysis-route.test.ts tests/analysis-jobs.test.ts tests/follow-up-route.test.ts` | passed | Adjacent route, job, and follow-up flows remained green after the runtime observability propagation changes with 23/23 tests passing. |
| `npm test -- tests/exports.test.ts` | passed | Export status-clarity contract is green with 9/9 tests passing, including full-row CSV and cross-format status-label checks. |
| `npm test -- tests/analysis.test.ts tests/workspace.test.tsx tests/exports.test.ts` | passed | Analysis, workspace, and export trust-loop behavior stayed green together with 78/78 tests passing. |
| `npm test -- tests/workspace.test.tsx` | passed | Delayed staged jobs now keep the earned `已完成器件识别与模板选择` and `已生成首批关键参数` progress cues visible with 48/48 tests passing. |
| `npm test -- tests/analysis.test.ts tests/workspace.test.tsx tests/exports.test.ts` | passed | The pipeline-mode fallback fix stayed green across backend, workspace, and export trust-loop coverage with 79/79 tests passing. |
| `npm test -- tests/runtime-env.test.ts tests/preflight-script.test.ts tests/auth-routes.test.ts tests/auth-db.test.ts tests/providers.test.ts tests/admin-scripts.test.ts tests/middleware.test.ts` | passed | Production preflight, auth/session hardening, provider config resolution, scripts, and middleware stayed green together with 26/26 tests passing. |

## Reboot Check

| Question | Answer |
| --- | --- |
| Where am I? | A datasheet-only internal-test Atlas workspace with SQLite auth/audit, local durable analysis jobs, relay-backed PDF-direct model routing, and a reusable benchmark harness. |
| Where am I going? | Finish the datasheet trust loop, widen real-PDF benchmark coverage, and make the private-beta deployment path operationally stable. |
| What's the goal? | Help users turn one datasheet PDF into verifiable, exportable output faster than manual reading and copy/paste. |
| What have I learned? | The active engineering risk is not “which model name sounds best”, but whether the repo treats relay providers, input modality, pipeline mode, benchmark evidence, and runtime explainability as first-class source-of-truth concepts. |
| What have I done? | Added auth and audit plumbing, relay-aware runtime routing, reusable benchmark tooling, optional staged orchestration, runtime explainability across backend/UI/exports/logs, and synced the docs so active files match the current implementation. |
