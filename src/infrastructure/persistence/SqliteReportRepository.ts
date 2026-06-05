import type { Db } from './db';
import { ReportRepository } from '../../domain/report/ReportRepository';
import { CourseReportData, StudentReportEntry, PerformanceReportEntry, sortStudentsByLastName } from '../../domain/report/CourseReportData';

export class SqliteReportRepository implements ReportRepository {
  constructor(private readonly db: Db) {}

  async findCourseReportData(courseId: string): Promise<CourseReportData | null> {
    const courseRow = this.db
      .prepare(
        `SELECT c.id, c.title, sc.name AS class_name, sc.school_year
         FROM courses c
         JOIN school_classes sc ON c.school_class_id = sc.id
         WHERE c.id = ?`,
      )
      .get(courseId) as { id: string; title: string; class_name: string; school_year: string } | undefined;

    if (!courseRow) return null;

    const students = this.db
      .prepare(
        `SELECT s.id, s.first_name, s.last_name
         FROM students s
         JOIN courses c ON s.school_class_id = c.school_class_id
         WHERE c.id = ?
         ORDER BY s.last_name, s.first_name`,
      )
      .all(courseId) as { id: string; first_name: string; last_name: string }[];

    const studentEntries: StudentReportEntry[] = students.map(s => {
      const gradeRow = this.db
        .prepare(
          'SELECT score FROM grades WHERE student_id = ? AND course_id = ?',
        )
        .get(s.id, courseId) as { score: number } | undefined;

      const perfRows = this.db
        .prepare(
          `SELECT sp.id, a.title AS assessment_title, ses.date AS assessment_date,
                  cat.title AS category_title, sp.score, sp.symbol, a.max_points,
                  GROUP_CONCAT(f.text_content, '||') AS finding_notes
           FROM student_performances sp
           JOIN assessments a ON sp.assessment_id = a.id
           JOIN sessions ses ON a.session_id = ses.id
           JOIN assessment_categories cat ON a.category_id = cat.id
           LEFT JOIN findings f ON f.student_performance_id = sp.id AND f.deleted_at IS NULL
           WHERE sp.student_id = ? AND sp.deleted_at IS NULL
           GROUP BY sp.id
           ORDER BY ses.date`,
        )
        .all(s.id) as {
          assessment_title: string;
          assessment_date: string;
          category_title: string;
          score: number | null;
          symbol: string | null;
          max_points: number | null;
          finding_notes: string | null;
        }[];

      const performances: PerformanceReportEntry[] = perfRows.map(p => ({
        assessmentTitle: p.assessment_title,
        date: new Date(p.assessment_date),
        categoryTitle: p.category_title,
        rawScore: p.score,
        maxPoints: p.max_points,
        symbol: p.symbol,
        notes: p.finding_notes ? p.finding_notes.split('||').filter(Boolean) : [],
      }));

      return {
        studentId: s.id,
        firstName: s.first_name,
        lastName: s.last_name,
        manualGrade: gradeRow?.score ?? null,
        calculatedGrade: null,
        categoryGrades: [],
        performances,
      };
    });

    return {
      courseId: courseRow.id,
      courseTitle: courseRow.title,
      className: courseRow.class_name,
      schoolYearLabel: courseRow.school_year,
      students: sortStudentsByLastName(studentEntries),
    };
  }
}
