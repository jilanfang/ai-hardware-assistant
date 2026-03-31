# Datasheet Analysis Path Drift Postmortem

Date: 2026-03-30

Status: active engineering postmortem

Update: 2026-03-31

This postmortem remains valuable as the record of the drift that happened on 2026-03-30.

It is no longer the current runtime description.

The current source of truth now lives in:

- [Relay Model Routing And PDF Compatibility](/Users/jilanfang/ai-hardware-assistant/docs/engineering/lyapi-model-routing-and-pdf-compatibility.md)
- [Pin2pin Atlas Technical Architecture Overview](/Users/jilanfang/ai-hardware-assistant/docs/engineering/technical-architecture.md)
- [Model Benchmarking](/Users/jilanfang/ai-hardware-assistant/docs/engineering/model-benchmarking.md)

## 1. Summary

The repo's intended datasheet analysis direction and the actual shipped analysis path drifted apart.

The design direction had already moved toward:

- `direct-to-llm` as the primary reading path
- `parse-to-llm` as an evidence and structure enhancement path
- model preference centered on `Gemini Flash`, with `Kimi 2.5` as the China-friendly route

But the implementation that actually shipped in code did not execute that plan.

The current live code path is:

1. accept one PDF
2. render selected PDF pages into PNG images
3. convert those images into `data:image/png;base64,...`
4. send them through an OpenAI-compatible `chat/completions` request
5. run two separate LLM stages:
   - identity classification
   - report synthesis

This means the system is currently not using a true PDF-direct model path, even though that had already become the intended product direction.

## 2. What We Expected

The active product strategy document already described a dual-route model:

- `direct-to-llm` reads the original datasheet as the main reasoning path
- `parse-to-llm` provides structured reinforcement such as parameter candidates, page references, and evidence metadata

The intent was:

- primary understanding from direct PDF reading
- evidence reinforcement from parser output
- better teaching-style reports without making parser heuristics the main conclusion source

The team expectation also included model preferences:

- default: `Gemini Flash`
- China route: `Kimi 2.5`

## 3. What The Code Actually Does

As of this postmortem, the real provider code does not send PDF files directly to a provider-native file API.

Instead it:

- uses a single `OpenAiLlmProvider`
- calls an OpenAI-compatible `/v1/chat/completions` endpoint
- renders PDF pages locally into images
- sends those images with `type: "image_url"`

Important consequence:

- the configured model name may say `gemini-3-flash-preview` or `kimi-k2.5`
- but the integration is still constrained by the OpenAI-compatible `chat/completions` transport layer
- the code is not taking advantage of any provider-native PDF/file input capability

So "Gemini" and "Kimi" are currently only model strings inside the compatibility layer, not first-class provider integrations with their intended document primitives.

## 4. Why This Became Visible

The drift became obvious during live local testing because several observations no longer lined up:

- the user expected direct PDF reading behavior
- the code was still doing image-based multimodal requests
- provider call records did not match what the product expectation suggested
- UI and regression tests could pass without proving a real external provider call happened

This exposed a deeper issue:

- product expectation
- design documentation
- provider abstraction
- actual network behavior

were no longer describing the same system.

## 5. Root Causes

### 5.1 Design-source drift

The design moved faster than the implementation, but the codebase never got a hard checkpoint saying:

- what the current production path is
- what is planned but not yet implemented

That let "future intended path" read like "current shipped path."

### 5.2 Overloaded provider abstraction

The repo has one real provider implementation:

- `OpenAiLlmProvider`

That abstraction currently hides major capability differences:

- file-native PDF ingestion
- provider-specific multimodal behavior
- compatibility-layer limitations

The result is a false sense of interchangeability between model labels and actual transport behavior.

### 5.3 Test coverage gap

Most existing tests are good application-level regression tests, but they do not prove:

- that a real provider call was made
- which upstream endpoint was used
- whether the system used PDF input or image input

So the app could stay green while the integration path silently diverged from the intended architecture.

### 5.4 Missing runtime instrumentation

The runtime did not make it easy to answer basic questions such as:

- did this job enter the real provider path
- which provider/model was used
- was the PDF rendered to images
- how many pages were sent
- where did latency happen

