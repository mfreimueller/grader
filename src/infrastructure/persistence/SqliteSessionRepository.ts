import type { Db } from './db';
import { SessionRepository } from '../../domain/grade/SessionRepository';
import { Session } from '../../domain/grade/Session';
import { Assessment } from '../../domain/grade/Assessment';
import { GradedAssessment } from '../../domain/grade/GradedAssessment';
import { AssessmentCategory } from '../../domain/grade/AssessmentCategory';
import { gradingTypeFromString } from '../../domain/grade/GradingType';
import { Course } from '../../domain/grade/Course';
import { SchoolClass } from '../../domain/student/SchoolClass';
import { SchoolYear } from '../../domain/student/SchoolYear';
import { Student } from '../../domain/student/Student';
import { StudentId } from '../../domain/student/StudentId';
import { Name } from '../../domain/student/Name';

interface SessionRow {
  id: string;
  date: string;
  notes: string | null;
  course_id: string;
  course_title: string;
  school_class_id: string;
  class_name: string;
  school_year: string;
}

export class SqliteSessionRepository implements SessionRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Session | null> {
    const row = this.db
      .prepare(
        `SELECT s.id, s.date, s.notes, s.course_id,
                c.title AS course_title, c.school_class_id,
                sc.name AS class_name, sc.school_year
         FROM sessions s
         JOIN courses c ON s.course_id = c.id
         JOIN school_classes sc ON c.school_class_id = sc.id
         WHERE s.id = ?`,
      )
      .get(id) as SessionRow | undefined;

    if (!row) return null;
    return this.rowToSession(row);
  }

  async findByCourse(courseId: string): Promise<Session[]> {
    const rows = this.db
      .prepare(
        `SELECT s.id, s.date, s.notes, s.course_id,
                c.title AS course_title, c.school_class_id,
                sc.name AS class_name, sc.school_year
         FROM sessions s
         JOIN courses c ON s.course_id = c.id
         JOIN school_classes sc ON c.school_class_id = sc.id
         WHERE s.course_id = ?
         ORDER BY s.date DESC`,
      )
      .all(courseId) as SessionRow[];

    return rows.map(r => this.rowToSession(r));
  }

  async save(session: Session): Promise<void> {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO sessions (id, date, notes, course_id) VALUES (?, ?, ?, ?)',
      )
      .run(
        session.id,
        session.date.toISOString(),
        session.notes,
        session.course.id,
      );

    for (const assessment of session.assessments) {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO assessments
           (id, title, category_id, course_id, is_impromptu, max_points, session_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          assessment.id,
          assessment.title,
          assessment.category.id,
          assessment.course.id,
          assessment.isImpromptu ? 1 : 0,
          assessment instanceof GradedAssessment ? assessment.maxPoints : null,
          session.id,
        );
    }

    this.db
      .prepare('DELETE FROM session_students WHERE session_id = ?')
      .run(session.id);

    const insertStudent = this.db.prepare(
      'INSERT OR REPLACE INTO session_students (session_id, student_id) VALUES (?, ?)',
    );

    for (const student of session.students) {
      insertStudent.run(session.id, student.id.value);
    }
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM session_students WHERE session_id = ?').run(id);
    this.db
      .prepare('UPDATE assessments SET session_id = NULL WHERE session_id = ?')
      .run(id);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  private rowToSession(row: SessionRow): Session {
    const yearResult = SchoolYear.create(row.school_year);
    if (!yearResult.ok) throw yearResult.error;

    const schoolClass = new SchoolClass(
      row.school_class_id,
      row.class_name,
      yearResult.value,
    );

    const course = Course.reconstitute(row.course_id, row.course_title, schoolClass, [], []);

    const assessments = this.loadAssessments(row.id);
    const students = this.loadStudents(row.id);

    return Session.reconstitute(
      row.id,
      new Date(row.date),
      row.notes ?? '',
      course,
      students,
      assessments,
    );
  }

  private loadAssessments(sessionId: string): (Assessment | GradedAssessment)[] {
    const rows = this.db
      .prepare(
        `SELECT a.id, a.title, a.category_id, a.course_id, a.is_impromptu, a.max_points,
                cat.title AS category_title, cat.grading_type, cat.display_as_grade, cat.is_hidden,
                c.title AS course_title, c.school_class_id,
                sc.name AS class_name, sc.school_year
         FROM assessments a
         JOIN assessment_categories cat ON a.category_id = cat.id
         JOIN courses c ON a.course_id = c.id
         JOIN school_classes sc ON c.school_class_id = sc.id
         WHERE a.session_id = ?`,
      )
      .all(sessionId) as Array<Record<string, unknown>>;

    return rows.map(r => this.rowToAssessment(r, sessionId));
  }

  private loadStudents(sessionId: string): Student[] {
    const rows = this.db
      .prepare(
        `SELECT s.id, s.first_name, s.last_name
         FROM students s
         JOIN session_students ss ON s.id = ss.student_id
         WHERE ss.session_id = ?`,
      )
      .all(sessionId) as Array<{ id: string; first_name: string; last_name: string }>;

    return rows.map(r => {
      const idResult = StudentId.create(r.id);
      if (!idResult.ok) throw idResult.error;
      const nameResult = Name.create(r.first_name, r.last_name);
      if (!nameResult.ok) throw nameResult.error;

      const year = SchoolYear.create('2025/26');
      if (!year.ok) throw year.error;
      return Student.create(
        idResult.value,
        nameResult.value,
        new SchoolClass('stub', '', year.value),
      );
    });
  }

  private rowToAssessment(row: Record<string, unknown>, sessionId: string): Assessment | GradedAssessment {
    const gradingTypeResult = gradingTypeFromString(row.grading_type as string);
    if (!gradingTypeResult.ok) throw gradingTypeResult.error;

    const category = new AssessmentCategory(
      row.category_id as string,
      row.category_title as string,
      gradingTypeResult.value,
      (row.display_as_grade as number) === 1,
      (row.is_hidden as number) === 1,
    );

    const yearResult = SchoolYear.create(row.school_year as string);
    if (!yearResult.ok) throw yearResult.error;

    const schoolClass = new SchoolClass(
      row.school_class_id as string,
      row.class_name as string,
      yearResult.value,
    );

    const course = Course.reconstitute(
      row.course_id as string,
      row.course_title as string,
      schoolClass,
      [],
      [],
    );

    if (row.max_points !== null && row.max_points !== undefined) {
      const result = GradedAssessment.create(
        row.id as string,
        row.title as string,
        category,
        course,
        sessionId,
        row.max_points as number,
        (row.is_impromptu as number) === 1,
      );
      if (!result.ok) throw result.error;
      return result.value;
    }

    return new Assessment(
      row.id as string,
      row.title as string,
      category,
      course,
      sessionId,
      (row.is_impromptu as number) === 1,
    );
  }
}
