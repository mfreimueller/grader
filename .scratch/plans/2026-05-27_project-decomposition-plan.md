# Plan: Decompose grdr into Atomic Sub-Tasks

**Date:** 2026-05-28
**Goal:** Break the full grdr Electron application down into independently implementable, testable sub-tasks with clear dependency ordering.

**Framework choice:** Vue 3 (Composition API, SFC) for the renderer.
**Feature priority:** Phase 1–3: CRUD screens → Phase 4: Grading engine → Phase 5: Reporting.

---

## Dependency Graph (Top-Level)

```
Phase 0: Project Foundation (no deps)
  └─► Phase 1: Domain Layer — Core Entities & VOs (pure TS, no I/O)
       └─► Phase 2: Domain Layer — Grade Calculation Engine
            └─► Phase 3: Infrastructure / Persistence (depends on domain interfaces)
                 └─► Phase 4: Application Services (orchestration)
                      └─► Phase 5: IPC Layer (thin handlers)
                           └─► Phase 6: Preload (contextBridge)
                                └─► Phase 7: Renderer / Vue UI (depends on preload API)
                                     └─► Phase 8: Integration & E2E Tests
```

---

## Phase 0: Project Foundation (8 tasks)

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 0.1 | **Set up TypeScript config** | `tsconfig.json` (strict), `tsconfig.main.json` (CommonJS), `tsconfig.renderer.json` (ESM). Install `typescript`. | — |
| 0.2 | **Set up ESLint** | Create `eslint.config.js` with TS + Vue plugin rules. | 0.1 |
| 0.3 | **Set up Jest** | Create `jest.config.ts` with unit/integration presets. Install `jest`, `ts-jest`, `@types/jest`. | 0.1 |
| 0.4 | **Create full directory structure** | Per AGENTS.md §5: all `src/` subdirectories, `tests/unit/`, `tests/integration/`, `tests/e2e/`, `assets/`, `build/`. | — |
| 0.5 | **Configure Electron with security** | Replace `main.js` → `src/main/app.ts`. `BrowserWindow` with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP headers, navigation blocking. | 0.1 |
| 0.6 | **Create `src/shared/` types** | `types.ts` (exported interfaces), `errors.ts` (DomainError hierarchy), `ipc-channels.ts` (channel name constants). | — |
| 0.7 | **Set up electron-builder** | `electron-builder.yml`, `npm run build`/`package` scripts. | 0.1 |
| 0.8 | **Set up Playwright** | Install and configure for E2E tests. | 0.4 |

**Definition of Done:** `npm run typecheck && npm run lint && npm run test` all pass.

---

## Phase 1: Domain Layer — Core Entities & Value Objects (Pure TypeScript)

### Priority: CRUD Support

Grouped by bounded context. Each task: write failing test → implement → refactor.

### 1-A: Shared Building Blocks

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 1.1 | **`Entity<TId>` base class** | Abstract with `id` property + `equals(other)` by identity. | — |
| 1.2 | **`ValueObject<T>` base class** | Abstract with `props` + structural `equals()` via deep comparison. | — |
| 1.3 | **`DomainError` + subclasses** | `ValidationError`, `NotFoundError`. Extends `Error`. | — |
| 1.4 | **`Result<T, E>` type** | `{ ok: true; value: T } | { ok: false; error: E }`. | — |

### 1-B: Student Context

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 1.5 | **`StudentId` VO** | Branded string type + factory. Tests: creation, equality. | 1.2, 1.4 |
| 1.6 | **`Name` VO** | Props: `firstName`, `lastName` (non-empty strings). Tests: valid creation, rejects empty. | 1.2, 1.4 |
| 1.7 | **`AdditionalInformation` VO** | Props: `key`, `value`. Equality by key. | 1.2 |
| 1.8 | **`SchoolYear` VO** | Format `YYYY/YY`. Tests: valid format, parsing, comparison, ordering. | 1.2, 1.4 |
| 1.9 | **`SchoolClass` entity** | Props: id, name, schoolYear. Aggregate for student groups. Tests: creation, identity, year filter. | 1.1, 1.8 |
| 1.10 | **`Student` aggregate root** | Props: id, name, class, additionalInfo list. Tests: create, add/remove info, change class. | 1.1, 1.5–1.9 |
| 1.11 | **`StudentRepository` interface** | Port: `findById`, `findAll`, `save`, `delete`. | 1.10 |

