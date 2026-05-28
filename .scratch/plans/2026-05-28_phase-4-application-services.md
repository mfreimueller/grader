# Plan: Phase 4 — Application Services

**Date:** 2026-05-28
**Goal:** Build all application services (Phase 4) plus the missing repository infrastructure they depend on.
**Depends on:** Phase 0–3 complete (Foundation, Domain Entities, Calculation Engine, Persistence)

---

## Overview

Phase 3 was marked done but lacks repository implementations for SchoolClass, Course, Session, Assessment, and Finding — these are needed before any application service can function.

The plan splits Phase 4 into two sub-phases:

- **Phase 4-A:** Repository interfaces + SQLite implementations (infrastructure gap fill)
- **Phase 4-B:** Application services (use-case orchestration)

Additionally, two cross-cutting changes are needed:

1. **Soft delete** — add `deleted_at` columns and update repositories.
2. **ID Generator** — domain-level UUID generation so services don't manage IDs.

---

## Cross-Cutting: Pre-Work

### C.1 Soft Delete (migration + repo changes)

**Current state:** `StudentRepository.delete()` does hard DELETE. The schema has no `deleted_at` columns.

**Changes:**

1. **New migration `MIGRATION_002`** in `db.ts`:
   - `ALTER TABLE students ADD COLUMN deleted_at TEXT`
   - `ALTER TABLE student_performances ADD COLUMN deleted_at TEXT`
   - `ALTER TABLE findings ADD COLUMN deleted_at TEXT`
   - `ALTER TABLE grades ADD COLUMN deleted_at TEXT`

2. **Update `SqliteStudentRepository`**:
   - `delete()`: sets `deleted_at = datetime('now')` instead of DELETE
   - `findAll()`, `findById()`: add `WHERE deleted_at IS NULL` to queries

3. **Update `SqliteGradeRepository`**:
   - `delete()`: sets `deleted_at` instead of DELETE
   - `findByStudent()`, `findByCourseAndStudent()`: filter out soft-deleted
   - `findPerformancesByAssessment()`, `findPerformancesByStudent()`: filter soft-deleted

4. **`SqliteFindingRepository`** (new):
   - `delete()`: sets `deleted_at`
   - Queries filter `WHERE deleted_at IS NULL`

**Tests:** Update existing integration tests to verify soft delete behavior (record exists after delete with `deleted_at` set, queries exclude it).

### C.2 ID Generator (`src/domain/shared/IdGenerator.ts`)

```typescript
export function generateId(): string {
  return crypto.randomUUID();
}
```

Pure function, no I/O. Uses Web Crypto API (available in Node 19+ / Electron 42+).

---

## Phase 4-A: Missing Repository Infrastructure

Each task: write failing test → domain interface → SQLite implementation.

### 4-A.1 `SchoolClassRepository` (interface + `SqliteSchoolClassRepository`)

| Method | Returns | Notes |
|--------|---------|-------|
| `findAll()` | `Promise<SchoolClass[]>` | — |
| `findById(id: string)` | `Promise<SchoolClass \| null>` | — |
| `save(schoolClass: SchoolClass)` | `Promise<void>` | INSERT OR REPLACE |
| `delete(id: string)` | `Promise<void>` | Hard delete (SchoolClass is not soft-deletable) |

**Interface location:** `src/domain/student/SchoolClassRepository.ts`
**Impl location:** `src/infrastructure/persistence/SqliteSchoolClassRepository.ts`
**Tests:** `tests/unit/domain/student/SchoolClassRepository.test.ts` + `tests/integration/infrastructure/SqliteSchoolClassRepository.test.ts`

### 4-A.2 `CourseRepository` (interface + `SqliteCourseRepository`)

| Method | Returns | Notes |
|--------|---------|-------|
| `findById(id: string)` | `Promise<Course \| null>` | Loads course + categories + compositions |
| `findBySchoolYear(schoolYear: SchoolYear)` | `Promise<Course[]>` | — |
| `findAll()` | `Promise<Course[]>` | — |
| `save(course: Course)` | `Promise<void>` | Persists course + assessment_categories + grade_compositions |
| `delete(id: string)` | `Promise<void>` | Hard delete (cascade to children) |

**Row→Course mapping:** Reconstructs Course entity with its owned AssessmentCategories and GradeCompositions. Uses stubs for SchoolClass.

**Interface location:** `src/domain/grade/CourseRepository.ts`
**Impl location:** `src/infrastructure/persistence/SqliteCourseRepository.ts`
**Tests:** domain interface unit test + integration test

