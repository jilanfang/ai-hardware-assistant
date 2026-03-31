# Single PDF Real Analysis Design

## Goal
Turn the current single-PDF chat-first prototype into a narrow MVP for first-pass datasheet reading: upload one PDF, run a real parsing/analysis job, return a Chinese summary plus key parameters and evidence anchors, then let the user validate and continue asking project-scoped questions.

## Product Scope For This Slice
- Keep the working unit to one PDF only.
- Keep the user promise to first-pass understanding, not replacement comparison.
- Keep the output focused on:
  - Chinese summary
  - engineering review
  - 3 to 6 key parameters
  - evidence-backed jumps into the PDF
  - project-scoped follow-up questions
- Keep existing export actions visible, but treat them as secondary to the real analysis loop.

## User And Journey Fit
This slice is optimized for the lowest-gap user journey already partially implemented:
- a Chinese-speaking hardware engineer uploads one English datasheet
- receives a fast first-pass explanation in Chinese
- checks a few key parameters against the source PDF
- asks deeper follow-up questions only after seeing the result

This intentionally does not try to solve multi-PDF comparison, share-page workflows, or internal review collaboration yet.

## Interaction Design
- The left chat-first column remains the primary surface.
- The right PDF panel remains a passive evidence-verification canvas.
- The first assistant card still owns upload.
- After upload, the workspace must enter an explicit processing state.
- When parsing finishes, the assistant renders one structured analysis card driven by real parsed output rather than filename seeds.
- If parsing is partial or degraded, the UI must say so directly and explain what remains trustworthy.

## Data Contract
The real analysis contract for one uploaded PDF should include:
- document identity
- parsing status: `processing | complete | partial | failed`
- summary in Chinese
- engineering review in Chinese
- key parameter list with status and evidence IDs
- evidence targets with page and rectangle coordinates when available
- warnings or degradation notes

The contract should stay narrow so the current UI can consume it without a broad rewrite.

## Architecture
- Keep the current `Next.js` app as the user-facing shell.
- Add a server-side analysis entry point instead of generating analysis entirely in the browser.
- Structure the flow as an async job shape even if the first implementation executes locally:
  - upload PDF
  - create analysis job
  - return job status
  - fetch completed analysis result
- Keep parser output normalization and UI-facing analysis shaping in pure TypeScript helpers so later parser swaps do not force UI rewrites.

## MVP Constraints
- No multi-PDF comparison.
- No share-page implementation in this slice.
- No broad category system; one narrow first-pass result contract is enough.
- No full PDF viewer rewrite.
- The first real parser path may support only a constrained set of well-formed PDFs, as long as degraded states are explicit.

## Success Criteria
- A real uploaded PDF can move through processing into a non-mock analysis result.
- The result-first chat screen continues to work with real output.
- Evidence clicks still update the PDF panel.
- The UI clearly communicates `processing`, `partial`, and `failed` states.
- Existing tests are extended so this behavior is verified rather than assumed.
