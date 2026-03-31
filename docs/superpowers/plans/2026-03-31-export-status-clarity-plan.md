# Export Status Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every export artifact preserve the full parameter set and expose readable trust-state labels across CSV, HTML, Word, PDF, and JSON.

**Architecture:** Reuse the existing `AnalysisDocumentViewModel` as the single export source of truth, and extend its `parameterRows` with one shared `statusLabel` field. Update `lib/exports.ts` so every builder consumes the same view-model contract instead of translating or filtering parameter status independently.

**Tech Stack:** TypeScript, Vitest, Next.js export helpers

---

### Task 1: Lock the export contract with failing tests

**Files:**
- Modify: `tests/exports.test.ts`

- [x] **Step 1: Rewrite the CSV contract test**
Replace the old “confirmed-only CSV” expectation with a test that requires:

```ts
expect(parameterTable.content.split("\n")[0]).toBe("参数,值,状态");
expect(parameterTable.content).toContain("输入电压,4.5V to 36V,已确认");
expect(parameterTable.content).toContain("封装,SOT-23-THN,待确认");
```

- [x] **Step 2: Run the focused export test to verify it fails**

Run: `npm test -- tests/exports.test.ts`
Expected: FAIL because `buildParameterTable()` still filters `needs_review` rows and only emits two columns.

- [x] **Step 3: Add one cross-format status-label regression**
Add a test that builds one analysis result containing at least:

```ts
keyParameters: [
  { name: "Input voltage", value: "4.5V to 36V", evidenceId: "ev-input", status: "confirmed" },
  { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" },
  { name: "Output current", value: "300mA", evidenceId: "ev-out", status: "user_corrected" }
]
```

Then assert:

```ts
expect(reportPdf.content).toContain("输入电压: 4.5V to 36V（已确认）");
expect(reportWord.content).toContain("封装: SOT-23-THN（待确认）");
expect(analysisHtml.content).toContain("<td>人工修正</td>");
expect(analysisJson.content).toContain('"status": "user_corrected"');
expect(analysisJson.content).toContain('"statusLabel": "人工修正"');
```

- [x] **Step 4: Re-run the focused export test file**

Run: `npm test -- tests/exports.test.ts`
Expected: FAIL until the shared export status label is implemented.

### Task 2: Add one shared export status label to the view model

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/exports.ts`

- [x] **Step 1: Extend `AnalysisDocumentViewModel.parameterRows`**
Add the shared display field:

```ts
parameterRows: Array<{
  name: string;
  value: string;
  status: ParameterStatus;
  statusLabel: string;
  evidence: {
    label: string;
    page: number;
    quote: string;
  } | null;
}>;
```

- [x] **Step 2: Add one local status-label mapper in `lib/exports.ts`**
Introduce the smallest local helper near the export builders:

```ts
function exportStatusLabel(status: AnalysisDocumentViewModel["parameterRows"][number]["status"]) {
  if (status === "confirmed") return "已确认";
  if (status === "user_corrected") return "人工修正";
  return "待确认";
}
```

- [x] **Step 3: Populate `statusLabel` in `buildAnalysisDocumentViewModel()`**
When mapping `analysis.keyParameters`, include:

```ts
status: item.status,
statusLabel: exportStatusLabel(item.status),
```

- [x] **Step 4: Run the focused export test file**

Run: `npm test -- tests/exports.test.ts`
Expected: still FAIL because the builders are not using `statusLabel` yet.

### Task 3: Update all export builders to consume the new contract

**Files:**
- Modify: `lib/exports.ts`

- [x] **Step 1: Update the report body renderer**
Change parameter lines from:

```ts
`- ${item.name}: ${item.value} [${item.status}]`
```

to:

```ts
`- ${item.name}: ${item.value}（${item.statusLabel}）`
```

- [x] **Step 2: Update CSV export**
Change the CSV builder to:

```ts
const rows = buildAnalysisDocumentViewModel(pdf, analysis, followUpMessages).parameterRows
  .map((item) => `${item.name},${item.value},${item.statusLabel}`);

return {
  fileName: `${pdf.chipName}-参数表.csv`,
  mimeType: "text/csv",
  content: ["参数,值,状态", ...rows].join("\n")
};
```

- [x] **Step 3: Update HTML export**
Render the parameter status column with `row.statusLabel` instead of the raw enum:

```ts
<td>${escapeHtml(row.statusLabel)}</td>
```

- [x] **Step 4: Preserve both `status` and `statusLabel` in JSON export**
Keep using `buildAnalysisDocumentViewModel()` so the serialized JSON includes the new field without replacing the existing enum.

- [x] **Step 5: Run the focused export test file**

Run: `npm test -- tests/exports.test.ts`
Expected: PASS

### Task 4: Verify adjacent trust-loop behavior and sync task files

**Files:**
- Modify: `progress.md`
- Modify: `findings.md`

- [x] **Step 1: Run adjacent verification**

Run: `npm test -- tests/analysis.test.ts tests/workspace.test.tsx tests/exports.test.ts`
Expected: PASS

- [x] **Step 2: Record the export trust-loop decision**
Update task files to capture that exports now preserve full parameter rows and expose human-readable status labels instead of hiding review-needed fields.
