# Capture-To-Structured-Output PRD

> Historical archive, superseded for this repository on 2026-03-30.
>
> This scene is not in the current repo scope. Atlas is currently `datasheet-only`.
> Keep this file only as historical product thinking, not as an active requirement.

## 1. Purpose

This document defines the next planned scene for the phase-1 evidence workspace.

It should stay narrow:

- source captures in
- structured values out
- review before export

## 2. Problem

In testing and validation workflows, engineers repeatedly retype values from screenshots, instrument captures, and similar artifacts into Excel or report templates.

This work is:

- high frequency
- repetitive
- easy to verify manually
- annoying enough to justify a narrow tool

## 3. Product Goal

Turn source captures into structured outputs faster than manual transcription, without asking users to trust a black box.

## 4. Input Contract

Accepted first inputs should be narrow:

- screenshot of marked test values
- instrument capture with clearly visible markers
- optional report or table template
- optional datasheet or reference values for later conclusion drafting

Do not start with arbitrary lab artifacts or every possible engineering image type.

## 5. Output Contract

The first useful outputs are:

- extracted values in structured rows
- visible source anchors for each value
- user correction before export
- export into a downstream structured artifact

Optional next output:

- a first-pass report draft based on reviewed values

## 6. User Journey

1. Upload one or more source captures.
2. The workspace creates one task thread.
3. The system extracts visible values and groups them into structured rows.
4. The user checks each extracted value against the source.
5. The user corrects wrong values where needed.
6. The user exports the reviewed result.
7. Optionally, the system drafts a report section or report shell.

## 7. Trust Requirements

This scene only works if trust is explicit:

- every extracted value must remain tied to a visible source anchor
- users must be able to review before export
- the system must not imply “correct by default”
- conclusions must be clearly based on reviewed values, not raw OCR guesses

## 8. First Export Decision

The first export target should be one of:

- Excel-first
- report-first
- both

This is still an open product decision and should be resolved before implementation starts.

## 9. Explicit Exclusions

Do not include in the first version:

- arbitrary chart understanding
- generic OCR for every office document
- full FA diagnosis automation
- autonomous testing conclusions without reviewed evidence
- broad PPT or Word automation

## 10. Success Criteria

This scene is successful if a user can:

- complete extraction faster than manual transcription
- verify values without friction
- produce a reusable structured artifact
- feel the review cost is lower than their current manual loop

## 11. Open Questions

- What capture pattern should be the first supported shape?
- Should the first export be Excel or report draft?
- Should DS reference comparison ship in v1 of this scene or after plain extraction works?
