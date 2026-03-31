# Task Snapshot: Docs Cleanup And Backlog Centralization

## Metadata
- Snapshot ID: 20260325-103412-docs-cleanup-and-backlog-centralization
- Saved At: 2026-03-25 10:34 CST
- Project Path: /Users/jilanfang/ai-hardware-assistant
- Snapshot Path: .task-archive/snapshots/20260325-103412-docs-cleanup-and-backlog-centralization.md

## Goal
Reduce documentation sprawl, archive outdated planning/task-tracking files, and make `task_plan.md` the single active backlog.

## Success Criteria
- Active docs are grouped by purpose and easy to scan.
- Historical specs, plans, and task logs are archived instead of mixed into active workflow.
- Future execution can resume from `task_plan.md` plus a small set of active docs.

## Scope
- Documentation tree under `docs/`
- Root-level task tracking files
- Recovery/checkpoint metadata

## Current Phase
Phase 17: Parser And UX Hardening

## Completed
- Moved active product docs under `docs/product/`.
- Moved active technical docs under `docs/engineering/`.
- Moved active strategy and recovery docs under `docs/strategy/` and `docs/handoff/`.
- Archived obsolete specs, plans, and verbose task history under `docs/archive/`.
- Rewrote `task_plan.md` into a short centralized backlog.
- Updated README and handoff references to the new structure.

## Remaining
- Continue parser hardening and evidence precision work from `task_plan.md`.
- Tighten timeout and delayed-job UX.
- Decide whether old archive references inside historical files should ever be normalized further.

## Decisions
| Decision | Rationale |
|----------|-----------|
| `task_plan.md` is now the only active backlog | Future task execution should have one source of truth |
| `progress.md` and `findings.md` are archived instead of kept live | They were useful history, but they increased task-tracking sprawl |
| Old superpowers plans/specs stay in `docs/archive/` | Keep recoverability without treating them as active instructions |

## Findings
- The repo had too many task-tracking artifacts for the current stage.
- Most historical planning files are still useful as archive material, but not as active workflow inputs.
- Recovery quality improves when the active path is `README -> task_plan.md -> docs/handoff/recovery.md -> core code/docs`.

## Blockers
- None

## Next Actions
- Implement parser/evidence hardening from `task_plan.md`.
- Improve timeout and delayed-job UX.
- Revisit visual hierarchy and mixed-language copy after parser trust work.

## Touched Files
- README.md
- task_plan.md
- docs/product/mvp-prd.md
- docs/product/product-design.md
- docs/product/interaction-details.md
- docs/engineering/technical-architecture.md
- docs/strategy/mvp-freeze-and-experiment.md
- docs/handoff/recovery.md
- docs/archive/superpowers/
- docs/archive/task-history/
- .task-archive/current.md
- .task-archive/snapshots/20260325-103412-docs-cleanup-and-backlog-centralization.md

## Verification
| Check | Status | Details |
|-------|--------|---------|
| `npm test` | not run | This snapshot captures doc structure cleanup; code verification was not required for the move itself. |
| `npm run typecheck` | not run | Not required for doc-only structure cleanup. |
| `npm run build` | not run | Not required for doc-only structure cleanup. |

## Restore Notes
- Start from `task_plan.md`, not archived task logs.
- Use `docs/archive/` only when historical context is truly needed.