### 4-A.3 `AssessmentRepository` (interface + `SqliteAssessmentRepository`)

| Method | Returns | Notes |
|--------|---------|-------|
| `findById(id: string)` | `Promise<Assessment \| null>` | STI: returns Assessment or GradedAssessment |
| `findBySession(sessionId: string)` | `Promise<Assessment[]>` | Includes STI discrimination |
| `save(assessment: Assessment \| GradedAssessment)` | `Promise<void>` | Writes to `assessments` table |
| `delete(id: string)` | `Promise<void>` | Hard delete |

**Interface location:** `src/domain/grade/AssessmentRepository.ts`
**Impl location:** `src/infrastructure/persistence/SqliteAssessmentRepository.ts`

### 4-A.4 `SessionRepository` (interface + `SqliteSessionRepository`)

| Method | Returns | Notes |
|--------|---------|-------|
| `findById(id: string)` | `Promise<Session \| null>` | Loads session + course + students + assessments |
| `findByCourse(courseId: string)` | `Promise<Session[]>` | Sorted by date DESC |
| `save(session: Session)` | `Promise<void>` | Persists session + assessments (including auto-seeded "Mündlich") |
| `delete(id: string)` | `Promise<void>` | Hard delete |

**Interface location:** `src/domain/grade/SessionRepository.ts`
**Impl location:** `src/infrastructure/persistence/SqliteSessionRepository.ts`

### 4-A.5 `FindingRepository` (interface + `SqliteFindingRepository`)

| Method | Returns | Notes |
|--------|---------|-------|
| `findByPerformance(performanceId: string)` | `Promise<Finding[]>` | Soft-delete filtered |
| `save(finding: Finding)` | `Promise<void>` | CTI: type + relevant column |
| `delete(id: string)` | `Promise<void>` | Sets `deleted_at` |

**Interface location:** `src/domain/grade/FindingRepository.ts`
**Impl location:** `src/infrastructure/persistence/SqliteFindingRepository.ts`

---

## Phase 4-B: Application Services

**Pattern for every service:**
- Constructor receives all repository dependencies (injected)
- Methods accept plain input objects, return plain DTOs (serializable)
- Fallible operations return `Result<T, E>`
- Domain objects constructed inside the service (validates invariants)
- No business logic — only orchestration

**All services in:** `src/application/<name>.ts`
**All tests in:** `tests/unit/application/<name>.test.ts`
**DTO types defined per service file** (exported for IPC handlers)

### 4.1 `SchoolClassService`

```
Constructor(classRepo: SchoolClassRepository)

list(): Promise<SchoolClassDTO[]>
create(input: CreateSchoolClassInput): Promise<Result<SchoolClassDTO>>
  Input: { name: string; schoolYear: string }
  → Create SchoolYear VO, SchoolClass entity → save
update(id: string, input: UpdateSchoolClassInput): Promise<Result<SchoolClassDTO>>
  Input: { name?: string }
delete(id: string): Promise<Result<void>>
```

**DTOs:**
```typescript
export interface SchoolClassDTO {
  id: string; name: string; schoolYear: string;
}
export interface CreateSchoolClassInput {
  name: string; schoolYear: string;
}
export interface UpdateSchoolClassInput {
  name?: string;
}
```

**Depends on:** `SchoolClassRepository`

### 4.2 `StudentService`

```
Constructor(studentRepo: StudentRepository, classRepo: SchoolClassRepository)

list(): Promise<StudentDTO[]>
  → Loads all students, returns DTOs with class info
create(input: CreateStudentInput): Promise<Result<StudentDTO>>
  Input: { firstName: string; lastName: string; classId: string; additionalInfo?: { key: string; value: string }[] }
  → generateId() → create StudentId, Name → fetch SchoolClass → Student.create() → add info → save → return DTO
update(id: string, input: UpdateStudentInput): Promise<Result<StudentDTO>>
delete(id: string): Promise<Result<void>>
  → Soft delete (repo sets deleted_at)
```

**DTOs:**
```typescript
export interface StudentDTO {
  id: string; firstName: string; lastName: string; fullName: string;
  classId: string; className: string; schoolYear: string;
}
export interface CreateStudentInput {
  firstName: string; lastName: string; classId: string;
  additionalInfo?: { key: string; value: string }[];
}
export interface UpdateStudentInput {
  firstName?: string; lastName?: string; classId?: string;
}
```

**Depends on:** `StudentRepository`, `SchoolClassRepository`

