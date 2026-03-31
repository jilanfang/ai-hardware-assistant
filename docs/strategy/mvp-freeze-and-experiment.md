# Pin2pin.ai MVP Freeze Checklist + Manual Delivery Experiment

> Historical commercial-experiment document.
>
> This file reflects an earlier wedge around replacement evaluation and manual delivery.
> It is not the current source of truth for this repository.
> Current repo scope is the datasheet-only private beta documented in:
> [README.md](/Users/jilanfang/ai-hardware-assistant/README.md),
> [task_plan.md](/Users/jilanfang/ai-hardware-assistant/task_plan.md),
> [docs/product/mvp-prd.md](/Users/jilanfang/ai-hardware-assistant/docs/product/mvp-prd.md),
> and [docs/ops/atlas-private-beta-deployment.md](/Users/jilanfang/ai-hardware-assistant/docs/ops/atlas-private-beta-deployment.md).

## Purpose
This document compresses the current product thinking into two practical outputs:
- a frozen MVP scope that the team can build against
- a manual-delivery experiment plan to validate repeated usage and willingness to pay before overbuilding

This document is intentionally operational. It sits between the PRD and implementation planning.

## Part 1: MVP Freeze Checklist

### 1. Wedge Statement
The first wedge is fixed as:

`Sell to consumption-electronics hardware engineers, in domestic-substitution and pin-to-pin replacement evaluation workflows, with evidence-backed datasheet parameter comparison, condition-difference analysis, and risk analysis reports.`

### 2. Primary User
The first target user is:
- a hardware engineer in a consumption-electronics company
- working on cost-down or domestic-substitution decisions
- responsible for comparing replacement candidates
- currently relying on datasheets, Excel, and FAE back-and-forth

### 3. Core Workflow to Serve
The first workflow is fixed as:
- identify an original chip and one or more replacement candidates
- read and compare datasheets
- extract key parameters into a comparison structure
- identify hidden condition differences, footnotes, and risks
- produce a result that can be used in internal review or further validation

### 4. Primary Inputs
MVP supports:
- original-chip datasheet PDF
- candidate replacement-chip datasheet PDF

MVP may later expand to:
- app notes
- errata
- reference designs

But these are not required for the first build.

### 5. Primary Outputs
MVP outputs are frozen as:

#### 5.1 Simplified Evaluation Report
The report is the primary reading and sharing artifact. It must include:
- chip identities
- one-sentence evaluation summary
- parameter comparison summary
- condition differences
- risk analysis
- scope/source note

#### 5.2 CSV Export
CSV is the structured reuse artifact. It is meant for copy/paste and downstream work, not in-product editing.

### 6. Evidence Standard
The MVP must support:
- evidence-backed parameter comparison
- evidence-backed condition differences where possible
- PDF jumping to relevant pages
- visible source highlighting at the practical MVP level

The first version does not need perfect cell-level precision everywhere, but it must be strong enough for users to verify important claims.

### 7. Project Model
The working unit is frozen as:
- one project for one replacement-evaluation task

That project may contain:
- one original chip
- one or more candidate chips
- multiple PDFs inside the same evaluation context

This is a refinement of the earlier "single MPN project" model for the specific replacement-evaluation wedge.

### 8. Chat Scope
The first chat scope is fixed as:
- explain extracted parameters
- explain conditions and footnotes
- explain potential mismatch or risk
- answer within the current evaluation project

The chat is not a general electronics assistant.

### 9. Share Scope
The first share artifact is:
- a read-only evaluation report page

The first share use case is:
- send the evaluation result to a colleague, lead, or FAE for review

### 10. Initial Category Scope
MVP category support remains intentionally narrow. The first implementation batch should start with the categories most relevant to replacement evaluation and easiest to compare in practice.

Current candidate categories already discussed:
- power ICs
- RF ICs
- op amps / comparators
- laser driver / optoelectronic related ICs

The exact first implementation batch still needs a final build decision, but category breadth must remain narrow.

### 11. Defensive Constraints
The MVP build must preserve:
- PDF-only first input scope
- upload/file-size/page-count controls
- long-document degradation paths
- invitation-based access
- early-bird user grouping

### 12. Non-Goals
The MVP explicitly does not try to become:
- a full electronics copilot
- a complete BOM workflow platform
- a testing/report automation suite
- a broad community-scraping intelligence product
- a full enterprise workflow automation system

### 13. Build Gate
The MVP is ready to build when the team accepts the following as frozen:
- user
- workflow
- inputs
- outputs
- evidence standard
- project model
- chat scope
- share scope
- category breadth

Any new idea that does not strengthen this wedge should be deferred.

## Part 2: Manual Delivery Experiment

### 1. Goal
The purpose of the manual-delivery experiment is to validate:
- whether engineers will actually use the result in a live replacement-evaluation workflow
- whether they come back for another evaluation
- whether they are willing to pay, reimburse, or otherwise treat the result as valuable

This experiment should happen before heavy product build-out.

### 2. Target Sample
Run the experiment with:
- 3 to 5 real hardware engineers
- ideally from consumption-electronics teams
- each bringing 1 real replacement-evaluation task

Prefer users who are:
- already under cost-down pressure
- already comparing domestic replacements
- already spending time with datasheets and Excel

### 3. Task Definition
Each experiment task should be a real evaluation job:
- one incumbent chip
- one or more candidate replacements
- real datasheet PDFs
- ideally a real decision context, not a fake demo

### 4. Manual Delivery Workflow
For each task:

1. Collect the incumbent part number, candidate part numbers, and all relevant datasheets.
2. Ask the engineer for the decision context:
- what the chip is used for
- what the critical constraints are
- what failure would mean
3. Produce three artifacts manually or semi-manually:
- parameter comparison
- condition-difference summary
- risk analysis report
4. Return the result in a form close to the future product:
- a readable report page or report-like output
- a CSV or spreadsheet-friendly comparison artifact
5. Walk through the result with the engineer and observe:
- what they trust
- what they challenge
- what they ask next
- whether they forward it internally

### 5. What to Measure
For each task, record:
- time spent producing the result
- which parts of the workflow required the most manual effort
- whether the engineer used the result in a real review or decision
- whether they asked for a second task
- whether they asked for changes in format, depth, or evidence
- whether they would pay and how

### 6. Success Signals
The experiment is successful if at least some users:
- use the result in a real evaluation workflow
- request another evaluation without being pushed
- say they would pay, expense, or justify a budget for it
- trust the evidence-backed result more than raw AI chat output

### 7. Failure Signals
The experiment is weak if users:
- say the output is interesting but do not use it
- prefer to continue with Excel plus FAE unchanged
- distrust the result even with evidence links
- cannot articulate why the report is better than their current workflow
- only want generic summarization rather than replacement evaluation

### 8. Pricing Test
Do not overfit to a final pricing model yet. Instead test:
- single-task willingness to pay
- monthly personal-subscription willingness
- internal reimbursement or manager approval likelihood

The goal is not to optimize price now. The goal is to see whether the result crosses the line from "nice" to "worth paying for."

### 9. Suggested Experiment Timeline
- Week 1: recruit 3 to 5 engineers and collect real tasks
- Week 2: deliver the first 2 to 3 evaluations manually
- Week 3: deliver the remaining evaluations and capture repeat requests
- Week 4: summarize patterns and decide whether to deepen the wedge or adjust it

### 10. Experiment Output
At the end of the manual-delivery round, produce a short summary:
- number of tasks completed
- category distribution
- average delivery time
- strongest trust objections
- strongest value moments
- repeat-usage signal
- payment signal
- final recommendation: proceed, adjust, or narrow further
