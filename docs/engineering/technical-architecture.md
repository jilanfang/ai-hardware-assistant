# Pin2pin Atlas Technical Architecture Overview

> Current source-of-truth architecture note for this repository.
> Scope lock: datasheet-only internal-test app on a single-server-friendly stack.

## 1. Architecture Goal

The repository should support one evidence workspace for datasheet reading and verification.

## 2. Current Repo Boundary

The current repo includes:

- username/password internal-test auth
- SQLite-backed user, session, and audit storage
- one-page workspace shell
- task-thread interaction model
- single-PDF upload and analysis
- upload guardrails
- local async-job snapshots
- relay-backed LLM analysis through:
  - selectable `single` vs `staged` pipeline orchestration
  - explicit `provider/model` runtime selection
  - Gemini-native PDF direct path for `gemini-*`
  - OpenAI `responses` PDF direct path for verified non-Gemini relay targets such as `gpt-4o` and `gpt-4.1`
  - image-rendered multimodal fallback for models that still lack verified relay PDF direct support
- parser-assisted parameter extraction and evidence enhancement
- evidence generation and page jumps
- grounded follow-up behavior
- JSON, HTML, and CSV exports

It does not yet include:

- durable cloud storage
- share pages
- unrestricted generic chat
- broad office automation
- capture ingestion in this repository

## 3. Reusable Core Objects

- `UploadedPdf`
- `AnalysisJobSnapshot`
- `AnalysisResult`
- `ParameterItem`
- `EvidenceTarget`
- export artifact builders
- task-thread messages and timeline steps

These should remain the reusable foundation of the workspace rather than being treated as datasheet-only constructs forever.
These are currently used only for datasheet work in this repository.

## 4. Datasheet Scene

### Document-Grounded Datasheet Reading

Input:

- datasheet PDF
- later, possibly related reference documents

Output:

- summary
- engineering review
- extracted parameters
- evidence-linked validation actions
- grounded exports

Current implementation status: shipped in first-pass form.

## 5. Current Major Modules

- `app/page.tsx`
  - authenticated workspace entry
- `app/login/page.tsx`
  - internal-test login page
- `components/workspace.tsx`
  - shared task-thread UI and evidence canvas shell
- `app/api/analysis/route.ts`
  - submit and poll analysis jobs
- `app/api/auth/login/route.ts`
  - issue session cookie
- `app/api/auth/logout/route.ts`
  - revoke session cookie
- `app/api/audit/route.ts`
  - client-side audit ingestion for exports
- `lib/analysis-jobs.ts`
  - async-job shell
- `lib/analysis-store.ts`
  - file-backed snapshot persistence
- `lib/server-analysis.ts`
  - analysis orchestration, preparation, and degradation logic
- `lib/real-provider.ts`
  - relay-backed Gemini/OpenAI provider integration, with PDF-direct and image-fallback paths
- `lib/model-benchmark.ts`
  - benchmark scoring and provider/model aggregate ranking
- `lib/pdf-images.ts`
  - PDF page rendering to image inputs for the current provider path
- `lib/analysis-audit.ts`
  - confirm/edit provenance tracking
- `lib/auth-db.ts`
  - SQLite user, session, and audit tables
- `lib/auth.ts`
  - session cookie and authentication helpers
- `lib/audit.ts`
  - shared audit event recording
- `lib/upload-validation.ts`
  - shared upload guardrails
- `lib/exports.ts`
  - downstream artifact builders

## 6. Main Data Flow For The Shipped Scene

1. User uploads a datasheet PDF.
2. `POST /api/analysis` creates a processing job.
3. `lib/server-analysis.ts` prepares lightweight parser-side context and document metadata.
4. `lib/real-provider.ts` routes the request through the relay:
   - prefer provider-native PDF direct ingestion when the `provider/model` path is verified
   - otherwise fall back to selected-page image rendering
5. `lib/server-analysis.ts` chooses:
   - `single`: identity + full report
   - `staged`: identity + fast parameters + full report + optional arbitration
6. The UI polls for `processing`, `complete`, `partial`, or `failed`.
7. The task thread renders progress, grounded results, and warnings.
8. The user validates via evidence jumps.
9. The user asks bounded follow-up questions or exports results.
10. Core actions are recorded into audit events.

## 7. Shared Trust Architecture

Evidence is the central architectural primitive.

The system should make it possible to:

- connect every important result to source evidence
- preserve explicit degraded states
- record user confirmation and correction actions
- keep exports grounded in reviewed output

This is the trust architecture for the current datasheet scene.

## 8. Current Limitations

- domestic relay models do not yet have a verified PDF direct path in this repo
- extraction quality still depends on a mix of heuristic preparation and model interpretation
- evidence rectangles are heuristic rather than native coordinates
- auth, session, and audit storage are still single-node SQLite by design
- task objects and export logic are still centered on the current datasheet-first product
- benchmark quality is still scenario-driven and currently grounded on the UPF5755 reference case

## 9. Architectural Direction

The correct near-term direction is:

- keep the shared workspace shell stable
- improve the shared evidence model for datasheet verification
- keep the task-thread model narrow and coherent
- strengthen parser and result-shaping quality for the existing scene

## 10. Datasheet Scene Support Work

Current DigiKey taxonomy and parser work remain valid, but they should be understood as support work for the datasheet scene:

- improve category-aware extraction
- improve field naming consistency
- improve grounded comparison quality

They are not the product goal by themselves.

## 11. Recommended Next Technical Milestones

1. Finish the datasheet trust loop with better evidence precision and reliable grounded outputs.
2. Keep the workspace shell stable while making the datasheet workflow easier to verify and reopen.
3. Improve parser quality, parameter normalization, and degraded-state honesty.
4. Tighten exports and follow-up behavior around reviewed outputs.
5. Keep the single-server auth/audit/deploy path operationally boring before any infrastructure expansion.

## 12. Technical Open Questions

- What is the minimum acceptable evidence precision for external testing of Scene A?
- Should the current single-document datasheet scope stay fixed longer before any expansion?
- Which export formats matter most once the datasheet trust loop is genuinely stable?
- How much of the current `AnalysisResult` shape should be simplified or hardened for long-term datasheet-only use?
