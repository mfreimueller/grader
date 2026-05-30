export interface PerformanceReportEntry {
  assessmentTitle: string;
  date: Date;
  categoryTitle: string;
  rawScore: number | null;
  maxPoints: number | null;
  symbol: string | null;
}

export interface CategoryGradeReportEntry {
  categoryTitle: string;
  displayGrade: number;
  mean: number;
}

export interface StudentReportEntry {
  studentId: string;
  firstName: string;
  lastName: string;
  manualGrade: number | null;
  calculatedGrade: number | null;
  categoryGrades: CategoryGradeReportEntry[];
  performances: PerformanceReportEntry[];
}

export interface CourseReportData {
  courseId: string;
  courseTitle: string;
  className: string;
  schoolYearLabel: string;
  students: StudentReportEntry[];
}

export function sortStudentsByLastName(
  students: StudentReportEntry[],
): StudentReportEntry[] {
  return [...students].sort((a, b) => {
    const lastCompare = a.lastName.localeCompare(b.lastName);
    if (lastCompare !== 0) return lastCompare;
    return a.firstName.localeCompare(b.firstName);
  });
}
