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
}

export interface GradeCompositionDto {
  categoryId: string;
  weight: number;
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
}

export interface UpdateAssessmentCategoryInput {
  title?: string;
  gradingType?: string;
  displayAsGrade?: boolean;
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
}

export interface CreateSessionInput {
  courseId: string;
  date: string;
  notes?: string;
  studentIds?: string[];
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
  sessionId?: string;
  title: string;
  date: string;
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
  date?: string;
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
  date: string;
  categoryId: string;
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

export interface GradeCalculationResultDto {
  rawScore: number;
  displayGrade: number;
}

export type ReportMode = 'full' | 'reduced';

export interface ImportResultDto {
  classesCreated: number;
  studentsCreated: number;
  studentsUpdated: number;
  warnings: string[];
}

export interface IpcApi {
  student: {
    list: (schoolClassId?: string) => Promise<StudentDto[]>;
    get: (id: string) => Promise<ResultDto<StudentDto>>;
    create: (data: CreateStudentInput) => Promise<ResultDto<StudentDto>>;
    update: (id: string, data: UpdateStudentInput) => Promise<ResultDto<StudentDto>>;
    delete: (id: string) => Promise<ResultDto<void>>;
    importCsv: () => Promise<ResultDto<ImportResultDto>>;
  };
  class: {
    list: () => Promise<SchoolClassDto[]>;
    create: (data: CreateSchoolClassInput) => Promise<ResultDto<SchoolClassDto>>;
    update: (id: string, data: UpdateSchoolClassInput) => Promise<ResultDto<SchoolClassDto>>;
    delete: (id: string) => Promise<ResultDto<void>>;
  };
  course: {
    list: (params?: CourseListParams) => Promise<CourseDto[]>;
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
    delete: (id: string) => Promise<ResultDto<void>>;
  };
  assessment: {
    listBySession: (sessionId: string) => Promise<AssessmentDto[]>;
    create: (data: CreateAssessmentInput) => Promise<ResultDto<AssessmentDto>>;
    createImpromptu: (data: CreateAssessmentInput) => Promise<ResultDto<AssessmentDto>>;
    delete: (id: string) => Promise<ResultDto<void>>;
  };
  grade: {
    recordPerformance: (data: RecordPerformanceInput) => Promise<ResultDto<PerformanceDto>>;
    getPerformancesByAssessment: (assessmentId: string) => Promise<PerformanceDto[]>;
    listByStudent: (studentId: string) => Promise<ResultDto<PerformanceDto[]>>;
    get: (courseId: string, studentId: string) => Promise<ResultDto<GradeDto | null>>;
    calculateFinal: (courseId: string, studentId: string) => Promise<ResultDto<GradeCalculationResultDto>>;
    saveManualGrade: (data: SaveGradeInput) => Promise<ResultDto<GradeDto>>;
    recordImpromptu: (data: CreateImpromptuInput) => Promise<ResultDto<{ assessmentId: string; performance: { id: string; type: string; score: number | null; symbol: string | null } }>>;
    importCsv: (courseId: string) => Promise<ResultDto<GradeImportResultDto>>;
  };
  finding: {
    add: (data: AddFindingInput & { text: string } | AddFindingInput & { filePath: string } | AddFindingInput & { url: string }) => Promise<ResultDto<FindingDto>>;
    remove: (id: string) => Promise<ResultDto<void>>;
    getFindings: (performanceId: string) => Promise<FindingDto[]>;
  };
  report: {
    generate: (courseId: string, mode: ReportMode) => Promise<ResultDto<Buffer | string>>;
  };
}