### 1-C: Course & Assessment Context (Simplified Model)

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 1.12 | **`GradingType` enum** | `NUMERIC` (points-based) or `TERTIARY` (symbol-based). Tests: string mapping, exhaustiveness. | 1.2 |
| 1.13 | **`ParticipationSymbol` VO** | Enum: `PLUS`, `MINUS`, `WELLE`. Tests: valid values, `toScore()` mapping (PLUS=2.0, WELLE=1.0, MINUS=0.0). | 1.2, 1.4 |
| 1.14 | **`AssessmentCategory` entity** | Props: id, title, gradingType, displayAsGrade. Aggregate-owned by Course. Tests: create, update gradingType, toggle displayAsGrade. | 1.1, 1.12 |
| 1.15 | **`GradeComposition` VO** | Props: assessmentCategory (→AssessmentCategory), weight (0 < w < 100). Tests: valid weights, out-of-range rejection. | 1.2, 1.4, 1.14 |
| 1.16 | **`Course` entity** | Props: id, title, schoolClass, gradeCompositions, assessmentCategories, sessions, grades lists. Aggregate root. Tests: create, add/remove composition, add category, default "Mitarbeit" seed. | 1.1, 1.9, 1.15, 1.14 |
| 1.17 | **`Assessment` entity** | Props: id, title, date, category (→AssessmentCategory), course, isImpromptu. Tests: create with category, isImpromptu flag. | 1.1, 1.14, 1.16 |
| 1.18 | **`GradedAssessment` entity** | Extends `Assessment`. Adds `maxPoints: int` (> 0). Tests: valid points, zero/negative rejection. | 1.17, 1.4 |
| 1.19 | **`Session` entity** | Props: id, date, notes, students list. Created per course meeting. Tests: create, add/remove students, default "Mündlich" assessment. | 1.1, 1.10, 1.17 |
| 1.20 | **`Grade` entity** | Props: id, student, score (int 1–5). Manually entered final grade. Tests: valid range 1–5, per-student-per-course uniqueness. | 1.1, 1.10, 1.16 |
| 1.21 | **`StudentPerformance` abstract** | Base: id, date, student, assessment, score (int ≥ 0, nullable — null = not yet graded), findings. Tests: creation, linkage validation, nullable score. | 1.1, 1.10, 1.17 |
| 1.22 | **`GradedPerformance` entity** | Extends `StudentPerformance`. Uses inherited `score` (points achieved ≤ maxPoints). Tests: score within maxPoints bounds. | 1.21 |
| 1.23 | **`ParticipationPerformance` entity** | Extends `StudentPerformance`. Adds `symbol: ParticipationSymbol`. Tests: valid symbol, toScore(). | 1.21, 1.13 |
| 1.24 | **`Finding` abstract entity** | Base: id. Tests: equality. | 1.1 |
| 1.25 | **`Document` entity** | Props: filePath (absolute path). Tests: path validation. | 1.24 |
| 1.26 | **`Note` entity** | Props: text. Tests: empty vs non-empty. | 1.24 |
| 1.27 | **`RemoteDocument` entity** | Props: url. Tests: URL format validation. | 1.24 |
| 1.28 | **`GradeRepository` interface** | Port: `findByStudent`, `findByAssessment`, `findByCourseAndStudent`, `save`, `delete`. | 1.20 |

### 1-D: Report Context (Simplified — per-course reports)

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 1.29 | **`CourseReportData` type** | View model (not domain entity): course info, sorted student list (name, grade, performances with display formatting). Tests: correct sorting, display format selection (raw points vs converted grade vs symbol). | 1.16, 1.20, 1.22, 1.23, 2.5 |
| 1.30 | **`ReportRepository` interface** | Port: `findCourseReportData(courseId): Promise<CourseReportData>`. Reads from existing aggregate data. | 1.29 |

---

