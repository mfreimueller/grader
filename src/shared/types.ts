export interface IpcApi {
  student: {
    list: () => Promise<unknown>;
    create: (data: unknown) => Promise<unknown>;
    update: (id: string, data: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  class: {
    list: () => Promise<unknown>;
    create: (data: unknown) => Promise<unknown>;
    update: (id: string, data: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  course: {
    list: (params: unknown) => Promise<unknown>;
    create: (data: unknown) => Promise<unknown>;
    clone: (id: string, targetClassId: string) => Promise<unknown>;
    update: (id: string, data: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  assessmentCategory: {
    listByCourse: (courseId: string) => Promise<unknown>;
    create: (data: unknown) => Promise<unknown>;
    update: (id: string, data: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  session: {
    listByCourse: (courseId: string) => Promise<unknown>;
    create: (data: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  assessment: {
    listBySession: (sessionId: string) => Promise<unknown>;
    create: (data: unknown) => Promise<unknown>;
    createImpromptu: (data: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<unknown>;
  };
  grade: {
    recordPerformance: (data: unknown) => Promise<unknown>;
    getPerformancesByAssessment: (assessmentId: string) => Promise<unknown>;
    listByStudent: (studentId: string) => Promise<unknown>;
    calculateFinal: (courseId: string, studentId: string) => Promise<unknown>;
    saveManualGrade: (data: unknown) => Promise<unknown>;
    recordImpromptu: (data: unknown) => Promise<unknown>;
  };
  finding: {
    add: (data: unknown) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
    getFindings: (performanceId: string) => Promise<unknown>;
  };
  report: {
    generate: (courseId: string, mode: 'full' | 'reduced') => Promise<unknown>;
  };
}
