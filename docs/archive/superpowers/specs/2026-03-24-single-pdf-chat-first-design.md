# Single PDF Chat-First Design

## Goal
Build a usable MVP for single-datasheet analysis with a chat-first interface: upload one PDF, create one task, produce a quick summary, engineering review, and key parameters, then jump from each output back to the PDF evidence location.

## Product Shape
- The left column is the only main stage.
- Task creation, upload, analysis output, follow-up Q&A, evidence links, and export actions all live inside assistant messages.
- The right column is a passive PDF canvas.
- Before upload, the PDF canvas stays nearly empty with only a subtle hint.
- After upload, the PDF canvas shows the uploaded PDF and responds to evidence clicks from the chat.

## Interaction Rules
- The initial assistant state prompts for a chip task name and a single PDF upload.
- After upload, the assistant emits one structured message with:
  - task block
  - summary block
  - review block
  - parameter block
  - action block
- Evidence links are lightweight inline anchors inside summary/review/parameter content.
- Clicking an evidence link updates the PDF canvas to the target page and highlight.
- Follow-up questions append new assistant messages instead of rebuilding the whole page.

## MVP Constraints
- Single PDF only.
- The first implementation can use deterministic mock analysis from uploaded file metadata and seeded evidence anchors.
- Export actions must be visible and usable, but the first version may download generated plain-text/HTML-backed files instead of final polished documents.
- The parameter extraction table download should provide a clean `parameter name + value` format.

## Visual Direction
- Continue the same product family as `ai-quality`, but remove dashboard weight.
- Use a bright, restrained surface system with cold neutral backgrounds, white paper surfaces, soft blue focus color, and strong whitespace.
- Keep the left chat area visually dominant.
- Keep the right canvas quiet and utility-like.

## Technical Direction
- Use `Next.js` App Router with client-side state for the first usable prototype.
- Use browser object URLs for PDF preview.
- Use a seeded local domain model for tasks, messages, parameters, exports, and evidence targets.
- Keep analysis generation in pure functions so the future real parser/LLM pipeline can replace it.