## Phase 2: Domain Layer — Grade Calculation Engine (Pure TypeScript)

### Priority: After CRUD domain entities

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 2.1 | **Performance normalization fn** | `normalize(p: StudentPerformance, assessment: Assessment): number`. For GradedPerformance: `score / maxPoints` (ratio). For ParticipationPerformance: `toScore(symbol)` (2.0/1.0/0.0). Tests: all combinations, edge cases (0/maxPoints, maxPoints/maxPoints). | 1.22, 1.23, 1.18 |
| 2.2 | **Recency weight fn** | `calculateWeight(date, schoolYearStart): number`. Returns `DaysBetween(start, date) + 1`. Tests: known dates → known weights, edge cases (same day, day 0). | 1.8 |
| 2.3 | **Category-weighted mean fn** | `calculateCategoryMean(performances, assessments, category): Result<number>`. Uses 2.1 + 2.2. Tests: single/multiple perfs, empty set. | 2.1, 2.2, 1.14, 1.4 |
| 2.4 | **Final grade calculator fn** | `calculateFinalGrade(categoryMeans, compositions): Result<number>`. Weighted avg with dynamic normalization for empty categories. Tests: all active, some inactive, all empty, division-by-zero edge case. | 2.3, 1.15, 1.4 |
| 2.5 | **`GradeCalculationService`** | Orchestrates 2.1–2.4 as single pipeline: student + course → final grade. Also provides `convertToDisplayGrade(score, maxPoints, displayAsGrade)` for UI/report display. Tests: end-to-end domain calculation with mock data. | 2.1–2.4 |

---

## Phase 3: Infrastructure / Persistence Layer

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 3.1 | **Database connection + migration runner** | `db.ts`: init SQLite, PRAGMA foreign_keys, run migrations. Install `better-sqlite3`. | 0.4, 0.6 |
| 3.2 | **Schema migration (DDL)** | All tables per §2.3 of requirements: School_Classes, Students, Student_Additional_Information, Courses, Assessment_Categories, Grade_Compositions, Sessions, Assessments, Student_Performances, Findings, Grades. FKs, CHECK, STI discriminators, `deleted_at` columns for soft-delete entities. | 3.1 |
| 3.3 | **`SqliteStudentRepository`** | Implements `StudentRepository`. Row ↔ domain object mapping. Tests: CRUD against in-memory SQLite. | 1.11, 3.2 |
| 3.4 | **`SqliteGradeRepository`** | Implements `GradeRepository`. Handles STI for Assessments and Student_Performances. Tests: full hierarchy CRUD. | 1.28, 3.2 |
| 3.5 | **`SqliteReportRepository`** | Implements `ReportRepository`. Tests: find/save reports. | 1.30, 3.2 |
| 3.6 | **`PdfReportGenerator`** | Generates PDF report cards via `pdfkit`. Tests: file creation, content structure. | 0.4 |
| 3.7 | **`DataExportService`** | CSV export for student/grade data. Tests: format correctness. | 0.4 |

---

