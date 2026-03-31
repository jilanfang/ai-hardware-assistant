# Phase 1 Personas And Journeys

> Historical persona exploration.
>
> The current repo scope is narrower than this document. Any capture-related journeys or multi-scene framing here are not active implementation scope.

Generated on 2026-03-28

## Purpose

This document expands the phase-1 product framing from “two scene types” into clearer personas and real decision journeys.

The product still stays scene-based, not role-based. But the personas matter because the same datasheet or capture is read for different decisions by different people.

Persona support in this document does **not** imply persona-specific homepages, separate dashboards, or extra UI cards. The same AI-native interface should serve all personas. Different needs should emerge through the task thread, source material, prompts, and follow-up guidance.

## Core Product Lens

All personas in this document use the product for the same underlying reason:

`They need faster verification from electronics source material.`

They do not all need the same output.

## Research Signals Behind This Document

This document combines:

- your interview notes with hardware, test, and broader document-heavy users
- Reddit usage patterns around datasheet reading, part selection, validation, and trust
- public documentation patterns from TI, ROHM, Mouser, onsemi, and similar sources

Useful external signals:

- Engineers repeatedly say they want references, source jumps, and highlighted locations rather than unsupported AI answers.
- MCU and semiconductor readers often need not just the main datasheet, but app notes, family reference manuals, errata, and package notes.
- Procurement and commercial workflows care about lifecycle, compliance, packaging, and sourcing context in addition to technical specs.
- Test and validation work depends heavily on limits, conditions, and reference values, not just nominal numbers.

Reference links:

