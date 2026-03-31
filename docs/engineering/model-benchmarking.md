# Model Benchmarking

This document defines the reusable benchmark system for Atlas relay-backed datasheet reading.

## Goal

Benchmark targets are always expressed as `provider/model`.

The benchmark must be easy to extend in three directions:

- add another relay provider
- add another model under an existing provider
- score both response behavior and output quality

## Current Baseline

Quality is normalized against:

- `lyapi/gemini-3.1-pro-preview = 100`

This is a reporting baseline, not a claim that every future scenario must use Gemini as the production winner.

## Components

### 1. Scenario file

Scenario files live under:

- [`config/benchmarks/`](/Users/jilanfang/ai-hardware-assistant/config/benchmarks)

Each scenario defines:

- `id`
- `pdfPath`
- `prompt`
- `baseline`
- `requiredFacts`
- `hallucinationChecks`
- `targets`

Targets are explicit relay runtime pairs:

```json
{
  "provider": "lyapi",
  "model": "gpt-4o",
  "baseUrl": "https://lyapi.com",
  "mode": "responses",
  "apiKeyEnv": "LYAPI_API_KEY"
}
```

### 2. Benchmark library

[`lib/model-benchmark.ts`](/Users/jilanfang/ai-hardware-assistant/lib/model-benchmark.ts) owns:

- fact coverage scoring
- hallucination penalty scoring
- baseline normalization
- aggregate response and quality ranking
- stable `provider/model` target ids

### 3. Benchmark runner

[`scripts/model-benchmark.ts`](/Users/jilanfang/ai-hardware-assistant/scripts/model-benchmark.ts) owns:

- loading one scenario file
- calling the correct relay transport
- collecting response metrics
- running quality evaluation
- writing a JSON artifact

## Metrics

### Response

Per target:

- `ok`
- `status`
- `elapsedMs`
- `textLength`

Response ranking sorts by:

1. successful responses first
2. lower latency first
3. stable lexical fallback on `targetId`

### Quality

Per target:

- `score`
- `normalizedScore`
- `factHits`
- `penalties`

Current quality logic rewards:

- required datasheet fact coverage

Current quality logic penalizes:

- unsupported claims about public discussion or user feedback when no external evidence was provided

## Command

Run the checked-in UPF5755 scenario:

```bash
npm run benchmark:model -- --scenario config/benchmarks/upf5755-report.json
```

Optionally specify an artifact path:

```bash
npm run benchmark:model -- --scenario config/benchmarks/upf5755-report.json --output artifacts/upf5755-benchmark.json
```

## Current Practical Recommendation

For the current Atlas datasheet flow:

- fast pass winner: `lyapi/gpt-4o`
- full report winner: `lyapi/gemini-3.1-pro-preview`
- first fallback: `lyapi/gpt-4.1`
- second fallback: `vectorengine/gpt-4.1`

These conclusions come from the real UPF5755 benchmark artifact plus manual quality review, not from a synthetic leaderboard.

## Extending The Benchmark

To add another model:

1. open a scenario file under [`config/benchmarks/`](/Users/jilanfang/ai-hardware-assistant/config/benchmarks)
2. append one target with its `provider`, `model`, `baseUrl`, `mode`, and `apiKeyEnv`
3. rerun `npm run benchmark:model -- --scenario ...`

No library or runner change should be required for a simple target addition.