## Phase 4: Application Services (Use-Case Orchestration)

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 4.1 | **`StudentService`** | `list`, `create`, `update`, `delete` (soft), `getWithPerformances`. Translates between IPC DTOs and domain. Tests: mocked repo. | 1.10–1.11, 3.3 |
| 4.2 | **`SchoolClassService`** | `list`, `create`, `rename`, `delete`. Tests: mocked repo. | 1.9, 3.3 |
| 4.3 | **`CourseService`** | `listByYear`, `create` (with default "Mitarbeit" category seed), `clone` (duplicate + assessment configs, no performances), `update`, `delete`. Tests: mocked repo. | 1.16, 3.3–3.4 |
| 4.4 | **`AssessmentCategoryService`** | `listByCourse`, `create`, `update`, `delete` (prevent deletion of default "Mitarbeit"). Tests: mocked repo. | 1.14, 3.4 |
| 4.5 | **`SessionService`** | `listByCourse` (sorted by date DESC), `create` (with default "Mündlich" assessment seed), `delete`. Tests: mocked repo. | 1.19, 3.4 |
| 4.6 | **`AssessmentService`** | `listBySession`, `create` (with category, optional maxPoints for NUMERIC), `delete` (soft). Tests: mocked repo. | 1.17–1.18, 3.4 |
| 4.7 | **`GradingService`** | `recordPerformance` (auto-selects Graded vs Participation based on category gradingType), `getPerformancesByAssessment` (per-student), `getByStudent`, `recordManualGrade`. Tests: mocked repo. | 1.21–1.23, 3.4 |
| 4.8 | **`FindingService`** | `add`, `remove`, `getFindings`. Tests: mocked repo. | 1.24–1.27, 3.4 |
| 4.9 | **`GradeCalculationAppService`** | Wraps domain calc (2.5). Fetches data via repos, runs pipeline, returns result. Provides display conversion. Tests: integration with mocked repo. | 2.5, 3.4 |
| 4.10 | **`ImpromptuAssessmentService`** | Creates Assessment (with `isImpromptu: true`) + StudentPerformance for one student in one transaction. Tests: mocked repo. | 4.6, 4.7 |
| 4.11 | **`ReportService`** | `generate`: query course data → build sorted CourseReportData → generate PDF (Full or Reduced mode). Tests: mocks. | 1.29–1.30, 3.5–3.6, 4.9 |

---

## Phase 5: IPC Layer

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 5.1 | **Define all IPC channel constants** | In `src/shared/ipc-channels.ts`: student:, class:, course:, assessment_category:, session:, assessment:, grade:, finding:, report: channels. | 0.6 |
| 5.2 | **Zod schemas for IPC input** | Validate every IPC payload at the boundary. Tests: valid/invalid payloads rejected. | 5.1 |
| 5.3 | **`student.ipc.ts`** | Thin handlers: validate → delegate to StudentService → return plain object. | 5.1–5.2, 4.1 |
| 5.4 | **`course.ipc.ts`** | Handlers for class + course + assessment-category channels. | 5.1–5.2, 4.2–4.4 |
| 5.5 | **`session.ipc.ts`** | Handlers for session channels. | 5.1–5.2, 4.5 |
| 5.6 | **`grade.ipc.ts`** | Handlers for assessment, grading (manual grade + performances), finding, calculation channels. | 5.1–5.2, 4.6–4.10 |
| 5.7 | **`report.ipc.ts`** | Handlers for report generation (Full/Reduced mode). | 5.1–5.2, 4.11 |
| 5.8 | **Register all handlers in `app.ts`** | Wire up all IPC modules on app startup. | 5.3–5.7 |

---

## Phase 6: Preload Script

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 6.1 | **Define `IpcApi` interface** | In `src/shared/types.ts`: typed surface for `window.grdr.*` matching every IPC channel. | 5.1 |
| 6.2 | **Implement `preload.ts`** | `contextBridge.exposeInMainWorld('grdr', api)` with `ipcRenderer.invoke` for every channel. | 6.1 |
| 6.3 | **Security verification** | Confirm `sandbox: true` works, no `require()`, only `contextBridge` + `ipcRenderer`. | 6.2, 0.5 |

---

## Phase 7: Renderer / Vue UI

### 7-A: Application Shell & Navigation

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 7.1 | **Scaffold Vue 3 app** | Install Vue 3 + Vite, create `src/renderer/main.ts`, `App.vue`, router setup. Wire to Electron. | 0.5, 0.4 |
| 7.2 | **Sidebar navigation component** | Persistent left nav: Students, Classes, Courses. Vue Router integration. | 7.1 |
| 7.3 | **App-level layout & CSS** | Consistent grid, variable-based theming. | 7.1 |

### 7-B: Manage Students (CRUD)

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 7.4 | **Student list view** | Datatable of all students, search/filter by name/class. Calls `window.grdr.student.list()`. | 6.2, 7.2 |
| 7.5 | **Student create modal** | Form: firstName, lastName, class selector (dropdown), dynamic additionalInfo key-value pairs. Calls `grdr.student.create()`. | 6.2, 7.4 |
| 7.6 | **Student detail card** | Shows all attributes + historical performances across courses (nested list). Calls `grdr.student.get()` + `grdr.grade.listByStudent()`. | 6.2, 7.4 |
| 7.7 | **Student edit modal** | Inline editing of name, class transfer. Calls `grdr.student.update()`. | 6.2, 7.4 |

