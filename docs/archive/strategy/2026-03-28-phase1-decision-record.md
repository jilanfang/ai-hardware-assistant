# Phase 1 Decision Record

> Historical decision record.
>
> Parts of this file are superseded for the current repo as of 2026-03-30:
> the repository is now locked to `datasheet-only`, and `capture-to-structured-output` is no longer an active next scene for this codebase.

Generated on 2026-03-28

## Purpose

This file records the main product decisions reached across the phase-1 office-hours discussion so the repo does not regress into older, broader, or conflicting narratives.

## Confirmed North Star

The long-term goal remains:

`Become an entry point for electronics engineering workflows.`

This is a long-term platform direction, not the current phase-1 product definition.

## Confirmed Phase-1 Definition

Phase 1 is:

`An evidence workspace that helps users turn electronics source material into verifiable structured outputs.`

At the time of writing, phase 1 was framed as two scene types:

- shipped first: datasheet deep reading
- planned next: capture-to-structured-output

Current repo status:

- only datasheet deep reading remains in active scope

## Confirmed Product Principle

`Do not replace engineering judgment. Shorten the path to verification.`

## Confirmed Scope Rule

Do not expand into broad generic office automation.

Phase 1 should reject:

- generic PPT generation
- generic Word formatting
- paper classification
- broad office helper positioning
- black-box engineering recommendations

## Confirmed Persona Rule

Personas matter for value testing and prioritization, but not for UI branching.

This means:

- support multiple personas
- do not build persona-specific homepages
- do not add persona-specific card stacks outside the task thread
- do not add role-first button clusters

The same AI-native interface should support different personas through:

- uploaded material
- task context
- summaries
- follow-up prompts
- exports

## Confirmed Persona Priority

Current priority order:

1. Solution / Hardware Engineer
2. Test / Validation Engineer
3. Component / Alternative-Evaluation Specialist
4. Sales / FAE / Customer-Support Engineer
5. Procurement / Supply Chain / Sourcing Support
6. Junior Engineer / Cross-Functional Learner

This is a prioritization order, not an exclusion list.

## Confirmed Journey Set

The repo should retain awareness of at least these journeys:

1. First-pass datasheet understanding
2. Parameter verification and comparison
3. Test capture to structured output, historical only
4. Test result to report draft, historical only
5. Procurement-facing summary
6. Customer-ready application summary
7. Guided learning and escalation

Not all of them need to be built now.

## Confirmed Frontend Rule

The frontend should stay AI-native and unified:

- left: task history and current work item
- middle: evidence canvas
- right: single task thread

All primary outputs stay inside the thread.

No detached result cards should become the main interaction model.

## Confirmed Execution Order

1. Finish the datasheet trust loop.
2. Keep parser/taxonomy work in service of that loop.
3. Historical: prepare the capture scene as the next narrow slice.
4. Current reading: only expand into adjacent evidence-verifiable workflows if the datasheet loop proves repeated usage first.

## Operational Filter

Every candidate feature should be tested against one question:

`Does this help a user verify electronics material faster without asking them to trust a black box?`

If the answer is no, it should not be phase-1 work.
