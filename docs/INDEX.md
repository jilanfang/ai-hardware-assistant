# Docs Index

This is the top-level document map for the repository.

Use it to answer three questions quickly:

1. Which files are the current source of truth?
2. Which files are operational helpers or knowledge references?
3. Which files are historical and should not drive current product or engineering decisions?

## How To Read This Repo

If you are new to the repo or resuming work, read in this order:

1. [README.md](/Users/jilanfang/ai-hardware-assistant/README.md)
2. [task_plan.md](/Users/jilanfang/ai-hardware-assistant/task_plan.md)
3. [progress.md](/Users/jilanfang/ai-hardware-assistant/progress.md)
4. [docs/product/mvp-prd.md](/Users/jilanfang/ai-hardware-assistant/docs/product/mvp-prd.md)
5. [docs/product/product-design.md](/Users/jilanfang/ai-hardware-assistant/docs/product/product-design.md)
6. [docs/product/interaction-details.md](/Users/jilanfang/ai-hardware-assistant/docs/product/interaction-details.md)
7. [docs/engineering/technical-architecture.md](/Users/jilanfang/ai-hardware-assistant/docs/engineering/technical-architecture.md)
8. [docs/ops/atlas-private-beta-deployment.md](/Users/jilanfang/ai-hardware-assistant/docs/ops/atlas-private-beta-deployment.md)
9. [docs/handoff/recovery.md](/Users/jilanfang/ai-hardware-assistant/docs/handoff/recovery.md)

## Source Of Truth

These files define the current product, engineering, and operations reality for this repo.
If another file conflicts with this set, this set wins.

### Repo Entry

- [README.md](/Users/jilanfang/ai-hardware-assistant/README.md)
  - top-level scope, product boundary, commands, and primary doc links
- [task_plan.md](/Users/jilanfang/ai-hardware-assistant/task_plan.md)
  - only active execution backlog
- [progress.md](/Users/jilanfang/ai-hardware-assistant/progress.md)
  - latest checkpoint, completed work, and verification history
- [findings.md](/Users/jilanfang/ai-hardware-assistant/findings.md)
  - engineering findings and decisions that explain why the current design looks the way it does

### Product

- [docs/product/mvp-prd.md](/Users/jilanfang/ai-hardware-assistant/docs/product/mvp-prd.md)
  - current product definition and scope lock
- [docs/product/product-design.md](/Users/jilanfang/ai-hardware-assistant/docs/product/product-design.md)
  - current chat-first workspace design
- [docs/product/interaction-details.md](/Users/jilanfang/ai-hardware-assistant/docs/product/interaction-details.md)
  - current interaction contract and trust-loop behavior
- [docs/product/datasheet-dual-route-reading-strategy.md](/Users/jilanfang/ai-hardware-assistant/docs/product/datasheet-dual-route-reading-strategy.md)
  - reading methodology, prompt framing, and dual-route analysis strategy
- [docs/product-line-positioning.md](/Users/jilanfang/ai-hardware-assistant/docs/product-line-positioning.md)
  - Atlas naming and product-line boundary

### Engineering

- [docs/engineering/technical-architecture.md](/Users/jilanfang/ai-hardware-assistant/docs/engineering/technical-architecture.md)
  - current runtime architecture and implementation boundary
- [docs/engineering/lyapi-model-routing-and-pdf-compatibility.md](/Users/jilanfang/ai-hardware-assistant/docs/engineering/lyapi-model-routing-and-pdf-compatibility.md)
  - current relay routing rules and recommended provider/model split
- [docs/engineering/model-benchmarking.md](/Users/jilanfang/ai-hardware-assistant/docs/engineering/model-benchmarking.md)
  - benchmark method, scenario structure, and baseline interpretation
- [docs/engineering/2026-03-30-datasheet-analysis-path-drift-postmortem.md](/Users/jilanfang/ai-hardware-assistant/docs/engineering/2026-03-30-datasheet-analysis-path-drift-postmortem.md)
  - active historical postmortem that still explains an important drift event

### Operations

- [docs/ops/atlas-private-beta-deployment.md](/Users/jilanfang/ai-hardware-assistant/docs/ops/atlas-private-beta-deployment.md)
  - deployment, release, account provisioning, and backup path
