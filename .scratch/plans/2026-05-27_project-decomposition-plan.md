# Plan: Decompose grdr into Atomic Sub-Tasks

**Date:** 2026-05-27
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

### 1-C: Course & Assessment Context

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 1.12 | **`GradeLevel` VO** | Constrained integer 1–5 (LBVO §14). Tests: valid range, ordering, toPrimitive. | 1.2, 1.4 |
| 1.13 | **`ParticipationSymbol` VO** | Enum: `PLUS`, `MINUS`, `WELLE`. Tests: valid values, `toScore()` mapping (PLUS=2.0, WELLE=1.0, MINUS=0.0). | 1.2, 1.4 |
| 1.14 | **`AssessmentCategory` VO** | Discriminated union: `TEST`, `PRACTICAL_ASSESSMENT`, `ORAL`, `TRANSCRIPT`, `REVISION`, `HAND_IN`, `PROJECT`. Tests: string mapping, `isWritten()` / `isParticipation()` guards. | 1.2 |
| 1.15 | **`GradeComposition` VO** | Props: category, weight (0 < w < 100). Tests: valid weights, out-of-range rejection. | 1.2, 1.4, 1.14 |
| 1.16 | **`Course` entity** | Props: id, title, schoolClass, gradeCompositions list. Aggregate root for assessments. Tests: create, add/remove composition. | 1.1, 1.9, 1.15 |
| 1.17 | **`Assessment` abstract entity** | Base: id, title, date, category, course. Tests: equality, category access. | 1.1, 1.14, 1.16 |
| 1.18 | **`WrittenAssessment` abstract** | Extends `Assessment`. Adds `maxPoints: int` (> 0). Tests: valid points, zero/negative rejection. | 1.17, 1.4 |
| 1.19 | **`Test` entity** | Concrete; category = `TEST`. Tests: factory, category override. | 1.18 |
| 1.20 | **`PracticalAssessment` entity** | Concrete; category = `PRACTICAL_ASSESSMENT`. | 1.18 |
| 1.21 | **`ClassParticipation` abstract** | Extends `Assessment`. No additional props. | 1.17 |
| 1.22 | **`OralParticipation` entity** | Concrete; category = `ORAL`. | 1.21 |
| 1.23 | **`TranscriptAssessment` entity** | Concrete; category = `TRANSCRIPT`. | 1.21 |
| 1.24 | **`Revision` entity** | Concrete; category = `REVISION`. | 1.21 |
| 1.25 | **`HandIn` entity** | Concrete; category = `HAND_IN`. | 1.21 |
| 1.26 | **`Project` entity** | Concrete; category = `PROJECT`. | 1.21 |
| 1.27 | **`StudentPerformance` abstract** | Base: id, date, student, assessment, findings. Tests: creation, linkage validation. | 1.1, 1.10, 1.17 |
| 1.28 | **`GradedPerformance` entity** | Extends `StudentPerformance`. Adds `value: GradeLevel`. Tests: valid grade, 0–5 range. | 1.27, 1.12 |
| 1.29 | **`ParticipationPerformance` entity** | Extends `StudentPerformance`. Adds `symbol: ParticipationSymbol`. Tests: valid symbol, toScore(). | 1.27, 1.13 |
| 1.30 | **`Finding` abstract entity** | Base: id. Tests: equality. | 1.1 |
| 1.31 | **`Document` entity** | Props: filePath (absolute path). Tests: path validation. | 1.30 |
| 1.32 | **`Note` entity** | Props: text. Tests: empty vs non-empty. | 1.30 |
| 1.33 | **`RemoteDocument` entity** | Props: url. Tests: URL format validation. | 1.30 |
| 1.34 | **`GradeRepository` interface** | Port: `findByStudent`, `findByAssessment`, `findByCourseAndCategory`, `save`, `delete`. | 1.27 |

### 1-D: Report Context

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 1.35 | **`ReportCard` entity** | Props: id, student, schoolYear, courseGrades map. Tests: create, add entry. | 1.1, 1.10, 1.8 |
| 1.36 | **`ReportRepository` interface** | Port: `findByStudentAndYear`, `save`. | 1.35 |

---

## Phase 2: Domain Layer — Grade Calculation Engine (Pure TypeScript)

