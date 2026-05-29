import type { Db } from './db';
import { AssessmentRepository } from '../../domain/grade/AssessmentRepository';
import { Assessment } from '../../domain/grade/Assessment';
import { GradedAssessment } from '../../domain/grade/GradedAssessment';
import { AssessmentCategory } from '../../domain/grade/AssessmentCategory';
import { gradingTypeFromString } from '../../domain/grade/GradingType';
import { Course } from '../../domain/grade/Course';
import { SchoolClass } from '../../domain/student/SchoolClass';
import { SchoolYear } from '../../domain/student/SchoolYear';

interface AssessmentRow {
  id: string;
  title: string;
  date: string;
  category_id: string;
  course_id: string;
  is_impromptu: number;
  max_points: number | null;
  category_title: string;
  grading_type: string;
  display_as_grade: number;
  course_title: string;
  school_class_id: string;
  class_name: string;
  school_year: string;
}

export class SqliteAssessmentRepository implements AssessmentRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Assessment | GradedAssessment | null> {
    const row = this.db
      .prepare(assessmentQuery + 'WHERE a.id = ?')
      .get(id) as AssessmentRow | undefined;

    if (!row) return null;
    return this.rowToAssessment(row);
  }

  async findBySession(sessionId: string): Promise<(Assessment | GradedAssessment)[]> {
    const rows = this.db
      .prepare(assessmentQuery + 'WHERE a.session_id = ?')
      .all(sessionId) as AssessmentRow[];

    return rows.map(r => this.rowToAssessment(r));
  }

  async save(assessment: Assessment | GradedAssessment): Promise<void> {
    const maxPoints = assessment instanceof GradedAssessment ? assessment.maxPoints : null;
    const catId = assessment.category.id;

    this.db
      .prepare(
        `INSERT OR REPLACE INTO assessments
         (id, title, date, category_id, course_id, is_impromptu, max_points)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        assessment.id,
        assessment.title,
        assessment.date.toISOString(),
        catId,
        assessment.course.id,
        assessment.isImpromptu ? 1 : 0,
        maxPoints,
      );
  }

  async delete(id: string): Promise<void> {
    this.db
      .prepare(
        'DELETE FROM findings WHERE student_performance_id IN (SELECT id FROM student_performances WHERE assessment_id = ?)',
      )
      .run(id);
    this.db.prepare('DELETE FROM student_performances WHERE assessment_id = ?').run(id);
    this.db.prepare('DELETE FROM assessments WHERE id = ?').run(id);
  }

  private rowToAssessment(row: AssessmentRow): Assessment | GradedAssessment {
    const gradingTypeResult = gradingTypeFromString(row.grading_type);
    if (!gradingTypeResult.ok) throw gradingTypeResult.error;

    const category = new AssessmentCategory(
      row.category_id,
      row.category_title,
      gradingTypeResult.value,
      row.display_as_grade === 1,
    );

    const yearResult = SchoolYear.create(row.school_year);
    if (!yearResult.ok) throw yearResult.error;

    const schoolClass = new SchoolClass(
      row.school_class_id,
      row.class_name,
      yearResult.value,
    );

    const course = Course.reconstitute(
      row.course_id,
      row.course_title,
      schoolClass,
      [],
      [],
    );

    if (row.max_points !== null) {
      const result = GradedAssessment.create(
        row.id,
        row.title,
        new Date(row.date),
        category,
        course,
        row.max_points,
        row.is_impromptu === 1,
      );
      if (!result.ok) throw result.error;
      return result.value;
    }

    return new Assessment(
      row.id,
      row.title,
      new Date(row.date),
      category,
      course,
      row.is_impromptu === 1,
    );
  }
}

const assessmentQuery = `
  SELECT a.id, a.title, a.date, a.category_id, a.course_id, a.is_impromptu, a.max_points,
         cat.title AS category_title, cat.grading_type, cat.display_as_grade,
         c.title AS course_title, c.school_class_id,
         sc.name AS class_name, sc.school_year
  FROM assessments a
  JOIN assessment_categories cat ON a.category_id = cat.id
  JOIN courses c ON a.course_id = c.id
  JOIN school_classes sc ON c.school_class_id = sc.id
`;
