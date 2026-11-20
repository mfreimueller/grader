import type { JideLinkRepository, StudentLink } from '../../domain/jide/JideLinkRepository';
import type { Db } from './db';

export class SqliteJideLinkRepository implements JideLinkRepository {
  constructor(private readonly db: Db) {}

  async courseLink(courseId: string): Promise<string | null> {
    const row = this.db.prepare('SELECT jide_course_id FROM jide_course_links WHERE course_id = ?').get(courseId) as
      | { jide_course_id: string }
      | undefined;
    return row?.jide_course_id ?? null;
  }

  async setCourseLink(courseId: string, jideCourseId: string | null): Promise<void> {
    if (jideCourseId === null) {
      this.db.prepare('DELETE FROM jide_course_links WHERE course_id = ?').run(courseId);
      return;
    }
    this.db
      .prepare(
        `INSERT INTO jide_course_links (course_id, jide_course_id) VALUES (?, ?)
         ON CONFLICT (course_id) DO UPDATE SET jide_course_id = excluded.jide_course_id`,
      )
      .run(courseId, jideCourseId);
  }

  async studentLinks(studentIds: string[]): Promise<Map<string, string>> {
    const select = this.db.prepare('SELECT jide_student_id FROM jide_student_links WHERE student_id = ?');
    const links = new Map<string, string>();
    for (const studentId of studentIds) {
      const row = select.get(studentId) as { jide_student_id: string } | undefined;
      if (row) links.set(studentId, row.jide_student_id);
    }
    return links;
  }

  async setStudentLinks(links: StudentLink[]): Promise<void> {
    const upsert = this.db.prepare(
      `INSERT INTO jide_student_links (student_id, jide_student_id) VALUES (?, ?)
       ON CONFLICT (student_id) DO UPDATE SET jide_student_id = excluded.jide_student_id`,
    );
    const remove = this.db.prepare('DELETE FROM jide_student_links WHERE student_id = ?');
    const apply = this.db.transaction((all: StudentLink[]) => {
      for (const { studentId, jideStudentId } of all) {
        if (jideStudentId === null) remove.run(studentId);
        else upsert.run(studentId, jideStudentId);
      }
    });
    apply(links);
  }
}
