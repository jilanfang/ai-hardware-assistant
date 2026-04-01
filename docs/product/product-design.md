# Pin2pin Atlas Product Design v0.3

> Current design note for the shipped Atlas workspace.
> Older “fixed four-column workbench” descriptions are no longer current.

## 1. Design Goal
Atlas should feel like an AI copilot first, not a legacy task console.

The current product has one core job:
- user brings in one datasheet PDF
- Atlas produces a structured first pass
- user verifies conclusions against the source PDF
- user confirms, corrects, exports, and keeps asking within the same session

So the interface must optimize for:
- a low-friction start
- a strong conversation center
- visible evidence validation
- clear task recovery
- explicit trust state

## 2. Two-Stage Interface
The workspace now has two major interface stages.

### Empty state / no active task
Before a task exists, the product should behave more like ChatGPT or Gemini:
- the main surface is a centered upload composer
- the primary action is drag in a PDF or choose one
- file selection immediately starts analysis
- no empty PDF viewer is shown
- no oversized left-side upload button should compete for attention

This state is intentionally sparse. The user should understand the first move in one glance.

### Active task state
After a PDF is uploaded, the page switches into a three-part working layout:
- left: weak, collapsible management sidebar
- center: main conversation and task thread
- right: PDF evidence panel, expanded by default and collapsible

This shift matters. The product starts like a chat tool, then becomes a chat-plus-evidence workspace.

## 3. Layout Structure
The current shipped layout is:
- left sidebar
- center dialog column
- right PDF panel

### Left sidebar
The left side is deliberately low frequency. It should not compete with the dialog.

It keeps:
- workspace identity
- basic navigation
- current task summary
- recent tasks and restore entry
- low-frequency parameter jump shortcuts
- current user and logout

It supports explicit collapse and expand behavior.

### Center dialog column
The center column is the main stage.

It contains:
- current task timeline
- summary and review output
- parameter confirmation and correction
- export actions
- follow-up conversation
- state explanations, warnings, and degraded messages

The input area is fixed to the bottom and should stay visible while the message thread scrolls above it.

### Right PDF panel
The PDF panel is the evidence surface, not a general reading view.

It should:
- open by default when a task exists
- collapse on demand to give more room to the dialog
- reopen when the user needs to inspect evidence
- preserve jump-to-page and highlight behavior

## 4. Empty-State Start Experience
The empty state should teach one thing only: bring in a datasheet.

The centered composer-style upload area should support:
- drag-and-drop PDF upload
- click-to-select PDF upload
- immediate start after file selection
- inline validation for invalid or empty files

The empty state should not waste space on:
- a blank PDF frame
- a heavy control panel
- duplicate submit actions

Recent tasks still exist, but they stay in the weak left sidebar instead of becoming the hero action.

## 5. Conversation-First Task Flow
Once a task starts, the product should guide the user through one continuous thread instead of scattering actions across side panels.

The main thread should hold:
- processing status
- staged or complete analysis output
- engineering review and open questions
- parameter confirmation and correction
- export actions
- suggestion prompts
- follow-up answers

The center thread is where the user works. Side structures only support it.

## 6. Parameter Handling
Parameter handling stays inside the conversation flow as the default path.

This means:
- confirmation and correction should happen in-thread
- evidence-linked parameter review should stay near the analysis output
- sidebar parameter navigation is secondary and optional

The product should not present parameter handling as a separate admin console.

## 7. Evidence-Linked Verification
Atlas is not meant to be “just another chat answer.” The PDF linkage is the trust mechanism.

Important conclusions and parameters should support:
- evidence lookup
- page jump
- source highlight
- return to the current reading context

The PDF area exists to back up the conversation with inspectable source material.

## 8. Export Placement
Export remains a conversation-stage action, not a left-nav module.

That keeps the user in one workflow:
- read the result
- review trust and evidence
- confirm or correct key values
- export from the same thread

Exports should continue to reflect:
- reviewed vs unreviewed values
- user corrections
- evidence references when available
- current runtime attribution where relevant

## 9. Follow-Up Boundaries
Follow-up is a continuation of the current task, not a reset into generic free chat.

The interface should make clear that follow-up draws from:
- the current report
- the extracted parameters
- the stored evidence
- the current job context

If coverage is weak or the job is incomplete, the UI should say so directly instead of faking certainty.

## 10. Key States
The design still needs to make system state obvious:
- empty
- processing
- partial
- complete
- failed
- restored
- delayed / resumed polling

When staged execution is active, the product should still distinguish:
- fast-stage output available
- full report pending
- reconciliation complete
- review-needed conflicts

These states should appear inside the main thread, because that is where the user is paying attention.

## 11. Responsive Behavior
The layout should remain chat-first on smaller screens.

Mobile and tablet behavior should follow these priorities:
- keep the dialog column primary
- compress the left sidebar into a lighter entry point
- keep PDF collapsed by default until needed
- avoid empty-state horizontal crowding

Responsive behavior should adapt layout first, not invent a second product.

## 12. Defensive UX
The product should communicate limits clearly and early:
- unsupported file types
- empty files
- degraded output due to document quality
- missing job during restore
- incomplete evidence linkage
- follow-up or export limitations when the result is not ready

These messages should feel like product behavior, not stray error text.