### 7-C: Manage Classes (CRUD)

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 7.8 | **Class list view** | Grouped by school year. Calls `grdr.class.list()`. | 6.2, 7.2 |
| 7.9 | **Class create/edit modal** | School year + name. Calls `grdr.class.create()` / `update()`. | 6.2, 7.8 |

### 7-D: Manage Courses (CRUD)

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 7.10 | **Course list view** | Default: current school year only. Toggle "Show Past Courses". Calls `grdr.course.list()`. | 6.2, 7.2 |
| 7.11 | **Course create modal** | Title, class selection. Calls `grdr.course.create()`. | 6.2, 7.10 |
| 7.12 | **Course clone dialog** | Select target class → confirm. Calls `grdr.course.clone()`. | 6.2, 7.10 |

### 7-E: Course Workspace (Tabs)

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 7.13 | **Course workspace shell** | 4-tab layout: Sessions \| Grading \| Students \| Assessment Types. Nested router within course context. | 7.2 |
| 7.14 | **Sessions list view** | Lists sessions sorted by date DESC. Each session expands to show assessment table per student. Default "Mündlich" assessment auto-created per session. Calls `grdr.session.list()`, `grdr.assessment.listBySession()`. | 6.2, 7.13 |
| 7.15 | **Create session panel** | Date picker, optional notes. Triggers default "Mündlich" assessment creation. Calls `grdr.session.create()`. | 6.2, 7.13 |
| 7.16 | **Session assessment table** | Per-session: alphabetical student rows with assessed performances. TERTIARY → button group (+/~/-), NUMERIC → points input + maxPoints display. Impromptu "Neue Leistung" button per student. Quick findings text input. Keyboard-navigable. Calls `grdr.grade.recordPerformance()`, `grdr.assessment.createImpromptu()`. | 6.2, 7.13 |
| 7.17 | **New assessment for session** | Title, AssessmentCategory dropdown, maxPoints (conditional on NUMERIC), date. Calls `grdr.assessment.create()`. | 6.2, 7.13 |
| 7.18 | **Course grading view** | Alphabetical student table: Name \| Grade (manual) \| Calculated Grade \| Perf #1 \| Perf #2 \| ... Supports `displayAsGrade` conversion, raw points, and symbol display. Calls `grdr.grade.calculateFinal()`, `grdr.grade.saveManualGrade()`. | 6.2, 7.13 |
| 7.19 | **Student roster + impromptu** | Student list with "Impromptu Assessment" button per row. | 6.2, 7.13 |
| 7.20 | **Impromptu assessment dialog** | AssessmentCategory selector, grade/symbol input, date picker. Creates Assessment (`isImpromptu: true`) + StudentPerformance in one step. Calls `grdr.grade.recordImpromptu()`. | 6.2, 7.19 |
| 7.21 | **Assessment categories management** | List/create/edit/delete categories. Prevent deletion of default "Mitarbeit". Calls `grdr.assessmentCategory.*()`. | 6.2, 7.13 |

### 7-F: Reports

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 7.22 | **Report configuration view** | Course selector (dropdown), report mode toggle (Full / Reduced), "Generate PDF" button. Calls `grdr.report.generate()`. | 6.2, 7.2 |
| 7.23 | **PDF report rendering** | Per-course PDF with alphabetical student table. Full mode: grade + all performances (with display conversion). Reduced mode: only final grades. Calls `grdr.report.generate()`. | 6.2, 7.22 |

---

