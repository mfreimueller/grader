import type { Db } from './db';
import { GradeRepository } from '../../domain/grade/GradeRepository';
import { Grade } from '../../domain/grade/Grade';
import { StudentId } from '../../domain/student/StudentId';
import { StudentPerformance } from '../../domain/grade/StudentPerformance';
import { GradedPerformance } from '../../domain/grade/GradedPerformance';
import { ParticipationPerformance } from '../../domain/grade/ParticipationPerformance';
import { ParticipationSymbol } from '../../domain/grade/ParticipationSymbol';
import { Assessment } from '../../domain/grade/Assessment';
import { GradedAssessment } from '../../domain/grade/GradedAssessment';
import { AssessmentCategory } from '../../domain/grade/AssessmentCategory';
import { gradingTypeFromString } from '../../domain/grade/GradingType';
import { Course } from '../../domain/grade/Course';
import { Student } from '../../domain/student/Student';
import { SchoolClass } from '../../domain/student/SchoolClass';
import { SchoolYear } from '../../domain/student/SchoolYear';
import { Name } from '../../domain/student/Name';

interface PerformanceRow extends Record<string, unknown> {
  id: string;
  date: string;
  student_id: string;
  assessment_id: string;
  score: number | null;
  symbol: string | null;
  type: string;
  max_points: number | null;
  assessment_title: string;
  assessment_date: string;
  category_id: string;
  course_id: string;
  is_impromptu: number;
  course_title: string;
  school_class_id: string;
  category_title: string;
  grading_type: string;
  display_as_grade: number;
  first_name: string;
  last_name: string;
  student_class_id: string;
  class_name: string;
  school_year: string;
}

interface GradeRow extends Record<string, unknown> {
  id: string;
  student_id: string;
  course_id: string;
  score: number;
}

export class SqliteGradeRepository implements GradeRepository {
  constructor(private readonly db: Db) {}

  async findByStudent(studentId: StudentId): Promise<Grade[]> {
    const rows = this.db
      .prepare(
        `SELECT g.id, g.student_id, g.course_id, g.score
         FROM grades g
         WHERE g.student_id = ?`,
      )
      .all(studentId.value) as GradeRow[];

    return rows.map(r => this.rowToGrade(r));
  }

  async findByCourseAndStudent(
    courseId: string,
    studentId: StudentId,
  ): Promise<Grade | null> {
    const row = this.db
      .prepare(
        `SELECT g.id, g.student_id, g.course_id, g.score
         FROM grades g
         WHERE g.course_id = ? AND g.student_id = ?`,
      )
      .get(courseId, studentId.value) as GradeRow | undefined;

    if (!row) return null;
    return this.rowToGrade(row);
  }