### 4.3 `CourseService`

```
Constructor(courseRepo: CourseRepository, classRepo: SchoolClassRepository)

list(params?: { schoolYear?: string }): Promise<CourseDTO[]>
  → Default: current school year (system clock). If schoolYear provided, filter by it.
create(input: CreateCourseInput): Promise<Result<CourseDTO>>
  Input: { title: string; classId: string }
  → generateId() → fetch SchoolClass → Course.create() (auto-seeds "Mitarbeit" category) → save → return DTO
clone(id: string, targetClassId: string): Promise<Result<CourseDTO>>
  → Load source Course → fetch target SchoolClass → new Course (generated ID) → copy categories (new IDs) + compositions → save (no performances/sessions) → return DTO
update(id: string, input: UpdateCourseInput): Promise<Result<CourseDTO>>
delete(id: string): Promise<Result<void>>
```

**DTOs:**
```typescript
export interface CourseDTO {
  id: string; title: string; classId: string; className: string; schoolYear: string;
  categories: CategoryDTO[]; compositions: CompositionDTO[];
}
export interface CategoryDTO {
  id: string; title: string; gradingType: GradingType; displayAsGrade: boolean; courseId: string;
}
export interface CompositionDTO {
  categoryId: string; weight: number;
}
export interface CreateCourseInput {
  title: string; classId: string;
}
export interface UpdateCourseInput {
  title?: string;
}
```

**Depends on:** `CourseRepository`, `SchoolClassRepository`

### 4.4 `AssessmentCategoryService`

```
Constructor(courseRepo: CourseRepository)

listByCourse(courseId: string): Promise<CategoryDTO[]>
create(input: CreateCategoryInput): Promise<Result<CategoryDTO>>
  Input: { title: string; gradingType: GradingType; displayAsGrade: boolean; courseId: string }
  → generateId() → create AssessmentCategory → load Course → course.addAssessmentCategory() → save course → return DTO
update(id: string, input: UpdateCategoryInput): Promise<Result<CategoryDTO>>
  → Prevent changing gradingType of default "Mitarbeit" category → ConflictError
delete(id: string): Promise<Result<void>>
  → Prevent deletion of default "Mitarbeit" category → ConflictError
```

**DTOs:**
```typescript
export interface CreateCategoryInput {
  title: string; gradingType: GradingType; displayAsGrade: boolean; courseId: string;
}
export interface UpdateCategoryInput {
  title?: string; gradingType?: GradingType; displayAsGrade?: boolean;
}
```

**Depends on:** `CourseRepository`

### 4.5 `SessionService`

```
Constructor(sessionRepo: SessionRepository, courseRepo: CourseRepository, studentRepo: StudentRepository)

listByCourse(courseId: string): Promise<SessionDTO[]>
  → Sorted by date DESC
create(input: CreateSessionInput): Promise<Result<SessionDTO>>
  Input: { date: string; notes: string; courseId: string }
  → generateId() → fetch Course → Session.create() (auto-seeds "Mündlich" Assessment) → save → return DTO
delete(id: string): Promise<Result<void>>
```

**DTOs:**
```typescript
export interface SessionDTO {
  id: string; date: string; notes: string; courseId: string;
  assessments: AssessmentDTO[];
}
export interface AssessmentDTO {
  id: string; title: string; date: string; categoryId: string;
  categoryTitle: string; courseId: string; isImpromptu: boolean;
  maxPoints?: number; gradingType: GradingType;
}
export interface CreateSessionInput {
  date: string; notes: string; courseId: string;
}
```

**Depends on:** `SessionRepository`, `CourseRepository`, `StudentRepository`

### 4.6 `AssessmentService`

```
Constructor(assessmentRepo: AssessmentRepository, sessionRepo: SessionRepository, courseRepo: CourseRepository)

listBySession(sessionId: string): Promise<AssessmentDTO[]>
create(input: CreateAssessmentInput): Promise<Result<AssessmentDTO>>
  Input: { title: string; date: string; categoryId: string; courseId: string; sessionId: string; maxPoints?: number }
  → generateId() → load category from course → if gradingType is NUMERIC: GradedAssessment.create(), else: new Assessment() → save → return DTO
createImpromptu(input: CreateImpromptuAssessmentInput): Promise<Result<AssessmentDTO>>
  Input: { title: string; date: string; categoryId: string; courseId: string; studentId: string; maxPoints?: number }
  → Same as create but with isImpromptu: true
delete(id: string): Promise<Result<void>>
```