- [docs/ops/private-beta-checklist.md](/Users/jilanfang/ai-hardware-assistant/docs/ops/private-beta-checklist.md)
  - operational readiness checklist
- [docs/handoff/recovery.md](/Users/jilanfang/ai-hardware-assistant/docs/handoff/recovery.md)
  - future-session recovery note

## Supporting References

These files help the current product, but they are not the primary definition of scope.

### Knowledge

- [docs/knowledge/rf/README.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/rf/README.md)
  - RF knowledge directory entry
- [docs/knowledge/rf/rf-overview.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/rf/rf-overview.md)
- [docs/knowledge/rf/rf-reading-method.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/rf/rf-reading-method.md)
- [docs/knowledge/rf/rf-misread-traps.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/rf/rf-misread-traps.md)
- [docs/knowledge/rf/wifi-fem.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/rf/wifi-fem.md)
- [docs/knowledge/rf/cellular-pam.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/rf/cellular-pam.md)
- [docs/knowledge/rf/rf-switch.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/rf/rf-switch.md)
- [docs/knowledge/rf/lna.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/rf/lna.md)
- [docs/knowledge/rf/pll-vco-synthesizer.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/rf/pll-vco-synthesizer.md)
- [docs/knowledge/rf/rf-transceiver.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/rf/rf-transceiver.md)
- [docs/knowledge/memory/README.md](/Users/jilanfang/ai-hardware-assistant/docs/knowledge/memory/README.md)
  - memory knowledge directory entry

### External Research

- [docs/forum-discussions/2025-07-14-eevblog-ai-datasheet-discussion-structured.md](/Users/jilanfang/ai-hardware-assistant/docs/forum-discussions/2025-07-14-eevblog-ai-datasheet-discussion-structured.md)
  - structured external discussion input

## Historical / Archived

These files are useful for context, but they should not override the active docs above.

### Archived Strategy

- [docs/archive/strategy/2026-03-28-office-hours-alignment.md](/Users/jilanfang/ai-hardware-assistant/docs/archive/strategy/2026-03-28-office-hours-alignment.md)
- [docs/archive/strategy/2026-03-28-personas-and-journeys.md](/Users/jilanfang/ai-hardware-assistant/docs/archive/strategy/2026-03-28-personas-and-journeys.md)
- [docs/archive/strategy/2026-03-28-phase1-decision-record.md](/Users/jilanfang/ai-hardware-assistant/docs/archive/strategy/2026-03-28-phase1-decision-record.md)
- [docs/archive/strategy/2026-04-01-atlas-mechanism-level-selling-points.md](/Users/jilanfang/ai-hardware-assistant/docs/archive/strategy/2026-04-01-atlas-mechanism-level-selling-points.md)
- [docs/archive/strategy/2026-04-01-atlas-strengths-gaps-roadmap-matrix.md](/Users/jilanfang/ai-hardware-assistant/docs/archive/strategy/2026-04-01-atlas-strengths-gaps-roadmap-matrix.md)
- [docs/archive/strategy/2026-04-01-forum-objections-opportunity-map.md](/Users/jilanfang/ai-hardware-assistant/docs/archive/strategy/2026-04-01-forum-objections-opportunity-map.md)
- [docs/archive/strategy/atlas-holding-pattern-2026-03-28.md](/Users/jilanfang/ai-hardware-assistant/docs/archive/strategy/atlas-holding-pattern-2026-03-28.md)
- [docs/archive/strategy/mvp-freeze-and-experiment.md](/Users/jilanfang/ai-hardware-assistant/docs/archive/strategy/mvp-freeze-and-experiment.md)

### Archived Plans And Specs

- [docs/archive/superpowers/](/Users/jilanfang/ai-hardware-assistant/docs/archive/superpowers)
  - prototype-era plans and design specs
- [docs/archive/task-history/](/Users/jilanfang/ai-hardware-assistant/docs/archive/task-history)
  - older task snapshots and progress logs
- [docs/archive/product/capture-scene-prd.md](/Users/jilanfang/ai-hardware-assistant/docs/archive/product/capture-scene-prd.md)
  - historical capture-scene product spec

## Cleanup Notes

- `docs/strategy/` and `docs/superpowers/` are no longer active top-level source-of-truth areas in this repo.
- Historical strategy and planning materials live under `docs/archive/`.
- `.DS_Store` and other Finder noise should not be checked in.
