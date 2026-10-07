export type ResultDto<T, E = { name: string; message: string }> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface SchoolClassRefDto {
  id: string;
  name: string;
  schoolYear: string;
}

export interface AdditionalInfoEntry {
  key: string;
  value: string;
}

export interface StudentDto {
  id: string;
  firstName: string;
  lastName: string;
  schoolClass: SchoolClassRefDto;
  additionalInfo: AdditionalInfoEntry[];
  color: string | null;
}

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  schoolClassId: string;
  additionalInfo?: AdditionalInfoEntry[];
}

export interface UpdateStudentInput {
  firstName?: string;
  lastName?: string;
  schoolClassId?: string;
  additionalInfo?: AdditionalInfoEntry[];
}

export interface SchoolClassDto {
  id: string;
  name: string;
  schoolYear: string;
}

export interface CreateSchoolClassInput {
  name: string;
  schoolYear: string;
}

export interface UpdateSchoolClassInput {
  name?: string;
  schoolYear?: string;
}

export interface AssessmentCategoryRefDto {
  id: string;
  title: string;
  gradingType: string;
  displayAsGrade: boolean;
  isHidden: boolean;
}

export interface GradeCompositionDto {
  categoryId: string;
  weight: number;
  subWeightType?: 'NONE' | 'CHRONOLOGICAL';
}

export interface CourseDto {
  id: string;
  title: string;
  schoolClass: SchoolClassRefDto;
  assessmentCategories: AssessmentCategoryRefDto[];
  gradeCompositions: GradeCompositionDto[];
}

export interface CreateCourseInput {
  title: string;
  schoolClassId: string;
}

export interface CourseListParams {
  schoolYear?: string;
}

export interface CreateAssessmentCategoryInput {
  courseId: string;
  title: string;
  gradingType: string;
  displayAsGrade: boolean;
  isHidden?: boolean;
}

export interface UpdateAssessmentCategoryInput {
  title?: string;
  gradingType?: string;
  displayAsGrade?: boolean;
  isHidden?: boolean;
}

export interface AssessmentCategoryDto {
  id: string;
  title: string;
  gradingType: string;
  displayAsGrade: boolean;
  courseId: string;
}

export interface SessionDto {
  id: string;
  date: string;
  notes: string;
  courseId: string;
  studentIds: string[];
  absentStudentIds: string[];
  studentNotes: SessionStudentNoteDto[];
}

export interface SessionStudentNoteDto {
  studentId: string;
  text: string;
}

export interface CreateSessionInput {
  courseId: string;
  date: string;
  notes?: string;
  studentIds?: string[];
}

export interface UpdateSessionInput {
  date?: string;
  notes?: string;
}

export interface SetSessionStudentNoteInput {
  studentId: string;
  /** Blank text removes the note. */
  text: string;
}

export interface SetSessionAbsenceInput {
  studentId: string;
  absent: boolean;
}

export interface AssessmentDto {
  id: string;
  title: string;
  date: string;
  category: AssessmentCategoryRefDto;
  courseId: string;
  isImpromptu: boolean;
  maxPoints: number | null;
}

export interface CreateAssessmentInput {
  sessionId: string;
  title: string;
  categoryId: string;
  courseId: string;
  maxPoints?: number;
}

export interface PerformanceDto {
  id: string;
  date: string;
  studentId: string;
  assessmentId: string;
  score: number | null;
  symbol: string | null;
  type: string;
}

export interface GradeDto {
  id: string;
  studentId: string;
  courseId: string;
  score: number;
}

export interface RecordPerformanceInput {
  studentId: string;
  assessmentId: string;
  score?: number;
  symbol?: string;
}

export interface SaveGradeInput {
  studentId: string;
  courseId: string;
  score: number;
}

export interface CreateImpromptuInput {
  courseId: string;
  studentId: string;
  categoryId: string;
  sessionId: string;
  title?: string;
  score?: number;
  symbol?: string;
  maxPoints?: number;
}

export interface FindingDto {
  id: string;
  performanceId: string;
  type: string;
  text: string | null;
  filePath: string | null;
  url: string | null;
}

export interface SessionNoteDto {
  performanceId: string;
  text: string;
}

export interface SetNoteInput {
  performanceId: string;
  text: string;
}

export interface AddFindingInput {
  performanceId: string;
}

