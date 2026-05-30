# CSV Format Info Dialog

**Goal:** Show a brief description of the expected CSV format between clicking the import button and the native file dialog opening.

**Context:** Both `ClassesView` (student/class CSV import) and `SessionsTab` (grade CSV import) currently open the native file dialog immediately on button click, with no indication of the expected format.

## Solution

Insert a renderer-side modal dialog between the button click and the IPC call, showing the expected CSV format.

## Files

### Create

**`src/renderer/components/CsvFormatDialog.vue`** — shared dialog component
- Props: `title` (string), `columns` (array of `{name, desc}`), `example` (string)
- Emits: `confirm`, `cancel`
- Styling matches existing `.overlay` / `.confirm-dialog` patterns
- Uses `<Teleport to="body">` for consistent layering

### Modify

**`src/renderer/views/ClassesView.vue`**
1. Import `CsvFormatDialog`
2. Add reactive `showCsvFormat` ref
3. Change `importCsv()`: show dialog first, IPC on confirm
4. Insert `<CsvFormatDialog>` with student CSV columns

**`src/renderer/components/course/SessionsTab.vue`**
1. Import `CsvFormatDialog`
2. Add reactive `showCsvFormat` ref
3. Change `handleImportCsv()`: show dialog first, IPC on confirm
4. Insert `<CsvFormatDialog>` with grade CSV columns

## Flow

```
Button click → show format dialog → user reads → click "Weiter"
→ IPC call → native file dialog → select file → parse → show result
                             click "Abbrechen" → dialog closes
```

## Non-goals

- No changes to IPC handlers or service layer
- No new IPC channels
- Follows existing inline-overlay pattern
