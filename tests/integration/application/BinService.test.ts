import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SchoolClassService } from '../../../src/application/SchoolClassService';
import { BinService } from '../../../src/application/BinService';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('BinService', () => {
  let db: Db;
  let classService: SchoolClassService;
  let bin: BinService;

  const count = (table: string): number =>
    (db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as { cnt: number }).cnt;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    const classRepo = new SqliteSchoolClassRepository(db);
    classService = new SchoolClassService(classRepo);
    bin = new BinService(new SqliteStudentRepository(db), classRepo, new SqliteCourseRepository(db));
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '4EHIF', '2025/26');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Muster', 'class-1');
      INSERT INTO students (id, first_name, last_name, school_class_id, deleted_at)
        VALUES ('s-old', 'Old', 'Student', 'class-1', '2025-01-01 10:00:00');
      INSERT INTO courses (id, title, school_class_id) VALUES ('c-1', 'Mathematik', 'class-1');
      INSERT INTO assessment_categories (id, title, grading_type, course_id)
        VALUES ('c-1:mitarbeit', 'Mitarbeit', 'TERTIARY', 'c-1');
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('lists deleted courses next to deleted students and classes', async () => {
    await classService.delete('class-1');

    const list = await bin.listAll();

    expect(list.classes.map((c) => c.id)).toEqual(['class-1']);
    expect(list.students.map((s) => s.id).sort()).toEqual(['s-1', 's-old']);
    expect(list.courses).toHaveLength(1);
    expect(list.courses[0]).toMatchObject({ id: 'c-1', title: 'Mathematik', className: '4EHIF' });
  });

  it('restores a class together with the students and courses deleted with it', async () => {
    await classService.delete('class-1');

    await bin.restoreClass('class-1');

    const list = await bin.listAll();
    expect(list.classes).toHaveLength(0);
    expect(list.courses).toHaveLength(0);
    expect(list.students.map((s) => s.id)).toEqual(['s-old']);
  });

  it('restores a single deleted course', async () => {
    await classService.delete('class-1');
    await bin.restoreClass('class-1');
    db.prepare("UPDATE courses SET deleted_at = datetime('now') WHERE id = 'c-1'").run();

    await bin.restoreCourse('c-1');

    expect((await bin.listAll()).courses).toHaveLength(0);
  });

  it('fails to restore a course that is not in the bin', async () => {
    await expect(bin.restoreCourse('c-1')).rejects.toThrow('not found');
  });

  it('permanently deletes a course from the bin', async () => {
    await classService.delete('class-1');

    await bin.hardDeleteCourse('c-1');

    expect(count('courses')).toBe(0);
    expect(count('assessment_categories')).toBe(0);
  });

  it('empties the bin, removing students and courses before their classes', async () => {
    await classService.delete('class-1');

    await bin.emptyBin();

    expect(count('school_classes')).toBe(0);
    expect(count('students')).toBe(0);
    expect(count('courses')).toBe(0);
  });
});