export interface GradeImportResultDto {
  sessionsCreated: number;
  assessmentsCreated: number;
  performancesCreated: number;
  performancesUpdated: number;
  warnings: string[];
}

export interface CategoryGradeResultDto {
  categoryId: string;
  categoryTitle: string;
  weight: number;
  mean: number;
  performanceCount: number;
  displayGrade: number;
}

export interface GradeCalculationResultDto {
  rawScore: number;
  displayGrade: number;
  categoryGrades: CategoryGradeResultDto[];
}

export type ReportMode = 'full' | 'reduced';
export type ReportFormat = 'pdf' | 'adoc';

export interface ImportResultDto {
  classesCreated: number;
  studentsCreated: number;
  studentsUpdated: number;
  warnings: string[];
}

export interface DeletedStudentDto {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  deletedAt: string;
}

export interface DeletedClassDto {
  id: string;
  name: string;
  schoolYear: string;
  deletedAt: string;
}

export interface DeletedCourseDto {
  id: string;
  title: string;
  className: string;
  schoolYear: string;
  deletedAt: string;
}

export interface RolloverClassDto {
  id: string;
  name: string;
  schoolYear: string;
  suggestedName: string | null;
}

export interface RolloverPreviewDto {
  targetSchoolYear: string;
  classes: RolloverClassDto[];
}

export interface RolloverInput {
  targetSchoolYear: string;
  archiveCourses: boolean;
  entries: { classId: string; action: { type: 'rename'; newName: string } | { type: 'drop' } }[];
}

export interface RolloverSummaryDto {
  renamed: number;
  dropped: number;
  coursesArchived: number;
}

export interface CourseRosterEntryDto {
  studentId: string;
  firstName: string;
  lastName: string;
  color: string | null;
  included: boolean;
  entryCount: number;
}

export interface BinListDto {
  students: DeletedStudentDto[];
  classes: DeletedClassDto[];
  courses: DeletedCourseDto[];
}

export interface BinRestoreInput {
  type: 'student' | 'class' | 'course';
  id: string;
}

export interface BinHardDeleteInput {
  type: 'student' | 'class' | 'course';
  id: string;
}