**DTOs:**
```typescript
export interface CreateAssessmentInput {
  title: string; date: string; categoryId: string; courseId: string; sessionId: string; maxPoints?: number;
}
export interface CreateImpromptuAssessmentInput {
  title: string; date: string; categoryId: string; courseId: string; studentId: string; maxPoints?: number;
}
```

**Depends on:** `AssessmentRepository`, `SessionRepository`, `CourseRepository`

### 4.7 `GradingService`

```
Constructor(gradeRepo: GradeRepository, assessmentRepo: AssessmentRepository, studentRepo: StudentRepository)

recordPerformance(input: RecordPerformanceInput): Promise<Result<StudentPerformanceDTO>>
  Input: { id?: string; performanceId: string; date: string; studentId: string; assessmentId: string; score?: number; symbol?: string }
  → If id provided: update existing; else: generateId()
  → Load assessment → determine type from category.gradingType:
    - NUMERIC: GradedPerformance.create(id, date, student, GradedAssessment, score)
    - TERTIARY: ParticipationPerformance.create(id, date, student, Assessment, ParticipationSymbol)
  → savePerformance() → return DTO
getPerformancesByAssessment(assessmentId: string): Promise<StudentPerformanceDTO[]>
listByStudent(studentId: string): Promise<StudentPerformanceDTO[]>
saveManualGrade(input: SaveManualGradeInput): Promise<Result<GradeDTO>>
  Input: { id?: string; studentId: string; courseId: string; score: number }
  → If id provided: update; else: generateId()
  → Grade.create(id, student, course, score) → save → return DTO
```

**DTOs:**
```typescript
export interface StudentPerformanceDTO {
  id: string; date: string; studentId: string; assessmentId: string;
  score?: number | null; symbol?: string | null; type: 'graded' | 'participation';
  studentFirstName?: string; studentLastName?: string;
}
export interface GradeDTO {
  id: string; studentId: string; courseId: string; score: number;
}
export interface RecordPerformanceInput {
  id?: string; date: string; studentId: string; assessmentId: string;
  score?: number; symbol?: string;
}
export interface SaveManualGradeInput {
  id?: string; studentId: string; courseId: string; score: number;
}
```

**Depends on:** `GradeRepository`, `AssessmentRepository`, `StudentRepository`

### 4.8 `FindingService`

```
Constructor(findingRepo: FindingRepository)

add(input: AddFindingInput): Promise<Result<FindingDTO>>
  Input: { performanceId: string; type: 'note' | 'document' | 'remote_document'; text?: string; filePath?: string; url?: string }
  → generateId() → create Note/Document/RemoteDocument → save → return DTO
remove(id: string): Promise<Result<void>>
  → Soft delete
getFindings(performanceId: string): Promise<FindingDTO[]>
```

**DTOs:**
```typescript
export interface FindingDTO {
  id: string; type: string; text?: string; filePath?: string; url?: string; performanceId: string;
}
export interface AddFindingInput {
  performanceId: string; type: 'note' | 'document' | 'remote_document';
  text?: string; filePath?: string; url?: string;
}
```

**Depends on:** `FindingRepository`

### 4.9 `GradeCalculationAppService`

```
Constructor(gradeRepo: GradeRepository, courseRepo: CourseRepository, gradingService: GradingService)

calculateFinal(courseId: string, studentId: string): Promise<Result<CalculationResultDTO>>
  → Load course from CourseRepository (for compositions)
  → Load all performances via gradingService.listByStudent(studentId)
  → Filter performances by courseId (they already belong to a course via assessment)
  → Create GradeCalculationService instance → call calculate(performances, course, referenceDate)
  → Return { rawScore, displayGrade, performanceCount }
```

**DTOs:**
```typescript
export interface CalculationResultDTO {
  rawScore: number; displayGrade: 1 | 2 | 3 | 4 | 5; performanceCount: number;
}
```

**Depends on:** `CourseRepository`, `GradeRepository`, `GradeCalculationService` (domain), `GradingService`

### 4.10 `ImpromptuAssessmentService`

```
Constructor(assessmentService: AssessmentService, gradingService: GradingService)

recordImpromptu(input: RecordImpromptuInput): Promise<Result<ImpromptuResultDTO>>
  Input: { title: string; date: string; categoryId: string; courseId: string; studentId: string; score?: number; symbol?: string }
  → Create assessment via assessmentService.createImpromptu(...) (isImpromptu=true)
  → Create performance via gradingService.recordPerformance(...) with the new assessment's ID
  → Return both as a combined DTO
```

