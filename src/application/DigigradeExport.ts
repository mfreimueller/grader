/** Version 1 of the JSON document produced by digigrade's `GET /api/export`. Ids are opaque strings. */
export interface DigigradeExport {
  format: 'digigrade-export';
  version: 1;
  exportedAt: string;
  classes: DigigradeClass[];
  students: DigigradeStudent[];
  courses: DigigradeCourse[];
}

export interface DigigradeClass {
  id: string;
  name: string;
  schoolYear: string;
}

export interface DigigradeStudent {
  id: string;
  classId: string;
  firstName: string;
  lastName: string;
  color: string | null;
}

export interface DigigradeCourse {
  id: string;
  title: string;
  classId: string;
  pickCounts: { studentId: string; pickCount: number }[];
  categories: DigigradeCategory[];
  compositions: { categoryId: string; weight: number; subWeightType: string }[];
  excludedStudentIds: string[];
  sessions: DigigradeSession[];
  grades: { studentId: string; score: number }[];
}

export interface DigigradeCategory {
  id: string;
  title: string;
  gradingType: string;
  displayAsGrade: boolean;
  hidden: boolean;
}

export interface DigigradeSession {
  id: string;
  date: string;
  notes: string | null;
  assessments: DigigradeAssessment[];
}

export interface DigigradeAssessment {
  id: string;
  title: string;
  categoryId: string;
  maxPoints: number | null;
  impromptu: boolean;
  performances: DigigradePerformance[];
}

export interface DigigradePerformance {
  studentId: string;
  score: number | null;
  symbol: string | null;
  findings: { type: string; text: string | null; url: string | null }[];
}
