import type { Db } from './db';
import { CourseRosterRepository } from '../../domain/grade/CourseRosterRepository';

export class SqliteCourseRosterRepository implements CourseRosterRepository {
  constructor(private readonly db: Db) {}

  async findExcludedIds(courseId: string): Promise<Set<string>> {
    const rows = this.db
      .prepare('SELECT student_id FROM course_excluded_students WHERE course_id = ?')
      .all(courseId) as { student_id: string }[];
    return new Set(rows.map((r) => r.student_id));
  }

  async setExcluded(courseId: string, studentId: string, excluded: boolean): Promise<void> {
    if (excluded) {
      this.db
        .prepare('INSERT OR IGNORE INTO course_excluded_students (course_id, student_id) VALUES (?, ?)')
        .run(courseId, studentId);
    } else {
      this.db
        .prepare('DELETE FROM course_excluded_students WHERE course_id = ? AND student_id = ?')
        .run(courseId, studentId);
    }
  }

  async replaceExcluded(courseId: string, studentIds: readonly string[]): Promise<void> {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM course_excluded_students WHERE course_id = ?').run(courseId);
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO course_excluded_students (course_id, student_id) VALUES (?, ?)',
      );
      for (const studentId of studentIds) insert.run(courseId, studentId);
    })();
  }

  async countEntries(courseId: string, studentId: string): Promise<number> {
    const performances = this.db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM student_performances sp
         JOIN assessments a ON sp.assessment_id = a.id
         WHERE a.course_id = ? AND sp.student_id = ? AND sp.deleted_at IS NULL`,
      )
      .get(courseId, studentId) as { cnt: number };
    const grades = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM grades WHERE course_id = ? AND student_id = ? AND deleted_at IS NULL')
      .get(courseId, studentId) as { cnt: number };
    return performances.cnt + grades.cnt;
  }
}