**DTOs:**
```typescript
export interface RecordImpromptuInput {
  title: string; date: string; categoryId: string; courseId: string;
  studentId: string; score?: number; symbol?: string;
}
export interface ImpromptuResultDTO {
  assessment: AssessmentDTO; performance: StudentPerformanceDTO;
}
```

**Depends on:** `AssessmentService`, `GradingService`

### 4.11 `ReportService`

```
Constructor(reportRepo: ReportRepository, pdfGen: PdfReportGenerator, csvExport: DataExportService, calcService: GradeCalculationAppService)

generate(courseId: string, mode: 'full' | 'reduced'): Promise<Result<Buffer>>
  → Fetch CourseReportData from ReportRepository
  → If mode === 'full': include all performances with display conversion (via calcService)
  → If mode === 'reduced': only manual grades
  → Delegate to PdfReportGenerator.generateCourseReport(courseId, reportData, mode)
  → Return PDF buffer
```

**DTOs:**
```typescript
// Uses CourseReportData and related types from domain/report/CourseReportData.ts
export type ReportMode = 'full' | 'reduced';
```

**Depends on:** `ReportRepository`, `PdfReportGenerator`, `DataExportService`, `GradeCalculationAppService`

---

## Dependency Graph

```
C.1 Soft Delete (schema migration + repo updates)
  │
  └──► C.2 ID Generator (domain/shared/IdGenerator.ts)
        │
        └──► Phase 4-A: Repository Interfaces & Impls
              ├── 4-A.1 SchoolClassRepo
              ├── 4-A.2 CourseRepo
              ├── 4-A.3 AssessmentRepo
              ├── 4-A.4 SessionRepo
              └── 4-A.5 FindingRepo
                    │
                    └──► Phase 4-B: Application Services
                          ├── 4.1 SchoolClassService (→ SchoolClassRepo)
                          ├── 4.2 StudentService (→ StudentRepo, SchoolClassRepo)
                          ├── 4.3 CourseService (→ CourseRepo, SchoolClassRepo)
                          ├── 4.4 AssessmentCategoryService (→ CourseRepo)
                          ├── 4.5 SessionService (→ SessionRepo, CourseRepo, StudentRepo)
                          ├── 4.6 AssessmentService (→ AssessmentRepo, SessionRepo, CourseRepo)
                          ├── 4.7 GradingService (→ GradeRepo, AssessmentRepo, StudentRepo)
                          ├── 4.8 FindingService (→ FindingRepo)
                          ├── 4.9 GradeCalculationAppService (→ CourseRepo, GradeRepo, GradingService)
                          ├── 4.10 ImpromptuAssessmentService (→ AssessmentService, GradingService)
                          └── 4.11 ReportService (→ ReportRepo, PdfReportGenerator, DataExportService)
```

---

## Parallelization

- **C.1 + C.2:** Sequential (C.2 is trivial, can be first)
- **4-A.1 → 4-A.2 → 4-A.3 + 4-A.4 + 4-A.5:** Sequential chain, then parallel leaves
  - 4-A.3 and 4-A.4 can be parallel (independent interfaces)
  - 4-A.5 can be parallel (fully independent)
- **4-B Services by dependency tier:**
  - Tier 1 (no service deps): 4.1, 4.2, 4.8 — parallel
  - Tier 2 (depends on Tier 1): 4.3, 4.4, 4.5 — parallel
  - Tier 3: 4.6, 4.7 — parallel
  - Tier 4: 4.9, 4.10 — parallel
  - Tier 5: 4.11 — after 4.9

---

## Definition of Done

- [ ] All Phase 4-A repository interfaces exist with full method signatures
- [ ] All Phase 4-A SQLite implementations pass integration tests (in-memory SQLite)
- [ ] All Phase 4-B application services exist with unit tests (mocked repos)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (all existing + new tests)
- [ ] Soft delete works for Student, StudentPerformance, Finding, Grade
- [ ] All existing tests still pass (no regressions)

---

## Open Questions

- `PdfReportGenerator.generateCourseReport()` currently only accepts `courseId`. Needs to be extended to accept `mode: 'full' | 'reduced'` and the pre-computed report data. Should this be done in 4.11 or as a refactor in Phase 4-A?
- The `GradeCalculationAppService.calculateFinal()` needs to filter performances by course. Currently `GradingService.listByStudent()` returns all performances for a student. The service will need to cross-reference with the assessment's course. Should this filtering happen in the service or should we add a dedicated repo query?
