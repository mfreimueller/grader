import type { Db } from './db';
import { StudentPickCountRepository } from '../../domain/grade/StudentPickCountRepository';

export class SqliteStudentPickCountRepository implements StudentPickCountRepository {
  constructor(private readonly db: Db) {}

  async findByCourse(courseId: string): Promise<Map<string, number>> {
    const rows = this.db
      .prepare('SELECT student_id, pick_count FROM course_student_picks WHERE course_id = ?')
      .all(courseId) as { student_id: string; pick_count: number }[];
    return new Map(rows.map((r) => [r.student_id, r.pick_count]));
  }

  async increment(courseId: string, studentId: string): Promise<number> {
    const row = this.db
      .prepare(
        `INSERT INTO course_student_picks (course_id, student_id, pick_count) VALUES (?, ?, 1)
         ON CONFLICT (course_id, student_id) DO UPDATE SET pick_count = pick_count + 1
         RETURNING pick_count`,
      )
      .get(courseId, studentId) as { pick_count: number };
    return row.pick_count;
  }

  async setCount(courseId: string, studentId: string, count: number): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO course_student_picks (course_id, student_id, pick_count) VALUES (?, ?, ?)
         ON CONFLICT (course_id, student_id) DO UPDATE SET pick_count = excluded.pick_count`,
      )
      .run(courseId, studentId, count);
  }

  async reset(courseId: string): Promise<void> {
    this.db.prepare('DELETE FROM course_student_picks WHERE course_id = ?').run(courseId);
  }
}
