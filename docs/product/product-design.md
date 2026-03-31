# Pin2pin Atlas Product Design v0.2

> Current design note for the shipped datasheet workspace.
> Older “chat-first single result card” descriptions are superseded by the current result-first three-column workspace plus rail.

## 1. Design Goal
The current Atlas workspace should help users quickly understand one datasheet, validate important conclusions against the source PDF, and export reviewed results.

The design must support:
- fast scanning
- evidence validation
- continued questioning
- exportable results

## 2. Overall Page Structure
The current shipped workspace uses four visual regions:
- rail: product identity, nav, signed-in user, logout
- left control column: upload, current task, recent tasks, parameter navigation
- middle evidence column: PDF preview and page-jump verification
- right task thread: timeline, summary, risk/review, parameters, export, follow-up

## 3. Control Column
The left control column should keep the user anchored around one uploaded datasheet and one recoverable task.

Current content:
- current task label derived from the uploaded file
- single-PDF upload entry
- clear upload capability statement
- recent tasks sourced from real snapshots
- top-priority parameter navigation

## 4. Task Thread
The user should not see an empty chat interface by default.

The first useful screen should prioritize:
- processing status
- structured first-pass result
- parameter review and correction
- export actions
- follow-up conversation

Recommended fixed order:
- task block and timeline
- quick summary
- engineering review and risks
- key parameter summary with confirmation/correction actions
- export row
- suggestion prompts
- follow-up transcript and composer

## 5. Simplified Parameter Summary
The parameter section inside the analysis card should only show the most useful fields for initial understanding. It should:
- vary by material category
- support evidence lookup
- stay lightweight enough for reading and validation

It should not become the full data export layer.

## 6. Export Artifacts
Full parameter reuse belongs to export artifacts, not to the in-app task thread. This separation helps:
- preserve in-app readability
- keep exports practical for engineers who need to paste results elsewhere

The current shipped export row exposes:
- JSON
- HTML
- CSV

## 7. Evidence-Linked Interaction
Every important parameter and major conclusion should support source lookup when possible. The expected interaction is:
- click a parameter or conclusion
- navigate to the PDF page
- highlight the relevant content
- preserve the current reading context

This is one of the core trust-building flows in the product.

## 8. PDF Viewer
The middle PDF viewer is not a generic reading tool. It is a source-verification panel.

It should prioritize:
- fast jump to evidence
- visible highlight of the relevant source
- support for multiple references when needed
- continued navigation back to the report or conversation

The viewer does not need membership or share-watermark logic in the current repo scope.

## 9. Follow-Up Questions
The current slice supports freeform follow-up questions after the first-pass result appears.

Over time, follow-up guidance should focus on:
- understanding
- fit/decision support
- hidden limits and risks

## 10. Access Boundary
The current shipped slice is an internal-test application with username/password access.

The UI should make that feel intentional:
- clear login page
- no fake public-sharing affordances
- no misleading collaboration surface

## 11. Key States
The design must explicitly handle:
- empty state before upload
- processing state during generation
- successful result state
- degraded/partial result state
- failure state

Users should understand what the system is doing and why a result may be incomplete.

## 12. Defensive UX
The interface should communicate product boundaries clearly:
- unsupported inputs
- oversized or long-document degradation
- result incompleteness due to poor document quality
- future share visibility and access boundaries

These constraints should feel intentional, not like random failures.