- [Reddit: frustration with datasheets](https://www.reddit.com/r/embedded/comments/1i4hp07/whats_the_most_frustrating_part_of_working_with/)
- [Reddit: how engineers read MCU datasheets](https://www.reddit.com/r/embedded/comments/ifblmy/how_to_read_datasheets_for_mcus/)
- [Reddit: data sheet assistant discussion](https://www.reddit.com/r/AskElectronics/comments/18fw19z)
- [TI: top-level look at datasheet terms](https://www.ti.com/lit/szza036)
- [TI: understanding datasheet test conditions](https://e2e.ti.com/cfs-file/__key/telligent-evolution-components-attachments/00-151-01-00-01-06-09-56/understanding-datasheets.pdf)
- [ROHM: what application notes are for](https://www.rohm.com/electronics-basics/documentation/application-note)
- [Mouser: lifecycle notifications](https://www.mouser.com/lifecycles/)
- [Mouser: quality and anti-counterfeit posture](https://content.mouser.com/quality/)
- [Electropages: key sections for smarter component selection](https://www.electropages.com/blog/2025/02/navigating-datasheets-key-sections-smarter-component-selection)

## Persona 1: Solution / Hardware Engineer

### What they are trying to decide

- Can this part enter the design?
- What are the real operating limits?
- What hidden conditions or footnotes could break the design later?

### What they look for in source material

- block diagram
- pin functions
- recommended operating conditions
- electrical characteristics
- timing and interface details
- reference circuits
- package and thermal constraints
- application notes and errata

### Why current workflows hurt

- the relevant information is split across multiple sections or multiple documents
- key conditions are easy to miss
- generic AI summaries are not trusted without source anchors

### What they need from the product

- fast first-pass summary
- parameter extraction with source jumps
- “what matters for this design” highlighting
- multi-document grounding later

## Persona 2: Test / Validation Engineer

### What they are trying to decide

- Do the measured values match the reference?
- Is the result within an acceptable range or clearly out of spec?
- Can I turn captures and readings into a reportable artifact faster?

### What they look for in source material

- min / typ / max values
- test conditions
- bandwidth, load, voltage, and temperature assumptions
- marker values from screenshots or instruments
- report templates and customer-facing evidence

### Why current workflows hurt

- repeated screenshot-to-Excel transcription
- conditions and limits are easy to misread
- report writing starts from repetitive template filling

### What they need from the product

- capture-to-structured-output
- side-by-side comparison between measured value and reference value
- explicit source anchors for extracted values
- first-pass report drafting after value review

## Persona 3: Component / Alternative-Evaluation Specialist

### What they are trying to decide

- Is this part a credible replacement candidate?
- Where do the conditions differ?
- What is equivalent on paper but risky in practice?

### What they look for in source material

- parameter comparison
- test condition differences
- package differences
- lifecycle and availability labels
- ordering and variant information
- app notes and usage assumptions

### Why current workflows hurt

- comparison tables without sources are not trusted
- distributor filters are too rigid for nuanced engineering questions
- variant naming and package details are easy to misread

### What they need from the product

- evidence-backed comparison
- condition-difference visibility
- source-linked comparison cells
- eventually, technical plus sourcing context

## Persona 4: Procurement / Supply Chain / Sourcing Support

### What they are trying to decide

- Is this part buyable, compliant, and safe to put through the current sourcing path?
- Is there lifecycle, package, or documentation risk that engineering may miss?

### What they look for in source material

- package type
- ordering information
- lifecycle status such as NRND or EOL
- compliance and quality context
- manufacturer vs distributor source consistency
- minimum order and stocking context

### Why current workflows hurt

- they do not want to read full datasheets deeply
- they still need enough understanding to avoid bad substitutions or sourcing surprises
- a lot of the information lives across datasheets and distributor metadata rather than one document

### What they need from the product

- plain-language datasheet summary
- procurement-relevant highlight layer
- packaging, lifecycle, and sourcing-risk summary
- fast confidence without becoming an engineer

## Persona 5: Sales / FAE / Customer-Support Engineer

### What they are trying to decide

- How do I explain this part to a customer quickly?
- What are the strongest application-fit points?
- What objections or caveats are likely to come up?

### What they look for in source material

- summary features
- applications section
- reference designs and app notes
- key limits customers often ask about
- package and integration story
- comparison against nearby alternatives

### Why current workflows hurt

- they need a customer-safe summary fast
- raw datasheets are too dense for quick communication
- generic summaries often miss the actual engineering caveat that later creates churn

### What they need from the product

- customer-facing summary
- “how to explain this part” framing
- application-fit bullets tied to evidence
- quick objection-handling facts

## Persona 6: Junior Engineer / Cross-Functional Learner

### What they are trying to decide

- What does this part actually do?
- Which sections matter first?
- What should I ask a senior engineer after my first pass?

### What they look for in source material

- overview and block diagram
- important tables and chapter map
- translated or simplified summary
- terminology explanations
- app notes or examples that show real use

### Why current workflows hurt

- long English documents are cognitively expensive
- they often do not know what to search for
- they can easily over-trust or under-trust generic AI answers

### What they need from the product

- guided first-pass reading
- source-linked simplified Chinese summary
- “start here” path through the document
- explicit uncertainty rather than fake confidence

## Confirmed Journey 1: First-Pass Datasheet Understanding

### Primary personas

- Solution / Hardware Engineer
- Junior Engineer
- Sales / FAE

### Trigger

“我先要知道这颗料到底值不值得继续看。”

### Current workflow

- open the datasheet
- Ctrl+F a few terms
- skim summary tables
- ask someone more experienced if unsure

### Product journey

1. Upload one datasheet.
2. Get a first-pass summary and key extracted parameters.
3. Click into evidence when a number matters.
4. Ask follow-up questions inside the current document scope.
5. Decide whether to continue evaluating the part.

### Output they care about

- summary
- chapter map
- key parameters
- source-linked evidence

## Confirmed Journey 2: Parameter Verification And Comparison

### Primary personas

- Solution / Hardware Engineer
- Alternative-Evaluation Specialist

### Trigger

“这几个参数到底是不是同一条件下成立的？”

### Current workflow

- manually compare tables
- copy values into Excel
- re-open source pages to check footnotes and conditions

### Product journey

1. Ask for a parameter or candidate comparison.
2. Review the compared values in one thread.
3. Click each value back to source evidence.
4. Inspect condition differences before making a decision.

### Output they care about

- evidence-backed comparison rows
- condition-difference notes
- packaging and variant caveats

## Confirmed Journey 3: Test Capture To Structured Output

### Primary personas

- Test / Validation Engineer

### Trigger

“这些 marker 都有了，我只是不想再手填 Excel。”

### Current workflow

- screenshot or read values manually
- type into Excel
- check against DS reference values
- continue into report writing

### Product journey

1. Upload one or more captures.
2. Review extracted values in structured rows.
3. Correct any wrong values.
4. Export to downstream structure.

### Output they care about

- extracted values
- source anchors
- Excel-friendly export

## Confirmed Journey 4: Test Result To Report Draft

### Primary personas

- Test / Validation Engineer
- Sales / FAE

### Trigger

“我已经有测试值和参考值了，现在要给客户或内部一个可读结果。”

### Current workflow

- fill a report template manually
- compare values against DS limits
- write a conclusion by hand

### Product journey

1. Start from reviewed structured test values.
2. Pull in DS reference values and conditions.
3. Draft a first-pass report section or summary.
4. Let the user edit before external use.

### Output they care about

- report draft
- pass/fail or deviation context
- source-linked justification

## Confirmed Journey 5: Procurement-Facing Summary

### Primary personas

- Procurement / Supply Chain
- Sales / FAE
- Alternative-Evaluation Specialist

### Trigger

“我不想深读 datasheet，我只想知道这颗料买起来和推进起来会不会有坑。”

### Current workflow

- ask engineering for a summary
- scan distributor metadata
- try to understand package and lifecycle details manually

### Product journey

1. Open the same part record or task.
2. Switch to a procurement-relevant summary layer.
3. Review package, lifecycle, variant, and sourcing-risk notes.
4. Escalate only the unresolved technical questions back to engineering.

### Output they care about

- plain-language summary
- package and variant notes
- lifecycle and risk cues

## Confirmed Journey 6: Customer-Ready Application Summary

### Primary personas

- Sales / FAE
- Support Engineer

### Trigger

“客户问这颗料适不适合某个场景，我需要快速讲清楚。”

### Current workflow

- skim summary page
- search app notes
- ask internal applications or design team

### Product journey

1. Load the part or task.
2. Get an application-fit summary grounded in datasheet and app-note evidence.
3. Review top benefits and top caveats.
4. Use the result for external communication.

### Output they care about

- application-fit bullets
- top constraints
- customer-safe summary tied to source facts

## Confirmed Journey 7: Guided Learning And Escalation

### Primary personas

- Junior Engineer
- Cross-functional Learner

### Trigger

“我知道这份资料重要，但我不知道先看哪里。”

### Current workflow

- read summary pages
- search random terms
- ask senior engineers too early

### Product journey

1. Upload the datasheet.
2. Receive a simplified summary and “start here” reading path.
3. Jump between chapters with evidence support.
4. Build a first-pass understanding before asking for help.

### Output they care about

- simplified summary
- chapter navigation hints
- uncertainty flags
- better questions for escalation

## What This Means For Phase 1

Not all journeys should be built now.

The point of this document is to stop under-scoping the market while still keeping delivery disciplined.

### Journeys most aligned with the current repo

- Journey 1: First-pass datasheet understanding
- Journey 2: Parameter verification and comparison
- Journey 7: Guided learning and escalation

### Journeys most aligned with the next scene

- Journey 3: Test capture to structured output
- Journey 4: Test result to report draft

### Journeys that should influence product language now, even if not fully built

- Journey 5: Procurement-facing summary
- Journey 6: Customer-ready application summary

## Unified Interface Principle

The product should not fork the interface by persona.

That means:

- no separate “procurement homepage”
- no separate “sales mode” dashboard
- no extra surface-level cards or buttons for every role
- no role-first navigation as the default pattern

Instead:

- one workspace shell
- one evidence canvas
- one task thread
- persona differences expressed through the user’s source material, questions, summaries, and follow-up actions

The product is testing different persona value inside the same interface, not building six different interfaces.

## Product Implication

Phase 1 should not be described too narrowly as “for hardware engineers only.”

A better statement is:

`Pin2pin Atlas is an evidence workspace for people who need to understand, verify, and reuse electronics source material in different decision contexts.`

That lets the product support multiple personas without becoming a generic office tool.

## Open Questions

- Which two personas should be visibly optimized in the first public demo?
- Should procurement and sales get a different summary mode in the same task thread, or only different prompt presets at first?
- When the capture scene ships, should report drafting be included immediately or only after Excel-style export is stable?