### Priority: After CRUD domain entities

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 2.1 | **Performance normalization fn** | `normalize(p: StudentPerformance): number`. Maps GradedPerformance.value directly; maps ParticipationPerformance via toScore(). Tests: all combinations. | 1.28, 1.29 |
| 2.2 | **Recency weight fn** | `calculateWeight(date, schoolYearStart): number`. Returns `DaysBetween(start, date) + 1`. Tests: known dates → known weights, edge cases (same day, day 0). | 1.8 |
| 2.3 | **Category-weighted mean fn** | `calculateCategoryMean(performances, category): Result<number>`. Uses 2.1 + 2.2. Tests: single/multiple perfs, empty set. | 2.1, 2.2, 1.14, 1.4 |
| 2.4 | **Final grade calculator fn** | `calculateFinalGrade(categoryMeans, compositions): Result<number>`. Weighted avg with dynamic normalization for empty categories. Tests: all active, some inactive, all empty, division-by-zero edge case. | 2.3, 1.15, 1.4 |
| 2.5 | **`GradeCalculationService`** | Orchestrates 2.1–2.4 as single pipeline: student + course → final grade. Tests: end-to-end domain calculation with mock data. | 2.1–2.4 |

---

## Phase 3: Infrastructure / Persistence Layer

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 3.1 | **Database connection + migration runner** | `db.ts`: init SQLite, PRAGMA foreign_keys, run migrations. Install `better-sqlite3`. | 0.4, 0.6 |
| 3.2 | **Schema migration (DDL)** | All 7 tables per §2.3 of requirements: School_Classes, Students, Student_Additional_Information, Courses, Grade_Compositions, Assessments, Student_Performances, Findings. FKs, CHECK, STI discriminators. | 3.1 |
| 3.3 | **`SqliteStudentRepository`** | Implements `StudentRepository`. Row ↔ domain object mapping. Tests: CRUD against in-memory SQLite. | 1.11, 3.2 |
| 3.4 | **`SqliteGradeRepository`** | Implements `GradeRepository`. Handles STI for Assessments and Student_Performances. Tests: full hierarchy CRUD. | 1.34, 3.2 |
| 3.5 | **`SqliteReportRepository`** | Implements `ReportRepository`. Tests: find/save reports. | 1.36, 3.2 |
| 3.6 | **`PdfReportGenerator`** | Generates PDF report cards via `pdfkit`. Tests: file creation, content structure. | 0.4 |
| 3.7 | **`DataExportService`** | CSV export for student/grade data. Tests: format correctness. | 0.4 |

---

## Phase 4: Application Services (Use-Case Orchestration)

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 4.1 | **`StudentService`** | `list`, `create`, `update`, `delete`, `getWithPerformances`. Translates between IPC DTOs and domain. Tests: mocked repo. | 1.10–1.11, 3.3 |
| 4.2 | **`SchoolClassService`** | `list`, `create`, `rename`, `delete`. Tests: mocked repo. | 1.9, 3.3 |
| 4.3 | **`CourseService`** | `listByYear`, `create`, `clone` (duplicate + assessments, no performances), `update`, `delete`. Tests: mocked repo. | 1.16, 3.3–3.4 |
| 4.4 | **`AssessmentService`** | `list`, `create` (with concrete subtype selection), `delete`. Tests: mocked repo. | 1.17–1.26, 3.4 |
| 4.5 | **`GradingService`** | `recordPerformance` (auto-selects Graded vs Participation), `getPerformancesByAssessment`, `getByStudent`. Tests: mocked repo. | 1.27–1.29, 3.4 |
| 4.6 | **`FindingService`** | `add`, `remove`, `getFindings`. Tests: mocked repo. | 1.30–1.33, 3.4 |
| 4.7 | **`GradeCalculationAppService`** | Wraps domain calc (2.5). Fetches data via repos, runs pipeline, returns result. Tests: integration with mocked repo. | 2.5, 3.4 |
| 4.8 | **`ImpromptuAssessmentService`** | Creates Assessment + StudentPerformance in one transaction. Tests: mocked repo. | 4.4, 4.5 |
| 4.9 | **`ReportService`** | `generate`: aggregate grades → build ReportCard → generate PDF. Tests: mocks. | 1.35–1.36, 3.5–3.6, 4.7 |

---

