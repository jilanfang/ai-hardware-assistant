# Design: Phase 1 Alignment for Pin2pin Atlas

> Historical strategy discussion.
>
> This file captures the broader March 28 exploration, including screenshot/capture directions that are no longer active in this repository.
> Keep for context only, not as the current source of truth.

Generated on 2026-03-28  
Branch: unknown  
Repo: ai-hardware-assistant  
Status: DRAFT  
Mode: Startup

## Problem Statement

The long-term goal is to build an entry point for electronics engineering workflows, not a single-feature PDF tool.

The immediate risk is scope drift. Current user research now spans:

- deep datasheet reading
- parameter comparison
- test screenshot to Excel entry
- test report drafting
- FA support with X-Ray and decap images
- meeting-note-to-document updates
- generic document formatting and office automation

These are not one product. If treated as one product now, trust will stay low and repeated usage will not form.

## Demand Evidence

The strongest evidence is not abstract AI interest. It is repeated time loss in narrow, recurring workflows:

- Hardware and test engineers spend large amounts of time extracting, checking, and rewriting information from datasheets, Excel, screenshots, and internal templates.
- Datasheet-heavy work remains painful because key facts are buried across long English PDFs, footnotes, family manuals, and errata.
- Test engineers repeatedly transcribe screenshot or instrument values into Excel by hand, sometimes with two people collaborating just to read and type.
- Reddit feedback shows a stable pattern: engineers will use AI to accelerate reading, comparison, formatting, and debugging, but only if the output is traceable and easy to verify.
- Roughly 60% of the Reddit comments explicitly reject black-box answers and require references, source jumps, or manual validation.

This means the product wedge is real, but the trust model is strict: assist verification, do not replace judgment.

## Status Quo

Today the user workflow is still a manual stack:

- public datasheets
- Ctrl+F and repeated PDF scanning
- manual Excel extraction and comparison
- screenshots copied into reports
- FAE or senior engineer back-and-forth
- ad hoc AI usage for wording, summarization, or brainstorming

This workflow is familiar and cheap, but slow, error-prone, and difficult to audit.

## Premises

1. The first phase must optimize for verifiable assistance, not autonomous judgment.
2. The right unit of scope is a narrow workflow slice, not a broad engineer copilot.
3. The two strongest validated input types are:
   - datasheets and related reference documents
   - test screenshots, test data, and reporting templates
4. Generic office-automation requests are adjacent noise unless they directly support electronics workflows.
5. The long-term platform can still become an electronics workflow entry point, but phase 1 must win on one repeated trust-building loop.

## Approaches Considered

### Approach A: Deep Reading Core

Summary: Focus phase 1 on evidence-backed datasheet reading and comparison. The product becomes the fastest way to ask grounded questions, extract key parameters, and verify them in source PDFs.

Effort: M  
Risk: Low

Pros:

- Already aligned with the current repo and shipped interaction model.
- Strong Reddit support for source-linked reading, references, and table extraction.
- Natural fit for the current three-column workspace and task-thread UI.
- Easier to keep trust high because every result can point back to source evidence.

Cons:

- Risks becoming a better PDF reader rather than a true workflow entry point.
- Does not directly solve the daily structured-output pain in testing workflows.
- Comparison and selection use cases still carry accuracy risk if evidence quality is weak.

Reuses:

- current upload -> analysis -> evidence jump flow
- current task-thread UI
- current parser/evidence model
- current DigiKey-aligned field naming work

### Approach B: Capture-to-Structured Output Core

Summary: Focus phase 1 on test screenshots, instrument captures, and template-driven output. The product becomes a narrow assistant that converts observed results into structured Excel and first-pass reports.

Effort: M  
Risk: Medium

Pros:

- Strongest repeated pain from interviews: screenshot or instrument reading into Excel happens every day.
- Output is easy for users to verify row by row.
- Creates a direct bridge into existing artifacts engineers already use: Excel and reports.
- More clearly behaves like a workflow entry point rather than a reading aid.

Cons:

- Current repo is not yet structured around screenshot ingestion and template output.
- OCR, marker extraction, and template mapping introduce a new reliability surface.
- If extraction precision is weak, user trust collapses quickly.

Reuses:

