# Task Plan

## Source Of Truth
This file is the only active backlog for execution work in this repo.

Use it for:
- current phase
- priorities
- in-progress work
- completion status

Do not create new task-tracking docs unless the user explicitly asks.

## Goal
Ship phase 1 of the evidence workspace as a datasheet-only product: finish the datasheet trust loop and keep the scope narrow.

## Current Phase
Phase 21: datasheet trust-loop hardening on top of relay-backed PDF direct routing, with datasheet deep reading as the only in-scope shipped scene.

## Active Backlog

### Now
- [x] Run one app-level smoke check to confirm the current workspace feels coherent as an evidence-first datasheet scene.
- [x] Make relay provider/model routing explicit and benchmarkable instead of assuming one native provider path.
- [x] Add a runtime switch so Atlas can default to a single-model path while keeping staged orchestration optional.
- [ ] Finish the current datasheet trust loop: evidence-linked reading, grounded extraction, honest degraded states, exportable structured output, and stronger real-runtime observability.
- [ ] Finish private-beta readiness: docs cleanup, deploy runbook, account provisioning, and audit reporting workflow.

### Next
- [ ] Improve parser quality and category-aware extraction consistency for the current datasheet scene.
- [ ] Add more real benchmark scenarios so routing decisions are not based on one UPF5755 report case only.
- [ ] Define whether the datasheet scene should remain strictly single-document or later support limited multi-document grounding.

### Later
- [ ] Reassess whether any adjacent scene deserves its own repository or a later expansion only after datasheet usage is stable.
- [ ] Reassess broader comparison, FA support, and workflow write-back only after the current datasheet scene is stable and repeatedly used.

## Datasheet Scene Exit Criteria
- [ ] One uploaded datasheet can produce a grounded first-pass result with evidence-linked parameters and summary.
- [ ] `processing`, `partial`, `failed`, and delayed states feel materially different and understandable to the user.
- [ ] Current supported families use consistent field naming and evidence jumps.
- [ ] A user can complete upload -> verify -> export without product guidance.
- [ ] The result feels faster to verify than the user’s existing Ctrl+F + copy/paste workflow.
- [ ] The runtime can explain which `provider/model` handled the task and whether the job used PDF direct or fallback modality.

## Recently Completed
- [x] Align source-of-truth docs to the phase-1 evidence workspace definition.
- [x] Replace placeholder DigiKey taxonomy with validated category-aware structures for RF FEM, switching regulators, and LDO regulators.
- [x] Refactor `lib/server-analysis.ts` to emit DigiKey-style parameter names for matched categories.
- [x] Preserve real SKY85755-11 parsing under the taxonomy-aligned output model.
- [x] Update analysis and route tests for renamed DigiKey parameter fields.
- [x] Harden the DigiKey taxonomy fetch script so normal local generation stays fixture-backed and reproducible.
- [x] Update the workspace flow to a single task-thread timeline model and align tests to it.
- [x] Complete one real app-level smoke with `tmp-SKY85755-11.pdf`: upload, processing timeline, completed analysis, parameter navigation, export actions, and follow-up composer all rendered coherently.
- [x] Make `provider/model` the runtime and benchmark source of truth across relay providers.
- [x] Add reusable benchmark core, runner, and UPF5755 scenario for relay-backed PDF direct evaluation.
- [x] Make `ANALYSIS_PIPELINE_MODE=single` the default and keep `staged` as an opt-in orchestration path.
- [x] Sync engineering and ops docs to the current relay-backed PDF direct path and benchmark conclusions.
- [x] Preserve full runtime attribution on staged completed results, strengthen runtime observability payloads, and stop rendering misleading unknown-path placeholders in the workspace.
- [x] Tighten export behavior and result clarity around reviewed vs. unreviewed output, keeping full parameter rows and explicit trust labels in every export artifact.
- [x] Preserve already-earned staged progress cues when a slow job degrades into the delayed waiting state.
- [x] Close the main local-vs-server gap by adding production preflight checks and explicit deployment hardening for secrets, provider config, and writable storage paths.

## Archive
- Historical plans and specs: `docs/archive/superpowers/`
- Historical task logs: `docs/archive/task-history/`
- Current checkpoint: `.task-archive/current.md`

## Notes
- The current product shell is one evidence workspace, not a generic office assistant or broad hardware copilot.
- Datasheet deep reading is the only in-scope scene for this repository.
- DigiKey work is a supporting one-time taxonomy calibration input, not an ongoing product track and not a monitoring target.
- Checked-in generated taxonomy remains a supporting runtime layer for grounded extraction quality, not a top-level backlog driver.
- Runtime routing decisions must be expressed as explicit `provider/model` pairs rather than bare model names.
- `single` is the default production mode; `staged` is an optional verification-oriented mode, not the always-on baseline.
- Benchmark conclusions are advisory until they are supported by more than one real datasheet scenario.
