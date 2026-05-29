# Plan: CSV Grade Import

## Goal
Add a "Bewertungen importieren (CSV)" button to SessionsTab that reads `Grading_flat.csv` and creates sessions, assessments, and student performances for each row.

## Steps
1. Create feature branch `feature/grade-csv-import` from `main`
2. Write integration tests for `GradeImportService` (TDD - RED phase)
3. Implement `GradeImportService` (GREEN phase)
4. Add `GRADE_IMPORT_CSV` IPC channel + type + preload bridge
5. Add IPC handler in `grade.ipc.ts`
6. Wire `GradeImportService` in `app.ts`
7. Add import button + result display in `SessionsTab.vue`
8. Run `npm run typecheck && npm run lint && npm run test`
9. Commit with conventional commit message

## Files affected
- NEW: `src/application/GradeImportService.ts`
- MODIFY: `src/shared/ipc-channels.ts`
- MODIFY: `src/shared/types.ts`
- MODIFY: `src/preload/preload.ts`
- MODIFY: `src/main/ipc/grade.ipc.ts`
- MODIFY: `src/main/app.ts`
- MODIFY: `src/renderer/components/course/SessionsTab.vue`
- NEW: `tests/integration/application/GradeImportService.test.ts`

## Edge cases
- Student not found → skip with warning
- Duplicate student names → skip with warning
- Category not found → skip with warning
- Session date already exists → reuse
- Assessment name already exists in session → reuse
- Performance already exists → update (upsert)
- Decimal scores (comma→dot conversion)
- Participation symbols (+, ~, - → PLUS, WELLE, MINUS)
- Empty grade cells → null score

## Definition of done
- All tests pass
- TypeScript strict mode clean
- ESLint clean
- Feature works end-to-end