## Phase 8: Integration & E2E Tests

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 8.1 | **Integration: SqliteStudentRepository** | Full CRUD (with soft delete), cascade rules, additional information mapping. | 3.3 |
| 8.2 | **Integration: SqliteGradeRepository** | STI for Assessment and StudentPerformance hierarchies, AssessmentCategory + Session CRUD. | 3.4 |
| 8.3 | **Integration: SqliteReportRepository** | Read course report data. | 3.5 |
| 8.4 | **Integration: Grade calculation pipeline** | Insert students, assessments (NUMERIC + TERTIARY), performances → run 4.9 → verify result with display conversion. | 4.9 |
| 8.5 | **E2E: Create student flow** | Launch app → navigate to Students → create → verify in list. | 7.4–7.5 |
| 8.6 | **E2E: Full course → session → assessment → grade flow** | Create class → course → create session → assess all students with both NUMERIC and TERTIARY categories → verify in grading view. | 7.8–7.18 |
| 8.7 | **E2E: Impromptu assessment** | Course → session view → "+ Neue Leistung" per student → verify. | 7.19–7.20 |
| 8.8 | **E2E: Course cloning** | Clone course with assessments + categories to new class. Verify performances not cloned. | 7.12 |
| 8.9 | **E2E: Report generation** | Generate Full and Reduced PDF report for a course. Verify content. | 7.22–7.23 |

---

## Execution Order & Parallelization

```
Phase 0 (0.1–0.8) — sequential
  │
  ├──► Phase 1 (1.1–1.30) — sequential within contexts, parallel across contexts
  │     ├── 1-A (shared) → 1-B (student) ────────────────► 1-D (report, lighter)
  │     └── 1-A (shared) → 1-C (assessment, simplified model)
  │
  ├──► Phase 2 (2.1–2.5) — depends on 1-C, sequential pipeline
  │
  ├──► Phase 3 (3.1–3.7) — 3.1→3.2 first, then 3.3–3.7 in parallel
  │
  ├──► Phase 4 (4.1–4.11) — mostly parallel per bounded context
  │
  ├──► Phase 5 (5.1–5.8) — 5.1→5.2→5.3–5.7 (parallel)→5.8
  │
  ├──► Phase 6 (6.1–6.3) — sequential
  │
  ├──► Phase 7 (7.1–7.23)
  │     ├── 7.1–7.3 (Vue scaffold + shell) — first
  │     ├── 7.4–7.9 (Students + Classes CRUD) — parallel
  │     ├── 7.10–7.12 (Courses CRUD) — after shell
  │     ├── 7.13–7.21 (Workspace tabs: Sessions, Grading, Students, Types) — after Courses
  │     └── 7.22–7.23 (Reports) — after Grading
  │
  └──► Phase 8 (8.1–8.9) — integration first, then E2E
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Vue 3 + Composition API** for renderer | User preference; lightweight SFCs, good TS support, no heavy framework overhead |
| **`better-sqlite3`** | Synchronous API, simpler in Electron main process, well-typed |
| **Zod** for IPC boundary validation | Runtime validation + TypeScript type inference, lightweight |
| **STI** for domain hierarchies | Assessment, StudentPerformance, Finding hierarchies still use STI |
| **AssessmentCategory replaces fixed hierarchy** | Users define their own assessment types (title + gradingType + displayAsGrade) instead of hardcoded subtypes |
| **Points-based grading** | GradedPerformance stores raw points (score/maxPoints ratio), not 1–5 grade. 1–5 is only for display conversion |
| **Session entity** | Groups assessments by course meeting; auto-creates default "Mündlich" for "Mitarbeit" |
| **Soft delete** | Student, StudentPerformance, Finding, Grade use `deleted_at` instead of hard delete |
| **Per-course reports** | Reports show one course at a time with alphabetical student list; Full (grade + performances) and Reduced (grades only) modes |
| **Default language German** | UI/error messages in German; i18n infrastructure but only German available |
| **`pdfkit`** for PDF generation | Pure JS, no native deps, streaming API |
| **School year start = Sept 1** | Austrian academic calendar convention; make configurable later |
| **Feature priority** | CRUD screens first (data entry), then grading engine (core value), then reporting (output) |

---

## Open Questions

- Confirm Vue 3 build tooling: **Vite** as the bundler for the renderer process? (Standard for Vue 3 + Electron.)
- Prefer `vue-router` for SPA navigation or a simpler custom tab-switching approach?
~~`StudentPerformance.evaluation` dropped (outdated info). `score` is nullable — `null` = not yet graded.~~ *(Resolved 2026-05-28)*