  async save(grade: Grade): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO grades (id, student_id, course_id, score)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        grade.id,
        grade.student.id.value,
        grade.course.id,
        grade.score,
      );
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM grades WHERE id = ?').run(id);
  }

  async savePerformance(performance: StudentPerformance): Promise<void> {
    if (performance instanceof GradedPerformance) {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO student_performances
           (id, date, student_id, assessment_id, score, symbol, type)
           VALUES (?, ?, ?, ?, ?, ?, 'graded')`,
        )
        .run(
          performance.id,
          performance.date.toISOString(),
          performance.student.id.value,
          performance.assessment.id,
          performance.score,
          null,
        );
    } else if (performance instanceof ParticipationPerformance) {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO student_performances
           (id, date, student_id, assessment_id, score, symbol, type)
           VALUES (?, ?, ?, ?, ?, ?, 'participation')`,
        )
        .run(
          performance.id,
          performance.date.toISOString(),
          performance.student.id.value,
          performance.assessment.id,
          null,
          performance.symbol.value,
        );
    }
  }

  async findPerformancesByAssessment(
    assessmentId: string,
  ): Promise<StudentPerformance[]> {
    const rows = this.db
      .prepare(performanceQuery + 'WHERE sp.assessment_id = ?')
      .all(assessmentId) as PerformanceRow[];

    return rows.map(r => this.rowToPerformance(r));
  }

  async findPerformancesByStudent(
    studentId: StudentId,
  ): Promise<StudentPerformance[]> {
    const rows = this.db
      .prepare(performanceQuery + 'WHERE sp.student_id = ?')
      .all(studentId.value) as PerformanceRow[];

    return rows.map(r => this.rowToPerformance(r));
  }

  private rowToGrade(row: GradeRow): Grade {
    const grade = Grade.create(
      row.id,
      this.makeStubStudent(row.student_id),
      this.makeStubCourse(row.course_id),
      row.score,
    );
    if (!grade.ok) throw grade.error;
    return grade.value;
  }

  private rowToPerformance(row: PerformanceRow): StudentPerformance {
    const schoolYearRes = SchoolYear.create(row.school_year);
    if (!schoolYearRes.ok) throw schoolYearRes.error;

    const schoolClass = new SchoolClass(
      row.student_class_id,
      row.class_name,
      schoolYearRes.value,
    );

    const studentIdRes = StudentId.create(row.student_id);
    if (!studentIdRes.ok) throw studentIdRes.error;

    const nameRes = Name.create(row.first_name, row.last_name);
    if (!nameRes.ok) throw nameRes.error;

    const student = Student.create(
      studentIdRes.value,
      nameRes.value,
      schoolClass,
    );

    const mockSchoolClass = new SchoolClass('', '', schoolYearRes.value);
    const mockCourse = Course.create(row.course_id, row.course_title, mockSchoolClass);

    const gradingTypeResult = gradingTypeFromString(row.grading_type);
    if (!gradingTypeResult.ok) throw gradingTypeResult.error;

    const category = new AssessmentCategory(
      row.category_id,
      row.category_title,
      gradingTypeResult.value,
      row.display_as_grade === 1,
    );

    const perfDate = new Date(row.date);
    const assessmentDate = new Date(row.assessment_date);

    if (row.type === 'graded') {
      const maxPoints = row.max_points ?? 100;
      const assessmentRes = GradedAssessment.create(
        row.assessment_id,
        row.assessment_title,
        assessmentDate,
        category,
        mockCourse,
        maxPoints,
        row.is_impromptu === 1,
      );
      if (!assessmentRes.ok) throw assessmentRes.error;

      const perfRes = GradedPerformance.create(
        row.id,
        perfDate,
        student,
        assessmentRes.value,
        row.score!,
      );
      if (!perfRes.ok) throw perfRes.error;
      return perfRes.value;
    }

    const assessment = new Assessment(
      row.assessment_id,
      row.assessment_title,
      assessmentDate,
      category,
      mockCourse,
      row.is_impromptu === 1,
    );

    const symbolRes = ParticipationSymbol.create(row.symbol ?? 'PLUS');
    if (!symbolRes.ok) throw symbolRes.error;

    const perfRes = ParticipationPerformance.create(
      row.id,
      perfDate,
      student,
      assessment,
      symbolRes.value,
    );
    if (!perfRes.ok) throw perfRes.error;
    return perfRes.value;
  }

  private makeStubStudent(id: string): Student {
    const sid = StudentId.create(id);
    if (!sid.ok) throw sid.error;
    const name = Name.create('Stub', 'Student');
    if (!name.ok) throw name.error;
    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    return Student.create(sid.value, name.value, new SchoolClass('stub', '', year.value));
  }

  private makeStubCourse(id: string): Course {
    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    return Course.create(id, 'Stub Course', new SchoolClass('stub', '', year.value));
  }
}

const performanceQuery = `
  SELECT sp.id, sp.date, sp.student_id, sp.assessment_id, sp.score, sp.symbol, sp.type,
         a.max_points, a.title AS assessment_title, a.date AS assessment_date,
         a.category_id, a.course_id, a.is_impromptu,
         c.title AS course_title, c.school_class_id,
         cat.title AS category_title, cat.grading_type, cat.display_as_grade,
         s.first_name, s.last_name, s.school_class_id AS student_class_id,
         sc.name AS class_name, sc.school_year
  FROM student_performances sp
  JOIN assessments a ON sp.assessment_id = a.id
  JOIN courses c ON a.course_id = c.id
  JOIN assessment_categories cat ON a.category_id = cat.id
  JOIN students s ON sp.student_id = s.id
  JOIN school_classes sc ON s.school_class_id = sc.id
`;
