# Relay Model Routing And PDF Compatibility

This note is the current source of truth for Atlas relay-backed model routing.

Scope:

- `lyapi` and `vectorengine` are peer runtime providers
- production routing must be expressed as explicit `provider/model` pairs
- Atlas remains a datasheet-only app

## Runtime Rule

`ANALYSIS_*_LLM_PROVIDER` now stores the relay provider name directly:

- `lyapi`
- `vectorengine`
- legacy direct providers still exist for test/dev:
  - `openai`
  - `gemini`
  - `mock`

The transport class is chosen from the model family:

- `gemini-*` uses Gemini-native transport
- all other currently supported relay targets use OpenAI-compatible transport

This means `lyapi/gemini-3.1-pro-preview` and `vectorengine/gemini-3.1-pro-preview` are distinct runtime targets, even though they share the same model string.

`ANALYSIS_PIPELINE_MODE` controls whether Atlas uses a single model or the staged orchestration:

- `single`
  - default
  - ignore fast/report/arbitration stage overrides for the main analysis path
- `staged`
  - enable fast parameters, full report, and arbitration stage-specific providers/models

## Verified PDF Direct Compatibility

### Verified working on both relays

- `gpt-4o`
  - transport: OpenAI `responses`
  - PDF input: `input_file` with `data:application/pdf;base64,...`
- `gpt-4.1`
  - transport: OpenAI `responses`
  - PDF input: `input_file`
- `gemini-3-flash-preview`
  - transport: Gemini `generateContent`
  - PDF input: `inline_data` with `application/pdf`
- `gemini-3.1-pro-preview`
  - transport: Gemini `generateContent`
  - PDF input: `inline_data` with `application/pdf`

### Not yet adopted as Atlas production targets

These models may be available on a relay, but are not yet the default Atlas reading path:

- `gpt-5-mini`
- `gpt-5.2`
- `gpt-5.4`
- `grok-4-1-fast-non-reasoning`
- domestic reasoning models that need separate confirmation under each relay

Atlas should only promote a model into the runtime default set after:

1. PDF direct ingestion works through the relay
2. response latency is operationally acceptable
3. quality benchmark is competitive against the current baseline

## Current Benchmark Conclusions

Based on the checked-in UPF5755 benchmark artifact and manual review:

- best fast-parameter target: `lyapi/gpt-4o`
- best full-report target: `lyapi/gemini-3.1-pro-preview`
- best first fallback: `lyapi/gpt-4.1`
- best secondary fallback: `vectorengine/gpt-4.1`

Observed quality caveat:

- some models still fabricate “公开讨论/用户反馈”
- better models explicitly admit when no external evidence was actually provided

This is why Atlas benchmark quality now penalizes unsupported external-feedback claims and keeps `lyapi/gemini-3.1-pro-preview` as the normalization baseline at `100`.

## Current Runtime Recommendation

For the current recommended dual-stage datasheet path when `ANALYSIS_PIPELINE_MODE=staged`:

- fast parameters:
  - `ANALYSIS_FAST_LLM_PROVIDER=lyapi`
  - `ANALYSIS_FAST_LLM_MODEL=gpt-4o`
- full report:
  - `ANALYSIS_REPORT_LLM_PROVIDER=lyapi`
  - `ANALYSIS_REPORT_LLM_MODEL=gemini-3.1-pro-preview`
- arbitration:
  - `ANALYSIS_ARBITRATION_LLM_PROVIDER=lyapi`
  - `ANALYSIS_ARBITRATION_LLM_MODEL=deepseek-v3.2`

If `ANALYSIS_PIPELINE_MODE=single`, Atlas only uses `ANALYSIS_LLM_PROVIDER` and `ANALYSIS_LLM_MODEL`.
If `ANALYSIS_PIPELINE_MODE=staged`, stage-specific env vars can override the default pair.

## Smoke Commands

Relay smoke checks remain useful for verifying raw PDF compatibility:

```bash
npm run lyapi:pdf-smoke -- gemini ./tmp-sample.pdf gemini-3-flash-preview
npm run lyapi:pdf-smoke -- responses ./tmp-sample.pdf gpt-4o
```

Reusable benchmark run:

```bash
npm run benchmark:model -- --scenario config/benchmarks/upf5755-report.json
```

## Artifact Hygiene

Benchmark artifacts must not store raw API keys.

Allowed fields:

- `provider`
- `model`
- `targetId`
- `response`
- `quality`
- preview text needed for manual review

Disallowed fields:

- `apiKey`
- bearer tokens
- full raw request payloads with secrets
