# Pin2pin Atlas Interaction Details

## 1. Purpose

This document defines the interaction rules for the current datasheet workspace.

The workspace should feel like one working surface with one task thread, not a collection of feature cards.

## 2. Workspace Model

The workspace has one shell:

- far left: narrow rail for brand, nav, and current user
- left: current task, upload entry, recent tasks, and parameter navigation
- middle: evidence canvas
- right: single task thread

This repository currently uses this shell only for datasheet work.

## 3. Current Shipped Scene

The current shipped scene is datasheet deep reading.

Its entry flow is:

- upload one datasheet PDF
- start analysis immediately
- surface progress in the task thread
- land in an evidence-backed result

## 4. Task Thread Rule

Every meaningful output stays inside the same task thread:

- processing updates
- partial or failed states
- summaries
- parameters
- validation actions
- next-step prompts
- follow-up questions

No detached results, side cards, or floating secondary panels should become the primary output surface.

## 5. Result-First Rule

The product should land the user on results, not empty conversation.

For the current datasheet scene the order is:

- task progress timeline
- summary
- review or caution
- risk and review-needed items
- extracted parameters
- export block
- suggestion prompts
- follow-up composer

If the current run exposes useful trust metadata, the task thread may also show:

- current runtime path
- staged fast-pass vs full-report progress
- whether parameter reconciliation is still incomplete

## 6. Evidence Validation Rule

The core trust interaction is always:

1. user sees a result
2. user clicks to verify
3. evidence canvas moves to the source
4. user validates or corrects

This is the core interaction for the current datasheet scene.

The product should treat parameter correction as part of the trust loop, not as an edge action.

## 7. Degraded-State Rule

The user must always understand:

- whether processing is still running
- whether the result is partial
- whether the output is failed
- whether evidence is approximate
- whether a follow-up answer exceeds current grounding

The product should never hide uncertainty behind a smooth UI.

When helpful, the product should also reveal:

- whether the current result is still in fast-pass-only staged mode
- whether parameter conflicts exist between fast and full analysis
- whether a value is still marked `needs_review`

## 8. Export Rule

Exports are downstream workflow actions, not decorative controls.

They should appear only after useful content exists and should remain tied to the current task thread.

For the current build:

- JSON and HTML can export the current task result
- CSV should export only confirmed or user-corrected parameters
- the UI should make reviewed vs. unreviewed output visible before export

Export actions should preserve the distinction between:

- AI-confirmed values
- review-needed values
- user-corrected values

## 9. Follow-Up Rule

Follow-up input should stay hidden until the first useful output exists.

Follow-up answers must stay bounded by current evidence and explicitly say when the system does not know enough.

Follow-up should not erase the current trust surface. The user should still be able to see:

- which parameter row they were validating
- which evidence target is active
- whether the current answer depends on reviewed or review-needed material

## 10. Interaction Principles

- one shell
- one task thread
- evidence before confidence
- outputs before chatter
- datasheet-first scope without product sprawl
- internal-test boundary made explicit, not hidden
- trust state made explicit, not implied
- parameter truth, risks, and open questions kept in separate semantic lanes