- task-thread interaction model
- evidence-first product principle
- export-oriented UX concepts

### Approach C: Unified Evidence Workspace

Summary: Treat phase 1 as one product with two tightly related scenes: document grounding and capture grounding. The workspace remains single-threaded, but accepts either a datasheet set or a test capture set and always outputs evidence-backed structured results.

Effort: L  
Risk: Medium

Pros:

- Best match to the long-term vision of an electronics workflow entry point.
- Lets the product stay scene-based instead of role-based.
- Unifies both validated patterns under one principle: convert unstructured electronics material into verifiable structured output.
- Gives a cleaner long-term platform story without jumping to full copilot scope.

Cons:

- Highest product design burden: easy to become vague or overloaded.
- Requires strong discipline to avoid adding unrelated office-style automation.
- More architectural work now than either narrow wedge alone.

Reuses:

- current evidence-first workspace
- current chat-thread task flow
- current PDF evidence and parameter validation UI
- future export and template concepts

## Recommendation

Choose **Approach C**, but implement it with **Approach A as the first shipped slice** and **Approach B as the next validated slice**.

This is the correct balance because:

- Approach A is the lowest-risk lake to boil in the current repo.
- Approach B is the strongest next wedge for repeated operational use.
- Approach C keeps the product narrative coherent: one evidence workspace, two scene types, zero generic office drift.

In practical terms, this means:

1. Keep the current product story centered on evidence-backed datasheet understanding.
2. Explicitly define the platform principle as: `turn unstructured electronics material into verifiable structured output`.
3. Add screenshot-to-structured-output as the next scene only after the current datasheet trust loop is strong.

## Phase 1 Product Boundary

Phase 1 should include only:

- evidence-backed datasheet reading
- evidence-backed parameter extraction
- evidence-backed parameter comparison where sources are visible
- test screenshot or capture to structured values
- template-aligned first-pass outputs such as Excel rows or report drafts

Phase 1 should explicitly exclude:

- generic PPT generation
- generic Word formatting
- paper classification
- broad office automation
- black-box part recommendation without traceable sources
- autonomous schematic review
- broad “AI engineer” messaging

## Product North Star

The product should be described as:

`A verifiable electronics document and data assistant that helps engineers turn datasheets and test captures into grounded, structured outputs.`

This is narrower than the long-term vision, but it is on the path to it.

## Frontend Implications

The current frontend direction is mostly correct if the product is kept narrow:

- left side: task history and current work item
- middle: primary evidence canvas
- right side: single threaded task flow with timeline, extracted results, validation actions, and follow-up

The key UI rule is:

Every meaningful output must stay inside the same task thread and remain tied to evidence, not detached cards.

Persona expansion should happen inside this same shell. Do not create separate role-first homepages, extra persona cards, or button-heavy branching UI for procurement, sales, testing, or engineering.

## What This Means for “Are We Reaching the Original Intention?”

Short answer: **partially yes**.

Yes:

- The work is still moving toward an electronics workflow entry point.
- The trust-first model is increasingly correct.
- The current UI direction is closer to a real working surface than a marketing demo.

Not yet:

- The product is still closer to a narrow assistant than a true workflow entry point.
- The active repo backlog still over-indexes on DigiKey taxonomy and single-PDF parsing quality, which supports the wedge but does not yet prove the larger workflow thesis.
- The broader workflow story is still too wide unless scene boundaries are explicitly enforced.

## Immediate Next Steps

1. Rewrite the top-level product sentence everywhere around the unified evidence-workspace framing.
2. Keep the current repo focused on boiling the datasheet trust loop completely.
3. Define the next slice as screenshot-to-structured-output, not generic automation.
4. Reject any feature request that does not help users verify electronics material faster.

## Open Questions

- Should multi-document grounding be included in the current datasheet slice before screenshot ingestion starts?
- Which structured output should be first for the testing slice: Excel export, report draft, or both?
- Is the next external validation milestone daily repeated usage or first paid pilot behavior?

## The Assignment

Use this document to make one explicit product decision:

`Pin2pin Atlas phase 1 is one evidence workspace with two scene types, but only the datasheet scene ships first.`

If that sentence is accepted, every active backlog item and every UI decision should be filtered against it.
