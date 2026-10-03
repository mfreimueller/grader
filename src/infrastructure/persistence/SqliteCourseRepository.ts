import type { Db } from './db';
import { CourseRepository, DeletedCourseRecord } from '../../domain/grade/CourseRepository';
import { Course } from '../../domain/grade/Course';
import { AssessmentCategory } from '../../domain/grade/AssessmentCategory';
import { GradeComposition } from '../../domain/grade/GradeComposition';
import { SubWeightType } from '../../domain/grade/SubWeightType';
import { gradingTypeFromString } from '../../domain/grade/GradingType';
import { SchoolClass } from '../../domain/student/SchoolClass';
import { SchoolYear } from '../../domain/student/SchoolYear';

interface CourseRow {
  id: string;
  title: string;
  school_class_id: string;
  class_name: string;
  school_year: string;
}

interface CategoryRow {
  id: string;
  title: string;
  grading_type: string;
  display_as_grade: number;
  is_hidden: number;
  course_id: string;
}

interface CompositionRow {
  category_id: string;
  course_id: string;
  weight: number;
  sub_weight_type: string;
}

export class SqliteCourseRepository implements CourseRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Course | null> {
    const row = this.db
      .prepare(
        `SELECT c.id, c.title, c.school_class_id,
                sc.name AS class_name, sc.school_year
         FROM courses c
         JOIN school_classes sc ON c.school_class_id = sc.id
         WHERE c.id = ? AND c.deleted_at IS NULL AND sc.deleted_at IS NULL`,
      )
      .get(id) as CourseRow | undefined;

