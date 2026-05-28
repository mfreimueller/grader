export interface PerformanceReportEntry {
  assessmentTitle: string;
  date: Date;
  categoryTitle: string;
  rawScore: number | null;
  maxPoints: number | null;
  symbol: string | null;
}

export interface StudentReportEntry {
  firstName: string;
  lastName: string;
  manualGrade: number | null;
  performances: PerformanceReportEntry[];
}

export interface CourseReportData {
  courseId: string;
  courseTitle: string;
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
