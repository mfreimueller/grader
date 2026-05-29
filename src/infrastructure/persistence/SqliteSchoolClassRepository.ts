import type { Db } from './db';
import { SchoolClassRepository } from '../../domain/student/SchoolClassRepository';
import { SchoolClass } from '../../domain/student/SchoolClass';
import { SchoolYear } from '../../domain/student/SchoolYear';

interface SchoolClassRow {
  id: string;
  name: string;
  school_year: string;
}

export class SqliteSchoolClassRepository implements SchoolClassRepository {
  constructor(private readonly db: Db) {}

  async findAll(): Promise<SchoolClass[]> {
    const rows = this.db
      .prepare('SELECT id, name, school_year FROM school_classes')
      .all() as SchoolClassRow[];

    return rows.map(r => this.rowToSchoolClass(r));
  }

  async findByNameAndYear(name: string, schoolYear: string): Promise<SchoolClass | null> {
    const row = this.db
      .prepare('SELECT id, name, school_year FROM school_classes WHERE name = ? AND school_year = ?')
      .get(name, schoolYear) as SchoolClassRow | undefined;

    if (!row) return null;
    return this.rowToSchoolClass(row);
  }

  async findById(id: string): Promise<SchoolClass | null> {
    const row = this.db
      .prepare('SELECT id, name, school_year FROM school_classes WHERE id = ?')
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
    this.db.prepare('DELETE FROM school_classes WHERE id = ?').run(id);
  }

  private rowToSchoolClass(row: SchoolClassRow): SchoolClass {
    const yearResult = SchoolYear.create(row.school_year);
    if (!yearResult.ok) throw yearResult.error;

    return new SchoolClass(row.id, row.name, yearResult.value);
  }
}