    if (!row) return null;
    return this.rowToCourse(row);
  }

  async findAll(): Promise<Course[]> {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.title, c.school_class_id,
                sc.name AS class_name, sc.school_year
         FROM courses c
         JOIN school_classes sc ON c.school_class_id = sc.id
         WHERE c.deleted_at IS NULL AND sc.deleted_at IS NULL`,
      )
      .all() as CourseRow[];

    return rows.map(r => this.rowToCourse(r));
  }

  async findBySchoolYear(schoolYear: SchoolYear): Promise<Course[]> {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.title, c.school_class_id,
                sc.name AS class_name, sc.school_year
         FROM courses c
         JOIN school_classes sc ON c.school_class_id = sc.id
         WHERE sc.school_year = ? AND c.deleted_at IS NULL AND sc.deleted_at IS NULL`,
      )
      .all(schoolYear.toString()) as CourseRow[];

    return rows.map(r => this.rowToCourse(r));
  }

  async save(course: Course): Promise<void> {
    const schoolClass = course.schoolClass;

    this.db
      .prepare('DELETE FROM grade_compositions WHERE course_id = ?')
      .run(course.id);

    this.db
      .prepare(
        'INSERT OR REPLACE INTO school_classes (id, name, school_year) VALUES (?, ?, ?)',
      )
      .run(schoolClass.id, schoolClass.name, schoolClass.schoolYear.toString());
    console.log(`Ensured school class ${schoolClass.id} exists for course ${course.id}`);

    this.db
      .prepare(
        'INSERT OR REPLACE INTO courses (id, title, school_class_id) VALUES (?, ?, ?)',
      )
      .run(course.id, course.title, schoolClass.id);
    console.log(`Saved course ${course.id} to repository`);

    const insertCategory = this.db.prepare(
      'INSERT OR REPLACE INTO assessment_categories (id, title, grading_type, display_as_grade, is_hidden, course_id) VALUES (?, ?, ?, ?, ?, ?)',
    );

    for (const cat of course.assessmentCategories) {
      insertCategory.run(
        cat.id,
        cat.title,
        cat.gradingType,
        cat.displayAsGrade ? 1 : 0,
        cat.isHidden ? 1 : 0,
        course.id,
      );
      console.log(`Saved assessment category ${cat.id} for course ${course.id}`);
    }

    const insertComposition = this.db.prepare(
      'INSERT OR REPLACE INTO grade_compositions (category_id, course_id, weight, sub_weight_type) VALUES (?, ?, ?, ?)',
    );

    for (const comp of course.gradeCompositions) {
      insertComposition.run(comp.assessmentCategory.id, course.id, comp.weight, comp.subWeightType);
      console.log(`Saved grade composition for category ${comp.assessmentCategory.id} and course ${course.id}`);
    }
  }

  async deleteCategory(courseId: string, categoryId: string): Promise<void> {
    const refCount = this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM student_performances sp
         JOIN assessments a ON sp.assessment_id = a.id
         WHERE a.category_id = ? AND sp.deleted_at IS NULL`,
      )
      .get(categoryId) as { count: number };

    if (refCount.count > 0) {
      throw new Error(
        `Kategorie kann nicht gelöscht werden: Es gibt ${refCount.count} Leistungsfeststellung(en), die auf diese Kategorie verweisen.`
      );
    }

    this.db.prepare('DELETE FROM grade_compositions WHERE category_id = ?').run(categoryId);
    this.db.prepare('DELETE FROM assessment_categories WHERE id = ?').run(categoryId);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM grade_compositions WHERE course_id = ?').run(id);
    this.db.prepare('DELETE FROM assessment_categories WHERE course_id = ?').run(id);
    this.db.prepare('DELETE FROM courses WHERE id = ?').run(id);
  }

  async softDelete(id: string, deletedAt: string): Promise<void> {
    this.db.prepare('UPDATE courses SET deleted_at = ? WHERE id = ?').run(deletedAt, id);
  }

  async findDeleted(): Promise<DeletedCourseRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.title, c.deleted_at, sc.name AS class_name, sc.school_year
         FROM courses c
         JOIN school_classes sc ON c.school_class_id = sc.id
         WHERE c.deleted_at IS NOT NULL`,
      )
      .all() as { id: string; title: string; deleted_at: string; class_name: string; school_year: string }[];

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      className: r.class_name,
      schoolYear: r.school_year,
      deletedAt: r.deleted_at,
    }));
  }

  async restore(id: string): Promise<void> {
    this.db.prepare('UPDATE courses SET deleted_at = NULL WHERE id = ?').run(id);
  }

  async hardDelete(id: string): Promise<void> {
    const remove = this.db.transaction((courseId: string) => {
      const assessments = '(SELECT id FROM assessments WHERE course_id = ?)';
      this.db
        .prepare(
          `DELETE FROM findings WHERE student_performance_id IN
             (SELECT id FROM student_performances WHERE assessment_id IN ${assessments})`,
        )
        .run(courseId);
      this.db
        .prepare(`DELETE FROM student_performances WHERE assessment_id IN ${assessments}`)
        .run(courseId);
      this.db.prepare('DELETE FROM assessments WHERE course_id = ?').run(courseId);
      this.db
        .prepare('DELETE FROM session_students WHERE session_id IN (SELECT id FROM sessions WHERE course_id = ?)')
        .run(courseId);
      this.db.prepare('DELETE FROM sessions WHERE course_id = ?').run(courseId);
      this.db.prepare('DELETE FROM grades WHERE course_id = ?').run(courseId);
      this.db.prepare('DELETE FROM course_student_picks WHERE course_id = ?').run(courseId);
      this.db.prepare('DELETE FROM grade_compositions WHERE course_id = ?').run(courseId);
      this.db.prepare('DELETE FROM assessment_categories WHERE course_id = ?').run(courseId);
      this.db.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
    });
    remove(id);
  }

  private rowToCourse(row: CourseRow): Course {
    const yearResult = SchoolYear.create(row.school_year);
    if (!yearResult.ok) throw yearResult.error;

    const schoolClass = new SchoolClass(
      row.school_class_id,
      row.class_name,
      yearResult.value,
    );

    const categoryRows = this.db
      .prepare(
        'SELECT id, title, grading_type, display_as_grade, is_hidden, course_id FROM assessment_categories WHERE course_id = ?',
      )
      .all(row.id) as CategoryRow[];

    const categories = categoryRows.map(cr => {
      const gradingTypeResult = gradingTypeFromString(cr.grading_type);
      if (!gradingTypeResult.ok) throw gradingTypeResult.error;
      return new AssessmentCategory(
        cr.id,
        cr.title,
        gradingTypeResult.value,
        cr.display_as_grade === 1,
        cr.is_hidden === 1,
      );
    });

    const compositionRows = this.db
      .prepare(
        'SELECT category_id, course_id, weight, sub_weight_type FROM grade_compositions WHERE course_id = ?',
      )
      .all(row.id) as CompositionRow[];

    const compositions: GradeComposition[] = [];
    for (const compRow of compositionRows) {
      const category = categories.find(c => c.id === compRow.category_id);
      if (!category) continue;

      const subWeightType = compRow.sub_weight_type === 'CHRONOLOGICAL'
        ? SubWeightType.CHRONOLOGICAL
        : SubWeightType.NONE;
      const compResult = GradeComposition.create(category, compRow.weight, subWeightType);
      if (!compResult.ok) throw compResult.error;
      compositions.push(compResult.value);
    }

    return Course.reconstitute(row.id, row.title, schoolClass, categories, compositions);
  }
}
