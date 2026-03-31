# Pin2pin Atlas MVP PRD

> Current source-of-truth PRD for this repository.
>
> Scope lock as of 2026-03-30:
> `datasheet-only`, `single PDF`, `internal-test auth enabled`, no capture workflow, no collection/community/payment/member system.

## 1. Product Background

Electronics engineers repeatedly work across long datasheets, notes, Excel sheets, internal templates, and scattered reference materials. The pain is not just reading. It is turning unstructured electronics materials into outputs that are fast to verify and ready to reuse.

The phase-1 product is therefore not a broad copilot. It is an evidence workspace.

## 2. Product Definition

This repository has one product shell and one shipped scene:

- evidence-backed datasheet deep reading

The current repository is scoped to this datasheet scene only.

## 3. Product Positioning

Pin2pin Atlas is:

- an electronics document and data assistant
- evidence-first
- scene-based instead of role-based
- built to shorten verification loops

It is not:

- a generic office automation tool
- a broad “AI engineer”
- a black-box part selector
- an autonomous schematic-review system

## 4. Core Product Principle

`Do not replace engineering judgment. Shorten the path to verification.`

This principle follows directly from user research:

- engineers will use AI for speed
- engineers will not trust unsupported conclusions
- every meaningful output must remain traceable to source evidence

## 5. Target Users

The current product is scene-driven, not title-driven. The likely users include:

- hardware engineers reading datasheets
- device evaluation engineers comparing part parameters
- test or validation engineers reading and verifying component documents
- FA or reliability engineers reviewing datasheet-grounded source material

The key filter is not job title. The key filter is whether the user is trying to verify electronics material faster.

## 6. Core User Problems

- Important information is buried in long or messy source material.
- Users lose trust quickly when AI output cannot be traced.
- Repetitive extraction and restructuring work wastes time.
- Users still need structured outputs in their existing workflow artifacts.

### Scene A Problems: Datasheet Deep Reading

- Long English datasheets are expensive to read.
- Important constraints hide in footnotes, family manuals, and related references.
- Manual parameter extraction is repetitive and easy to get wrong.
- Users need evidence-linked first-pass understanding before deeper evaluation.

## 7. Current Shipped Scope

The shipped scope in this repo is:

- upload one datasheet PDF
- run a first-pass analysis job
- produce a summary, review, and key parameters
- tie parameters and conclusions to evidence
- support grounded follow-up questions
- export the current result as JSON, HTML, or CSV
- persist recent tasks locally and reopen them
- require internal-test login before using the workspace
- record audit events for login and core task actions

## 9. Explicit Exclusions

Phase 1 explicitly excludes:

- generic PPT generation
- generic Word formatting
- paper classification
- broad office automation
- black-box part recommendations without traceable sources
- autonomous schematic review
- broad FA diagnosis automation
- screenshot / capture ingestion in this repository
- collection, community, payment, and membership features

## 10. MVP Goal

The MVP goal is to prove that users will repeatedly use one evidence workspace to:

- get grounded first-pass outputs faster than their manual workflow
- validate those outputs with clear source references
- export reusable structured artifacts

## 11. Scene A User Journey

1. Upload one datasheet PDF.
2. See explicit processing state.
3. Receive a first-pass result in one task thread.
4. Inspect evidence-linked parameters and conclusions.
5. Jump back to the source PDF.
6. Ask grounded follow-up questions.
7. Export the result.

## 12. Scene A Success Criteria

Scene A is successful if users can:

- get useful first-pass datasheet understanding quickly
- verify key values and conclusions with evidence
- trust the workflow enough to continue using it
- reuse structured results outside the product

## 13. Traceability Standard

All meaningful outputs should support fast validation.

- page-aware evidence jumps
- visible location context
- source-linked parameters and conclusions

## 14. Current Priorities

### P0

- complete the datasheet trust loop
- maintain explicit degraded states
- improve evidence precision and extraction quality
- preserve grounded exports and follow-up behavior
- stabilize internal-test access, deployment, and audit observability

### P1

- improve datasheet parser quality and category-aware extraction consistency
- improve evidence precision and citation clarity
- tighten export and verification behavior around reviewed outputs

### P2

- limited multi-document grounding only if the single-document loop proves insufficient
- stronger structured outputs
- adjacent scene evaluation only after repeated datasheet usage is proven

## 15. Product North Star

`A verifiable datasheet evidence workspace that helps electronics engineers turn component PDFs into grounded, structured outputs.`

## 16. Open Questions

- What is the minimum acceptable evidence precision for repeated external use?
- Should the datasheet scene support multi-document grounding later, or stay strictly single-document longer?
- Which export formats matter most once datasheet trust is strong?
- What is the first repeated-usage proof point that matters more than abstract feature demand?