Without these logs, debugging turned into reasoning from symptoms instead of checking execution facts.

## 6. User Impact

For the user, this drift creates real product risk:

- latency and cost are higher than expected because page rendering and base64 payload inflation happen locally
- model/provider behavior may be worse than expected for long datasheets
- the user may think the system is doing direct PDF reading when it is not
- provider dashboards may appear inconsistent with UI expectations
- debugging becomes much slower because the visible product story and the actual runtime path do not match

## 7. What We Learned

### 7.1 Model choice is not enough

A model label does not guarantee the right capability path is being used.

If the transport layer is wrong, the system can still miss the intended product behavior even when the configured model name looks correct.

### 7.2 The analysis path needs one explicit source of truth

The repo must always be able to answer one question cleanly:

`What is the current production analysis path?`

That answer must live in current docs and match current code.

### 7.3 App tests and integration tests are different jobs

The current test suite is good at protecting:

- UI state
- job polling behavior
- persistence
- rendering rules

But that is not enough to validate real provider architecture.

We need explicit integration checks for:

- actual network call stage
- provider/model selection
- input modality used

### 7.4 Runtime visibility is mandatory for AI pipelines

Any nontrivial LLM pipeline should log:

- job id
- stage
- provider
- model
- input modality
- selected page count
- stage duration
- failure reason

Without this, even basic operational debugging becomes too expensive.

## 8. Immediate Corrective Actions

### 8.1 Documentation correction

Current docs should clearly separate:

- active shipped path
- intended next path

No active document should imply that direct PDF reading is already shipped unless the code path actually does it.

### 8.2 Add runtime instrumentation

Add structured logs around:

- provider entry
- PDF rendering
- classification call
- report call
- follow-up call
- timeout/failure

### 8.3 Add real-provider smoke coverage

Introduce a minimal non-mock verification layer that proves:

- the app reaches the real provider code path
- the configured endpoint is actually called
- the current modality is observable

### 8.4 Re-decide the production path explicitly

We need one explicit near-term engineering decision:

- keep image-based multimodal path as the production default and document it honestly
or
- migrate the production path to true provider-native PDF direct ingestion

The repo should not continue with both ideas half-declared at once.

## 9. Recommended Next Decision

The recommended next decision is:

1. instrument the current path first
2. measure where time and failure actually occur
3. then choose one production-default path:
   - `PDF direct-to-LLM`
   - `text-first with image fallback`
   - `image-first multimodal`

For this product, the most aligned target still appears to be:

- `PDF direct-to-LLM` as the primary reading path
- `parse-to-llm` as reinforcement
- image rendering only as fallback or partial repair

But that should be treated as an engineering migration target until the code actually matches it.

## 10. Final Takeaway

This was not just a parser or timeout bug.

It was an architecture-truth bug:

- the intended product path
- the documented strategy
- the provider abstraction
- and the real runtime path

## 11. Follow-Up Resolution On 2026-03-31

The repo has since moved out of the worst part of this drift.

What changed:

- relay providers are now explicit runtime choices:
  - `lyapi`
  - `vectorengine`
- runtime selection now uses `provider/model` as the real source of truth
- verified relay PDF-direct paths are now documented and wired for:
  - `gpt-4o`
  - `gpt-4.1`
  - `gemini-3-flash-preview`
  - `gemini-3.1-pro-preview`
- Atlas now supports two explicit pipeline modes:
  - `single`
  - `staged`
- benchmark tooling now exists to compare relay-backed targets on both response behavior and output quality

What did not change:

- not every relay-exposed domestic model has been re-verified for PDF direct ingestion in this repo
- image rendering still exists as a fallback path for unsupported or unverified targets
- benchmark confidence is still too dependent on the UPF5755 scenario
- runtime observability still needs to become stronger in production logs

So the architecture-truth bug is no longer “docs say PDF direct while code is image-only.”

The remaining risk is narrower:

- which relay/model pairs are truly production-ready
- how often fallback paths are still being used
- whether benchmark conclusions keep holding across more real datasheets

had stopped describing the same thing.

That mismatch is the main issue to prevent next.
