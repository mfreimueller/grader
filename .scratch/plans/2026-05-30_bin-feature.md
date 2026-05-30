# Bin (Papierkorb) Feature

## Goal
Add a "Papierkorb" view that lists all soft-deleted Students and School Classes, grouped by type, with per-item restore/permanent-delete and an "empty bin" action.

## Constraints
- Only Students and School Classes (the two entities with `deleted_at` support).
- Sidebar nav entry.
- Student hard-delete cascades through all related data (additional_info, session_students, grades, findings, performances → student row).
- Class hard-delete refuses if any students (active or soft-deleted) still reference it; user must delete students first.
- Restore simply sets `deleted_at = NULL`.

## Steps

### 1. Domain — Repository Interfaces
- **`StudentRepository.ts`**: add `findDeleted(): Promise<Student[]>`, `restore(id: StudentId): Promise<void>`, `hardDelete(id: StudentId): Promise<void>`
- **`SchoolClassRepository.ts`**: add `findDeleted(): Promise<SchoolClass[]>`, `restore(id: string): Promise<void>`, `hardDelete(id: string): Promise<void>`

### 2. Infrastructure — SQLite Implementations
- **`SqliteStudentRepository.ts`**:
  - `findDeleted()`: `SELECT ... FROM students JOIN school_classes WHERE s.deleted_at IS NOT NULL`
  - `restore()`: `UPDATE students SET deleted_at = NULL WHERE id = ?`
  - `hardDelete()`: cascade-delete — additional_info, session_students, grades, findings (under performances), performances, then `DELETE FROM students`
- **`SqliteSchoolClassRepository.ts`**:
  - `findDeleted()`: `SELECT ... WHERE deleted_at IS NOT NULL`
  - `restore()`: `UPDATE school_classes SET deleted_at = NULL WHERE id = ?`
  - `hardDelete()`: guard check → if any students remain → throw `DomainError`; else `DELETE FROM school_classes`

### 3. Application — BinService
New `src/application/BinService.ts`:
- `listAll()` → calls both `findDeleted()`, returns grouped `BinListDto`
- `restoreStudent(id)` / `restoreClass(id)` → delegates
- `hardDeleteStudent(id)` / `hardDeleteClass(id)` → delegates
- `emptyBin()` → hard-delete all items (students first, then classes)

### 4. Shared Types
- `src/shared/types.ts`: add `DeletedStudentDto`, `DeletedClassDto`, `BinListDto`
- `src/shared/ipc-channels.ts`: add `BIN_LIST`, `BIN_RESTORE`, `BIN_HARD_DELETE`, `BIN_EMPTY`

### 5. IPC
New `src/main/ipc/bin.ipc.ts` — thin handlers that validate and delegate. Register in `app.ts`.

### 6. Preload
Add `bin` namespace to `src/preload/preload.ts`.

### 7. Renderer
- `src/renderer/views/BinView.vue` — grouped list with restore/permanent-delete/empty actions
- `src/renderer/router.ts` — add `/bin` route
- `src/renderer/components/Sidebar.vue` — add nav item

## Test Plan
1. Unit: add new repo interface methods to existing mocks
2. Integration: verify soft-deleted items appear in `findDeleted()`, restore sets `deleted_at = NULL`, hard-delete removes row + cascades
3. UI: manual verification