export interface IpcApi {
  student: {
    list: (schoolClassId?: string) => Promise<StudentDto[]>;
    get: (id: string) => Promise<ResultDto<StudentDto>>;
    create: (data: CreateStudentInput) => Promise<ResultDto<StudentDto>>;
    update: (id: string, data: UpdateStudentInput) => Promise<ResultDto<StudentDto>>;
    delete: (id: string) => Promise<ResultDto<void>>;
    setColor: (id: string, color: string | null) => Promise<ResultDto<StudentDto>>;
    importCsv: (hasHeader: boolean) => Promise<ResultDto<ImportResultDto>>;
  };
  class: {
    list: () => Promise<SchoolClassDto[]>;
    create: (data: CreateSchoolClassInput) => Promise<ResultDto<SchoolClassDto>>;
    update: (id: string, data: UpdateSchoolClassInput) => Promise<ResultDto<SchoolClassDto>>;
    delete: (id: string) => Promise<ResultDto<void>>;
    dependents: (id: string) => Promise<ResultDto<{ students: number; courses: number }>>;
  };
  roster: {
    list: (courseId: string) => Promise<ResultDto<CourseRosterEntryDto[]>>;
    members: (courseId: string) => Promise<ResultDto<StudentDto[]>>;
    setIncluded: (courseId: string, studentId: string, included: boolean) => Promise<ResultDto<CourseRosterEntryDto>>;
    setAll: (courseId: string, included: boolean) => Promise<ResultDto<void>>;
    /** null when the save dialog was cancelled. */
    exportCsv: (courseId: string) => Promise<ResultDto<{ filePath: string }> | null>;
  };
  schoolYear: {
    preview: () => Promise<RolloverPreviewDto>;
    rollover: (data: RolloverInput) => Promise<ResultDto<RolloverSummaryDto>>;
  };
  course: {
    list: (params?: CourseListParams) => Promise<CourseDto[]>;
    get: (id: string) => Promise<ResultDto<CourseDto>>;
    create: (data: CreateCourseInput) => Promise<ResultDto<CourseDto>>;
    clone: (id: string, targetClassId: string) => Promise<ResultDto<CourseDto>>;
    update: (id: string, data: { title?: string; gradeCompositions?: GradeCompositionDto[] }) => Promise<ResultDto<CourseDto>>;
    delete: (id: string) => Promise<ResultDto<void>>;
  };
  assessmentCategory: {
    listByCourse: (courseId: string) => Promise<AssessmentCategoryDto[]>;
    create: (data: CreateAssessmentCategoryInput) => Promise<ResultDto<AssessmentCategoryDto>>;
    update: (id: string, data: UpdateAssessmentCategoryInput) => Promise<ResultDto<AssessmentCategoryDto>>;
    delete: (id: string) => Promise<ResultDto<void>>;
  };
  session: {
    listByCourse: (courseId: string) => Promise<SessionDto[]>;
    create: (data: CreateSessionInput) => Promise<ResultDto<SessionDto>>;
    update: (id: string, data: UpdateSessionInput) => Promise<ResultDto<SessionDto>>;
    delete: (id: string) => Promise<ResultDto<void>>;
    setAbsence: (id: string, data: SetSessionAbsenceInput) => Promise<ResultDto<SessionDto>>;
    setStudentNote: (id: string, data: SetSessionStudentNoteInput) => Promise<ResultDto<SessionDto>>;
  };
  assessment: {
    listBySession: (sessionId: string) => Promise<AssessmentDto[]>;
    create: (data: CreateAssessmentInput) => Promise<ResultDto<AssessmentDto>>;
    createImpromptu: (data: CreateAssessmentInput) => Promise<ResultDto<AssessmentDto>>;
    delete: (id: string) => Promise<ResultDto<void>>;
  };
  grade: {
    deletePerformance: (performanceId: string) => Promise<ResultDto<void>>;
    recordPerformance: (data: RecordPerformanceInput) => Promise<ResultDto<PerformanceDto>>;
    getPerformancesByAssessment: (assessmentId: string) => Promise<PerformanceDto[]>;
    listByStudent: (studentId: string) => Promise<ResultDto<PerformanceDto[]>>;
    get: (courseId: string, studentId: string) => Promise<ResultDto<GradeDto | null>>;
    calculateFinal: (courseId: string, studentId: string) => Promise<ResultDto<GradeCalculationResultDto>>;
    saveManualGrade: (data: SaveGradeInput) => Promise<ResultDto<GradeDto>>;
    recordImpromptu: (data: CreateImpromptuInput) => Promise<ResultDto<{ assessmentId: string; performance: { id: string; type: string; score: number | null; symbol: string | null } }>>;
    importCsv: (courseId: string, hasHeader: boolean) => Promise<ResultDto<GradeImportResultDto>>;
  };
  finding: {
    add: (data: AddFindingInput & { text: string } | AddFindingInput & { filePath: string } | AddFindingInput & { url: string }) => Promise<ResultDto<FindingDto>>;
    remove: (id: string) => Promise<ResultDto<void>>;
    getFindings: (performanceId: string) => Promise<FindingDto[]>;
    listNotesBySession: (sessionId: string) => Promise<SessionNoteDto[]>;
    /** Replaces all notes of the performance by `text`; blank text removes them and yields null. */
    setNote: (data: SetNoteInput) => Promise<ResultDto<FindingDto | null>>;
  };
  report: {
    generate: (courseId: string, mode: ReportMode) => Promise<ResultDto<{ filePath: string }>>;
    generateSingle: (courseId: string, studentId: string, mode: ReportMode, format: ReportFormat) => Promise<ResultDto<{ filePath: string }>>;
  };
  settings: {
    getDbPath: () => Promise<string>;
    pickDbPath: () => Promise<string | null>;
    saveDbPath: (path: string) => Promise<boolean>;
    openDb: () => Promise<ResultDto<{ path: string; changed: boolean }> | null>;
    restartApp: () => Promise<void>;
    onOpenSettings: (callback: () => void) => () => void;
  };
  bin: {
    listAll: () => Promise<BinListDto>;
    restore: (type: 'student' | 'class' | 'course', id: string) => Promise<void>;
    hardDelete: (type: 'student' | 'class' | 'course', id: string) => Promise<void>;
    empty: () => Promise<void>;
  };
  mcp: {
    getUrl: () => Promise<string | null>;
    getSettings: () => Promise<{ enabled: boolean; port: number }>;
    setEnabled: (enabled: boolean) => Promise<void>;
    onStatusChange: (callback: (status: { running: boolean; url: string | null }) => void) => () => void;
  };
}
