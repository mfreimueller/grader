import type { Db } from './db';
import { ClassDependentsCount, SchoolClassRepository } from '../../domain/student/SchoolClassRepository';
import { SchoolClass } from '../../domain/student/SchoolClass';
import { SchoolYear } from '../../domain/student/SchoolYear';

interface SchoolClassRow {
  id: string;
  name: string;
  school_year: string;
  deleted_at?: string | null;
}

export class SqliteSchoolClassRepository implements SchoolClassRepository {
  constructor(private readonly db: Db) {}

  async findAll(): Promise<SchoolClass[]> {
    const rows = this.db
      .prepare(
        'SELECT id, name, school_year FROM school_classes WHERE deleted_at IS NULL',
      )
      .all() as SchoolClassRow[];

    return rows.map(r => this.rowToSchoolClass(r));
  }

  async findByNameAndYear(name: string, schoolYear: string): Promise<SchoolClass | null> {
    const row = this.db
      .prepare(
        'SELECT id, name, school_year FROM school_classes WHERE name = ? AND school_year = ? AND deleted_at IS NULL',
      )
      .get(name, schoolYear) as SchoolClassRow | undefined;

    if (!row) return null;
    return this.rowToSchoolClass(row);
  }

  async findById(id: string): Promise<SchoolClass | null> {
    const row = this.db
      .prepare(
        'SELECT id, name, school_year FROM school_classes WHERE id = ? AND deleted_at IS NULL',
      )
      .get(id) as SchoolClassRow | undefined;

    if (!row) return null;
    return this.rowToSchoolClass(row);
  }

  async save(schoolClass: SchoolClass): Promise<void> {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO school_classes (id, name, school_year) VALUES (?, ?, ?)',
      )
      .run(schoolClass.id, schoolClass.name, schoolClass.schoolYear.toString());
  }

  async delete(id: string): Promise<void> {
    this.db
      .prepare(
        'UPDATE school_classes SET deleted_at = datetime(\'now\') WHERE id = ?',
      )
      .run(id);
  }

  async findDeleted(): Promise<SchoolClass[]> {
    const rows = this.db
      .prepare(
        'SELECT id, name, school_year, deleted_at FROM school_classes WHERE deleted_at IS NOT NULL',
      )
      .all() as SchoolClassRow[];

    return rows.map(r => this.rowToSchoolClass(r));
  }

  async restore(id: string): Promise<void> {
    this.db
      .prepare('UPDATE school_classes SET deleted_at = NULL WHERE id = ?')
      .run(id);
  }

  async hardDelete(id: string): Promise<void> {
    const studentCount = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM students WHERE school_class_id = ?')
      .get(id) as { cnt: number };

    if (studentCount.cnt > 0) {
      throw new Error(
        `Klasse kann nicht endgültig gelöscht werden: ${studentCount.cnt} Schüler vorhanden. Löschen Sie zuerst alle Schüler.`,
      );
    }

    const courseCount = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM courses WHERE school_class_id = ?')
      .get(id) as { cnt: number };

    if (courseCount.cnt > 0) {
      throw new Error(
        `Klasse kann nicht endgültig gelöscht werden: ${courseCount.cnt} Kurs(e) vorhanden. Löschen Sie zuerst alle Kurse.`,
      );
    }

    this.db.prepare('DELETE FROM school_classes WHERE id = ?').run(id);
  }

  async countDependents(id: string): Promise<ClassDependentsCount> {
    const students = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM students WHERE school_class_id = ? AND deleted_at IS NULL')
      .get(id) as { cnt: number };
    const courses = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM courses WHERE school_class_id = ? AND deleted_at IS NULL')
      .get(id) as { cnt: number };
    return { students: students.cnt, courses: courses.cnt };
  }

  async softDeleteWithDependents(id: string): Promise<void> {
    const deletedAt = new Date().toISOString();
    this.db.transaction(() => {
      this.db
        .prepare('UPDATE students SET deleted_at = ? WHERE school_class_id = ? AND deleted_at IS NULL')
        .run(deletedAt, id);
      this.db
        .prepare('UPDATE courses SET deleted_at = ? WHERE school_class_id = ? AND deleted_at IS NULL')
        .run(deletedAt, id);
      this.db.prepare('UPDATE school_classes SET deleted_at = ? WHERE id = ?').run(deletedAt, id);
    })();
  }

  async restoreWithDependents(id: string): Promise<void> {
    const row = this.db
      .prepare('SELECT deleted_at FROM school_classes WHERE id = ?')
      .get(id) as { deleted_at: string | null } | undefined;
    if (!row?.deleted_at) return;
    const deletedAt = row.deleted_at;

    this.db.transaction(() => {
      this.db
        .prepare('UPDATE students SET deleted_at = NULL WHERE school_class_id = ? AND deleted_at = ?')
        .run(id, deletedAt);
      this.db
        .prepare('UPDATE courses SET deleted_at = NULL WHERE school_class_id = ? AND deleted_at = ?')
        .run(id, deletedAt);
      this.db.prepare('UPDATE school_classes SET deleted_at = NULL WHERE id = ?').run(id);
    })();
  }

  private rowToSchoolClass(row: SchoolClassRow): SchoolClass {
    const yearResult = SchoolYear.create(row.school_year);
    if (!yearResult.ok) throw yearResult.error;

    return new SchoolClass(row.id, row.name, yearResult.value, row.deleted_at ?? null);
  }
}
