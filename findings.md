# Findings & Decisions

## Requirements

- The active product goal is the phase-1 evidence workspace, not a DigiKey taxonomy project.
- Datasheet outputs must stay grounded, evidence-linked, and faster to verify than manual Ctrl+F plus copy/paste.
- Progress must remain resumable from project files without relying on old chat context.

## Scope Notes

- Datasheet deep reading is the current shipped scene.
- Capture-to-structured-output is the next planned scene.
- DigiKey remains in scope only as a supporting taxonomy calibration layer for grounded extraction.
- Frontend redesign is not part of this checkpoint.

## Research Findings

- DigiKey category structures and field names are useful as an external reference point for normalizing parser output.
- Treating DigiKey as an ongoing backlog item or monitoring target pulls the repo away from the actual product wedge.
- Default local taxonomy generation becomes brittle if the script auto-prefers any ambient `DIGIKEY_CF_CLEARANCE`; fixture-first behavior is the stable contract.
- Real SKY85755-11 parsing remains solid after the taxonomy-aligned field-name refactor.
- A real app-level smoke with `tmp-SKY85755-11.pdf` now confirms the current datasheet scene hangs together end to end: upload, processing timeline, completed summary, parameter actions, exports, and follow-up composer all appear in one task thread.
- The suspected evidence-jump issue in that smoke was a false alarm: the clicked RF quotes for the real SKY85755 result are grounded on page 1 in the extracted PDF text, so staying on page 1 was consistent with current evidence mapping.
- The stronger near-term product question is whether the datasheet trust loop feels complete enough before capture ingestion begins.
- The job layer was already preserving source-specific failed warnings returned by analysis; the real failed-state trust gap sat in the workspace, where failed snapshots were discarding `snapshot.analysis` and therefore hiding more actionable summary/review guidance.
- Reading jobs by scanning whichever store cache happened to exist was too implicit for mixed test contexts; routing and writeback behavior are more stable when each job keeps an explicit store-directory association.
- `analysis-route` tests need isolated temporary job stores because the route layer depends on shared filesystem-backed job state.
- In the real `S55643-51Q.pdf` sample, `43` is the value returned by both `pdfjs` and macOS metadata, so the observed `43 vs 26` conflict came from the UI keeping a stale hard-coded upload default rather than from the parser inventing page 43.
- The more important defect in that sample was extraction coverage: the document is a cellular PAM/PA datasheet, which sat outside the repo's existing WLAN FEM / DC-DC / LDO-first patterns, so the old parser fell back to weak generic matches like `Switching frequency = 26 MHz`.
- A lightweight cellular-PAM extraction path is enough to recover several high-value first-pass fields from the real S55643 sample without reopening DigiKey as a main workstream.
- In this environment, direct requests to both DigiKey and Mouser can be blocked or denied even when a real browser session still renders the supplier pages successfully.
- For Mouser specifically, browser-rendered fixtures were enough to stand up a useful sample-first scraper for the `RF Front End` category without solving live anti-bot bypass in the first implementation.
- The runtime explainability gap was not a missing new status model; the repo already had the right spine in `sourceAttribution`, but it needed richer fields and end-to-end surfacing.
- Injected test providers in this repo intentionally identify as `custom/...`, so tests that expected `openai/...` were asserting the wrong contract.
- `documentPath` must be derived from actual runtime and preparation choices, not from incidental buffer shape or upload assumptions, otherwise failed and partial states misreport their provenance.
- Partial-state runtime notes must render at the task-thread level, not only inside the normal analysis summary bubble, because partial flows intentionally suppress some completed-result content.
- The staged final-result path had drifted from the trust contract: partial and failed states preserved rich runtime attribution, while the completed staged handoff silently dropped `llmTarget`, `documentPath`, and `pipelineMode`.
- Rendering a sparse `sourceAttribution` object verbatim in the workspace creates a worse trust cue than hiding it, because `未记录模型 · 路径未知 · unknown` looks like a broken system rather than an intentionally unavailable diagnostic note.
- For trust cues in the workspace, a regression test needs one positive assertion for the concrete user-visible string; checking only that a broken placeholder disappeared is too weak to catch future regressions.
- An export that silently drops `needs_review` rows is a trust regression, because it makes the artifact look more certain than the live workspace state.
- Export status translation is less error-prone when one shared `statusLabel` is added to the export view model, instead of having each builder translate enums independently.
- The simplest observability improvement is to reuse one local runtime context inside `analyzePdfBuffer` and attach it to existing log events, instead of creating a second telemetry-only metadata shape.
- The workspace timeline was still inferring pipeline mode from `analysis.pipelineMode` alone, while staged runtime truth often lives under `analysis.sourceAttribution.pipelineMode`, so delayed processing snapshots could regress from staged progress back to single-pipeline labels.
- The biggest remaining gap between local development and a real single-server deploy was not architecture, but production guardrails: startup could still proceed with a dev session secret, missing storage paths, or missing provider credentials and only fail later at request time.

