# Export Status Clarity Design

## Goal

Make every export format preserve the full parameter set and communicate trust state consistently, so users can tell which fields are confirmed, still need review, or were corrected by a human without switching back to the live workspace.

## Scope

This design only covers:

- export status presentation for `CSV`, `HTML`, `Word`, `PDF`, and `JSON`
- the shared export view model used by `lib/exports.ts`
- focused export regression tests in `tests/exports.test.ts`

This design does not cover:

- workspace interaction changes
- new export formats
- evidence layout redesign
- runtime attribution field expansion
- audit or job-snapshot schema changes

## Why This Shape

The current export behavior drifts away from the workspace trust loop in two ways:

1. `CSV` drops `needs_review` rows entirely, which makes incomplete results look more certain than they are
2. the remaining export formats keep status data, but they do not present it consistently or readably for a human operator

The smallest credible fix is therefore:

- keep the existing export surface
- keep the existing `AnalysisDocumentViewModel` as the single export source of truth
- add one shared display label for parameter status
- stop filtering out review-needed rows

This keeps trust signals aligned without redesigning exports from scratch.

## User Outcome

After this change, an operator exporting any analysis artifact should be able to:

1. see every extracted parameter, including review-needed ones
2. understand the trust state in human-readable Chinese across all formats
3. keep using JSON as a machine-readable contract without losing the original status enum

## Design

### Shared Export Status Contract

Extend `AnalysisDocumentViewModel.parameterRows` with a display-oriented `statusLabel` field while preserving the existing machine-readable `status` field.

Use one shared mapping for human-readable export status:

- `confirmed` -> `已确认`
- `needs_review` -> `待确认`
- `user_corrected` -> `人工修正`

The export builders should consume this single display label instead of translating statuses independently.

### CSV Export

`CSV` should export every parameter row and make status explicit as its own column.

New shape:

- header: `参数,值,状态`
- all rows included, even when `status === "needs_review"`

Example:

- `输入电压,4.5V to 36V,已确认`
- `封装,SOT-23-THN,待确认`

### HTML Export

Keep the current parameter table structure, but render the status column with the shared Chinese `statusLabel` instead of raw enum values.

Evidence rendering remains unchanged in this slice.

### Word And PDF Export

Keep the current linear parameter section, but replace machine-like bracketed enums with readable Chinese labels:

- `- 输入电压: 4.5V to 36V（已确认）`
- `- 封装: SOT-23-THN（待确认）`

This keeps the export compact while making trust state obvious in the main report body.

### JSON Export

Keep the existing machine-readable `status` field unchanged for compatibility.

Also include `statusLabel` on each exported parameter row so downstream consumers or manual readers do not need to recreate the translation layer.

This design intentionally does not add a second summary schema or replace the current `parameterRows` structure.

## Testing Strategy

- update `tests/exports.test.ts` so the CSV contract expects:
  - header `参数,值,状态`
  - inclusion of `needs_review` rows
  - Chinese status labels
- add a focused regression that proves `PDF`, `Word`, `HTML`, and `JSON` all expose the same parameter status semantics
- keep adjacent verification narrow:
  - `npm test -- tests/exports.test.ts`
  - `npm test -- tests/analysis.test.ts tests/workspace.test.tsx tests/exports.test.ts`

## Risks

- JSON consumers that compare exact serialized output may need test updates because `parameterRows` will gain `statusLabel`
- CSV readers that assumed a two-column shape will need to accept the explicit status column
- broadening exports to include review-needed rows may surface more incomplete data, but that is the intended trust correction

## Recommended Delivery

Ship one narrow patch that:

1. adds the shared `statusLabel` to the export view model
2. updates all export builders to render full parameter sets with explicit status labels
3. rewrites export tests around the new trust contract
