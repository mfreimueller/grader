import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { StudentId } from '../../../src/domain/student/StudentId';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteCourseRosterRepository', () => {
  let db: Db;
  let repo: SqliteCourseRosterRepository;

  const count = (table: string): number =>
    (db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as { cnt: number }).cnt;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteCourseRosterRepository(db);
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '4A', '2026/27');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Muster', 'class-1');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-2', 'Anna', 'Gruber', 'class-1');
      INSERT INTO courses (id, title, school_class_id) VALUES ('c-1', 'Mathematik', 'class-1');
      INSERT INTO courses (id, title, school_class_id) VALUES ('c-2', 'Physik', 'class-1');
      INSERT INTO assessment_categories (id, title, grading_type, course_id) VALUES ('cat-1', 'Mitarbeit', 'TERTIARY', 'c-1');
      INSERT INTO sessions (id, date, course_id) VALUES ('sess-1', '2026-10-01', 'c-1');
      INSERT INTO assessments (id, title, category_id, course_id, session_id) VALUES ('a-1', 'Mündlich', 'cat-1', 'c-1', 'sess-1');
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('has nobody excluded by default', async () => {
    expect((await repo.findExcludedIds('c-1')).size).toBe(0);
  });

  it('excludes and includes a student again', async () => {
    await repo.setExcluded('c-1', 's-1', true);
    expect([...(await repo.findExcludedIds('c-1'))]).toEqual(['s-1']);

    await repo.setExcluded('c-1', 's-1', false);
    expect((await repo.findExcludedIds('c-1')).size).toBe(0);
  });

  it('is idempotent when excluding twice', async () => {
    await repo.setExcluded('c-1', 's-1', true);
    await repo.setExcluded('c-1', 's-1', true);

    expect(count('course_excluded_students')).toBe(1);
  });

  it('keeps exclusions per course', async () => {
    await repo.setExcluded('c-1', 's-1', true);

    expect((await repo.findExcludedIds('c-2')).size).toBe(0);
  });

  it('replaces the whole exclusion list of one course only', async () => {
    await repo.setExcluded('c-1', 's-1', true);
    await repo.setExcluded('c-2', 's-1', true);

    await repo.replaceExcluded('c-1', ['s-2']);

    expect([...(await repo.findExcludedIds('c-1'))]).toEqual(['s-2']);
    expect([...(await repo.findExcludedIds('c-2'))]).toEqual(['s-1']);
  });

  it('clears the list when replaced with nothing', async () => {
    await repo.setExcluded('c-1', 's-1', true);

    await repo.replaceExcluded('c-1', []);

    expect((await repo.findExcludedIds('c-1')).size).toBe(0);
  });

  describe('countEntries', () => {
    it('is zero for a student without data', async () => {
      expect(await repo.countEntries('c-1', 's-1')).toBe(0);
    });

    it('counts live performances and grades of that student in that course', async () => {
      db.exec(`
        INSERT INTO student_performances (id, student_id, assessment_id, symbol, type) VALUES ('p-1', 's-1', 'a-1', 'PLUS', 'participation');
        INSERT INTO grades (id, student_id, course_id, score) VALUES ('g-1', 's-1', 'c-1', 2);
        INSERT INTO grades (id, student_id, course_id, score) VALUES ('g-2', 's-1', 'c-2', 3);
        INSERT INTO student_performances (id, student_id, assessment_id, symbol, type, deleted_at)
          VALUES ('p-del', 's-1', 'a-1', 'PLUS', 'participation', '2026-01-01');
        INSERT INTO student_performances (id, student_id, assessment_id, symbol, type) VALUES ('p-2', 's-2', 'a-1', 'PLUS', 'participation');
      `);

      expect(await repo.countEntries('c-1', 's-1')).toBe(2);
    });
  });

  describe('cleanup on hard delete', () => {
    it('removes the exclusions of a hard-deleted student', async () => {
      await repo.setExcluded('c-1', 's-1', true);
      const id = StudentId.create('s-1');
      if (!id.ok) throw new Error('creation failed');

      await new SqliteStudentRepository(db).hardDelete(id.value);

      expect(count('course_excluded_students')).toBe(0);
    });

    it('removes the exclusions of a hard-deleted course', async () => {
      await repo.setExcluded('c-1', 's-1', true);

      await new SqliteCourseRepository(db).hardDelete('c-1');

      expect(count('course_excluded_students')).toBe(0);
    });

    it('removes the exclusions when a course is deleted the old way', async () => {
      await repo.setExcluded('c-2', 's-1', true);

      await new SqliteCourseRepository(db).delete('c-2');

      expect(count('course_excluded_students')).toBe(0);
    });
  });
});
