# Task Snapshot: Phase 21 Runtime Attribution And Datasheet Trust Loop

## Metadata
- Snapshot ID: 20260331-191933-phase21-runtime-attribution-observability
- Saved At: 2026-03-31 19:19 CST
- Project Path: /Users/jilanfang/ai-hardware-assistant
- Snapshot Path: .task-archive/snapshots/20260331-191933-phase21-runtime-attribution-observability.md

## Goal
Ship phase 1 of the evidence workspace as a datasheet-only product by finishing the datasheet trust loop and keeping runtime trust cues honest.

## Success Criteria
- One uploaded datasheet can produce a grounded first-pass result with evidence-linked parameters and summary.
- `processing`, `partial`, `failed`, and delayed states feel materially different and understandable to the user.
- The runtime can explain which `provider/model` handled the task and whether the job used PDF direct or fallback modality.
- Exported artifacts preserve the same trust-relevant runtime context visible in the workspace.

## Scope
- Keep the product shell focused on one datasheet evidence workspace.
- Treat DigiKey and Mouser only as supporting calibration or data inputs, not standalone product tracks.
- Keep runtime explainability in the existing `sourceAttribution` contract rather than introducing a second metadata layer.
- Do not widen scope into generic office-assistant behavior.

## Current Phase
Phase 21: datasheet trust-loop hardening on top of relay-backed PDF direct routing, with datasheet deep reading as the only in-scope shipped scene.

## Completed
- Added relay-aware `provider/model` routing and reusable benchmark tooling.
- Made `ANALYSIS_PIPELINE_MODE=single` the default while preserving optional `staged` orchestration.
- Extended runtime attribution across backend results, workspace rendering, exports, and observability logs.
- Preserved `llmTarget`, `documentPath`, and `pipelineMode` on staged completed results instead of dropping them at final handoff.
- Hardened the workspace so sparse legacy attribution does not render the misleading `未记录模型 · 路径未知 · unknown` placeholder.
- Strengthened the completed-state regression test so it positively asserts the concrete staged runtime note.
- Refreshed the task archive pointer so future restore flows land on the active Phase 21 state instead of the older DigiKey checkpoint.

## Remaining
- Finish the datasheet trust loop around evidence-linked reading, grounded extraction, honest degraded states, and export clarity.
- Finish private-beta readiness around deploy runbook, account provisioning, audit reporting, and docs cleanup.
- Run more real-PDF benchmark scenarios beyond UPF5755 so routing recommendations are not based on one sample only.
- Decide whether staged mode stays an internal verification tool or later becomes an explicit operator-facing experiment flag.

## Decisions
| Decision | Rationale |
|----------|-----------|
| Keep `sourceAttribution` as the shared runtime explainability contract | It already spans backend results, workspace UI, exports, and follow-up behavior; adding another attribution object would drift. |
| Preserve the same runtime fields on complete, partial, and failed states | Trust cues need to stay honest in degraded paths, not only on the happy path. |
| Hide sparse legacy runtime notes instead of rendering placeholder unknown values | Placeholder diagnostics look like a broken system and reduce trust. |
| Use positive assertions for completed-state runtime-note regressions | The concrete user-visible trust cue must be protected directly in tests. |

## Findings
- Relay provider choice, document path, and pipeline mode are more important trust facts than a bare model name.
- The staged completed-result handoff had been drifting from the repo's trust contract even though partial and failed states already preserved richer attribution.
- A negative-only UI regression test was too weak to prove the runtime note still rendered after a refactor.
- The planning files had become more current than `.task-archive/current.md`, which meant restore could silently roll work back to Phase 19 unless a fresh checkpoint was saved.

## Blockers
- No checkpoint blocker remains after this save.
- The remaining blocker is product-level prioritization inside the datasheet trust loop, especially degraded-state honesty and export clarity.

## Next Actions
- Tighten the datasheet trust loop around evidence-linked reading, grounded extraction, and honest degraded states.
- Finish private-beta readiness and verify the deploy path on the target server.
- Expand benchmark coverage to more real datasheets and compare routing conclusions across categories.

## Touched Files
- /Users/jilanfang/ai-hardware-assistant/lib/server-analysis.ts
- /Users/jilanfang/ai-hardware-assistant/components/workspace.tsx
- /Users/jilanfang/ai-hardware-assistant/tests/analysis.test.ts
- /Users/jilanfang/ai-hardware-assistant/tests/workspace.test.tsx
- /Users/jilanfang/ai-hardware-assistant/tests/analysis-route.test.ts
- /Users/jilanfang/ai-hardware-assistant/tests/analysis-jobs.test.ts
- /Users/jilanfang/ai-hardware-assistant/tests/follow-up-route.test.ts
- /Users/jilanfang/ai-hardware-assistant/docs/superpowers/specs/2026-03-31-runtime-attribution-observability-design.md
- /Users/jilanfang/ai-hardware-assistant/docs/superpowers/plans/2026-03-31-runtime-attribution-observability-plan.md
- /Users/jilanfang/ai-hardware-assistant/task_plan.md
- /Users/jilanfang/ai-hardware-assistant/progress.md
- /Users/jilanfang/ai-hardware-assistant/findings.md
- /Users/jilanfang/ai-hardware-assistant/.task-archive/current.md

## Verification
| Check | Status | Details |
|-------|--------|---------|
| `npm test -- tests/workspace.test.tsx` | passed | Completed staged runtime-note regression now asserts the concrete runtime-path string with 47/47 tests passing. |
| `npm test -- tests/analysis.test.ts tests/workspace.test.tsx` | passed | Runtime attribution and workspace rendering stayed green together with 69/69 tests passing. |
| `npm test -- tests/analysis-route.test.ts tests/analysis-jobs.test.ts tests/follow-up-route.test.ts` | passed | Adjacent route, job, and follow-up trust-loop paths remained green with 23/23 tests passing. |
| Task archive pointer refresh | passed | `.task-archive/current.md` now points at this Phase 21 snapshot. |

## Restore Notes
- Rebuild `task_plan.md`, `progress.md`, and `findings.md` for the current workspace.
- If multiple snapshots exist, prefer this snapshot only when it is the active one in `.task-archive/current.md`.