## Phase 5: IPC Layer

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 5.1 | **Define all IPC channel constants** | In `src/shared/ipc-channels.ts`: student:, class:, course:, assessment:, grade:, finding:, report: channels. | 0.6 |
| 5.2 | **Zod schemas for IPC input** | Validate every IPC payload at the boundary. Tests: valid/invalid payloads rejected. | 5.1 |
| 5.3 | **`student.ipc.ts`** | Thin handlers: validate → delegate to StudentService → return plain object. | 5.1–5.2, 4.1 |
| 5.4 | **`course.ipc.ts`** | Handlers for class + course channels. | 5.1–5.2, 4.2–4.3 |
| 5.5 | **`grade.ipc.ts`** | Handlers for assessment, grading, finding, calculation channels. | 5.1–5.2, 4.4–4.8 |
| 5.6 | **`report.ipc.ts`** | Handlers for report generation. | 5.1–5.2, 4.9 |
| 5.7 | **Register all handlers in `app.ts`** | Wire up all IPC modules on app startup. | 5.3–5.6 |

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
| 7.13 | **Course workspace shell** | 3-tab layout: Assessments \| Grading \| Students. Nested router within course context. | 7.2 |
| 7.14 | **Assessments list view** | Default: upcoming only. Toggle "Show Past". Calls `grdr.assessment.list()`. | 6.2, 7.13 |
| 7.15 | **Create assessment panel** | Concrete subtype selector, title, date, maxPoints (conditional on WrittenAssessment subclasses). Calls `grdr.assessment.create()`. | 6.2, 7.13 |
| 7.16 | **Bulk grading table** | Matrix: rows=students, cols=grade/symbol input + quick findings. Keyboard-navigable (Tab/Enter). Calls `grdr.grade.record()`. | 6.2, 7.13 |
| 7.17 | **Single student grading profiler** | Per-student form with prev/next pagination. Finding sub-forms: Document (file picker), Note (textarea), RemoteDocument (URL input). | 6.2, 7.13 |
| 7.18 | **Course grading matrix** | Master table: students × categories with weighted averages + computed final grade. Real-time display. Calls `grdr.grade.calculateFinal()`. | 6.2, 7.13 |
| 7.19 | **Student roster + impromptu** | Student list with "Impromptu Assessment" button per row. | 6.2, 7.13 |
| 7.20 | **Impromptu assessment dialog** | Subtype selector, grade/symbol input, date picker. Single-shot save. | 6.2, 7.19 |

---

## Phase 8: Integration & E2E Tests

| # | Task | Description | Depends On |
|---|------|-------------|------------|
| 8.1 | **Integration: SqliteStudentRepository** | Full CRUD, cascade rules, additional information mapping. | 3.3 |
| 8.2 | **Integration: SqliteGradeRepository** | STI for Assessment and StudentPerformance hierarchies. | 3.4 |
| 8.3 | **Integration: SqliteReportRepository** | Find/save reports. | 3.5 |
| 8.4 | **Integration: Grade calculation pipeline** | Insert students, assessments, performances → run 4.7 → verify result. | 4.7 |
| 8.5 | **E2E: Create student flow** | Launch app → navigate to Students → create → verify in list. | 7.4–7.5 |
| 8.6 | **E2E: Full course → assessment → grade flow** | Create class → course → assessment → grade all students. | 7.8–7.16 |
| 8.7 | **E2E: Impromptu assessment** | Course → Students tab → impromptu assess → verify. | 7.19–7.20 |
| 8.8 | **E2E: Course cloning** | Clone course with assessments to new class. Verify performances not cloned. | 7.12 |

---

## Execution Order & Parallelization

```
Phase 0 (0.1–0.8) — sequential
  │
  ├──► Phase 1 (1.1–1.36) — sequential within contexts, parallel across contexts
  │     ├── 1-A (shared) → 1-B (student) ────────────────► 1-D (report, lighter)
  │     └── 1-A (shared) → 1-C (assessment, largest block)
  │
  ├──► Phase 2 (2.1–2.5) — depends on 1-C, sequential pipeline
  │
  ├──► Phase 3 (3.1–3.7) — 3.1→3.2 first, then 3.3–3.7 in parallel
  │
  ├──► Phase 4 (4.1–4.9) — mostly parallel per bounded context
  │
  ├──► Phase 5 (5.1–5.7) — 5.1→5.2→5.3–5.6 (parallel)→5.7
  │
  ├──► Phase 6 (6.1–6.3) — sequential
  │
  ├──► Phase 7 (7.1–7.20)
  │     ├── 7.1–7.3 (Vue scaffold + shell) — first
  │     ├── 7.4–7.9 (Students + Classes CRUD) — parallel
  │     ├── 7.10–7.12 (Courses CRUD) — after shell
  │     └── 7.13–7.20 (Workspace tabs) — after Courses
  │
  └──► Phase 8 (8.1–8.8) — integration first, then E2E
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Vue 3 + Composition API** for renderer | User preference; lightweight SFCs, good TS support, no heavy framework overhead |
| **`better-sqlite3`** | Synchronous API, simpler in Electron main process, well-typed |
| **Zod** for IPC boundary validation | Runtime validation + TypeScript type inference, lightweight |
| **STI** for domain hierarchies | Matches requirements §2.2; simpler queries, single table per hierarchy |
| **`pdfkit`** for PDF generation | Pure JS, no native deps, streaming API |
| **School year start = Sept 1** | Austrian academic calendar convention; make configurable later |
| **Feature priority** | CRUD screens first (data entry), then grading engine (core value), then reporting (output) |

---

## Open Questions

- Confirm Vue 3 build tooling: **Vite** as the bundler for the renderer process? (Standard for Vue 3 + Electron.)
- Prefer `vue-router` for SPA navigation or a simpler custom tab-switching approach?