## Technical Decisions

| Decision | Rationale |
| --- | --- |
| Keep DigiKey-aligned field names for matched categories | They provide a better industry-grounded normalization target than custom labels. |
| Keep generated taxonomy JSON in repo as a stable supporting layer | It preserves the one-time calibration result without making live DigiKey access part of normal product operation. |
| Keep fixture-backed taxonomy generation as the default CLI behavior | Prevents stale local clearance from making normal development runs flaky. |
| Do not treat DigiKey refresh or category expansion as an active backlog item | DigiKey served its intended calibration purpose and should not distort the main execution path. |
| Restore the active source of truth to the phase-1 evidence workspace plan | The repo needs to optimize for the datasheet trust loop and next capture scene, not for taxonomy work by itself. |
| Preserve failed snapshot analysis in the workspace while still locking failed tasks out of parameter/export/follow-up interactions | Users need actionable diagnosis copy in failed states, but failed outputs should not masquerade as interactive completed results. |
| Index each analysis job to its owning store directory | Job reads and writebacks should resolve against the original persisted snapshot, not whichever store env var is active later. |
| Give `analysis-route` tests per-test temporary job stores | Prevent filesystem-backed job state from leaking across suites and creating false route failures. |
| After analysis returns, the workspace should derive the preview total-page counter from the analyzed `Document pages` field instead of the upload placeholder | Prevents stale UI page totals from contradicting the actual parsed result. |
| Add a narrow cellular-PAM extraction branch based on real S55643 text patterns | This sample needs package size, RFFE bus, max linear output power, and supported-band coverage that the generic parser did not provide. |
| Build the first supplier-list scraper as a fixture-first Mouser RF Front End CLI | It produces usable `JSON`, `CSV`, and resume state now, while keeping live-fetch anti-bot work out of the critical path. |
| Prefer browser-captured supplier fixtures over ad hoc live-request retries when direct requests are already returning denied pages | This keeps parser work testable and prevents anti-bot debugging from dominating the implementation loop. |
| Keep `sourceAttribution` as the shared runtime explainability contract across backend results, workspace rendering, exports, and observability | A second attribution object would drift from persisted results and break the trust loop. |
| Preserve runtime attribution on complete, partial, and failed results with the same field set (`llmTarget`, `documentPath`, `pipelineMode`) | Degraded states need honest provenance too; attribution should support diagnosis without implying completion. |
| For sparse or legacy snapshots, hide the runtime note in the workspace instead of rendering placeholder unknown values | This avoids turning incomplete metadata into a misleading trust signal while still allowing newer snapshots to show concrete runtime paths. |
| Reuse one local runtime-context object inside `analyzePdfBuffer` for both result attribution and observability logs | This keeps runtime facts aligned without introducing a second helper layer or telemetry-only contract. |
| For completed-state trust-loop regressions, assert the concrete runtime-note text in tests instead of relying on placeholder absence | Positive assertions are what protect the actual user-visible trust cue. |
| Export all parameter rows across CSV, HTML, Word, PDF, and JSON, and express trust state explicitly instead of hiding review-needed fields | A filtered export is less honest than the live workspace and breaks the trust loop. |
| Keep raw JSON `status` and add a shared `statusLabel` for display-oriented exports | This preserves machine compatibility while preventing per-format translation drift. |
| Resolve workspace pipeline mode from `analysis.pipelineMode ?? analysis.sourceAttribution?.pipelineMode` | This keeps delayed and in-flight snapshots aligned with the persisted runtime attribution contract instead of rebuilding a stale single-pipeline timeline. |
| Add a production preflight command and wire it into `npm run start` | This turns missing secrets, missing provider config, and unwritable storage paths into immediate startup failures instead of deferred runtime surprises on the server. |

## Issues / Blockers

- No DigiKey-specific blocker is active after closing that line.
- Mouser live crawling remains partially blocked at the raw HTTP layer in this environment, so the current implementation is fixture-first rather than live-refresh capable.
- The remaining real blocker is product-level: after sharpening failed-state behavior, the next trust-loop question is whether partial/degraded states and first capture-scene outputs are equally honest and easy to verify.

## Next Actions

- Tighten the datasheet trust loop around evidence-linked reading, grounded extraction, and honest degraded states.
- Lock the first capture-scene I/O contract and export target.
- Decide whether the next supplier-data step should be live Mouser refresh, another distributor, or integration of the Mouser sample output into downstream normalization work.
