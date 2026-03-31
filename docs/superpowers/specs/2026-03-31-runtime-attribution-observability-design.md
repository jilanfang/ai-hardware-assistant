# Runtime Attribution And Observability Design

## Goal

Close the current datasheet trust-loop gap by making runtime attribution and observability consistent across complete, partial, and failed analysis states.

## Scope

This design only covers:

- `sourceAttribution` completeness for staged final results
- analysis observability payload consistency in `server-analysis`
- one workspace-visible runtime note regression test for completed staged results

This design does not cover:

- new UI layouts
- new export formats
- audit schema changes
- broader benchmark scenario expansion

## Why This Shape

The repository already treats `sourceAttribution` as the shared trust contract across backend results, workspace rendering, exports, and follow-up behavior. The current gap is not architectural; it is that staged final results and several observability events do not carry the same runtime fields that partial and failed states already preserve.

The smallest credible fix is therefore:

- keep using `sourceAttribution`
- keep using `logAnalysisEvent`
- fill the missing fields instead of creating a parallel runtime metadata object

## User Outcome

After this change, the operator should be able to:

1. see the same `provider/model`, document path, and pipeline mode for a completed staged result that they already see in degraded states
2. inspect logs and tell which stage failed or completed, with the same runtime target/path fields attached
3. trust that exported or resumed analysis snapshots are describing the same runtime facts as the live workspace

## Design

### Shared Runtime Attribution

For staged final completion, preserve the same `sourceAttribution` fields already used by single-mode completion and staged partial states:

- `mode`
- `llmProvider`
- `llmTarget`
- `searchProvider`
- `documentPath`
- `pipelineMode`

The staged final result should not downgrade to a partial attribution shape.

### Observability Contract

The analysis pipeline logs should consistently include the runtime fields that matter for diagnosis:

- `llmTarget`
- `documentPath`
- `pipelineMode`
- stage name
- elapsed timing

Failure and partial events should explicitly include the failing or incomplete stage so the log line is actionable without correlating multiple entries manually.

### UI Verification

The workspace already knows how to render a runtime note when attribution is present. Add focused regression coverage for both sides of the behavior:

- a completed staged result with full attribution must render the concrete runtime path note
- a sparse or legacy snapshot must not render the misleading `未记录模型 · 路径未知 · unknown` placeholder

## Testing Strategy

- Add/adjust backend tests in `tests/analysis.test.ts`
- Add one workspace regression test in `tests/workspace.test.tsx`
- Run only the focused suites needed for this slice first, then adjacent verification

## Risks

- Over-asserting exact log payload shape can make tests brittle if unrelated telemetry fields evolve
- Reusing the existing contract means older persisted snapshots may still have sparse attribution until regenerated, which is acceptable for this scope

## Recommended Delivery

Ship one narrow patch that:

1. adds failing tests for staged complete attribution and observability payloads
2. updates `lib/server-analysis.ts` with the minimal runtime-field propagation
3. verifies the completed staged workspace runtime note
