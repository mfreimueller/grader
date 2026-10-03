import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { CourseRosterService } from '../../../src/application/CourseRosterService';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('CourseRosterService', () => {
  let db: Db;
  let service: CourseRosterService;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    service = new CourseRosterService(
      new SqliteCourseRepository(db),
      new SqliteStudentRepository(db),
      new SqliteCourseRosterRepository(db),
    );
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '4A', '2026/27');
      INSERT INTO school_classes (id, name, school_year) VALUES ('class-2', '4B', '2026/27');
      INSERT INTO students (id, first_name, last_name, school_class_id, color) VALUES ('s-1', 'Max', 'Muster', 'class-1', '#ed1943');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-2', 'Anna', 'Gruber', 'class-1');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-3', 'Zoe', 'Zimmer', 'class-1');
      INSERT INTO students (id, first_name, last_name, school_class_id, deleted_at) VALUES ('s-gone', 'Eva', 'Alt', 'class-1', '2026-01-01');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-other', 'Other', 'Class', 'class-2');
      INSERT INTO courses (id, title, school_class_id) VALUES ('c-1', 'Mathematik', 'class-1');
      INSERT INTO assessment_categories (id, title, grading_type, course_id) VALUES ('cat-1', 'Mitarbeit', 'TERTIARY', 'c-1');
      INSERT INTO sessions (id, date, course_id) VALUES ('sess-1', '2026-10-01', 'c-1');
      INSERT INTO assessments (id, title, category_id, course_id, session_id) VALUES ('a-1', 'Mündlich', 'cat-1', 'c-1', 'sess-1');
    `);
  });

  afterEach(() => {
    db.close();
  });

  const ids = (entries: { studentId: string }[]): string[] => entries.map((e) => e.studentId);

  describe('list', () => {
    it('lists the live students of the class sorted by name, all included by default', async () => {
      const result = await service.list('c-1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(ids(result.value)).toEqual(['s-2', 's-1', 's-3']);
      expect(result.value.every((e) => e.included)).toBe(true);
      expect(result.value.find((e) => e.studentId === 's-1')?.color).toBe('#ed1943');
    });

    it('still lists excluded students, marked as not included', async () => {
      await service.setIncluded('c-1', 's-1', false);

      const result = await service.list('c-1');

      expect(result.ok && result.value.filter((e) => !e.included).map((e) => e.studentId)).toEqual(['s-1']);
    });

    it('reports how many entries a student has in the course', async () => {
      db.exec(`
        INSERT INTO student_performances (id, student_id, assessment_id, symbol, type) VALUES ('p-1', 's-1', 'a-1', 'PLUS', 'participation');
        INSERT INTO grades (id, student_id, course_id, score) VALUES ('g-1', 's-1', 'c-1', 2);
      `);

      const result = await service.list('c-1');

      expect(result.ok && result.value.find((e) => e.studentId === 's-1')?.entryCount).toBe(2);
      expect(result.ok && result.value.find((e) => e.studentId === 's-2')?.entryCount).toBe(0);
    });

    it('fails for an unknown course', async () => {
      expect((await service.list('nope')).ok).toBe(false);
    });
  });

  describe('setIncluded', () => {
    it('excludes a student and includes them again, keeping their data', async () => {
      db.exec("INSERT INTO grades (id, student_id, course_id, score) VALUES ('g-1', 's-1', 'c-1', 2)");

      const excluded = await service.setIncluded('c-1', 's-1', false);
      expect(excluded.ok && excluded.value.included).toBe(false);
      expect(excluded.ok && excluded.value.entryCount).toBe(1);

      const included = await service.setIncluded('c-1', 's-1', true);
      expect(included.ok && included.value.included).toBe(true);
      expect((db.prepare('SELECT COUNT(*) AS cnt FROM grades').get() as { cnt: number }).cnt).toBe(1);
    });

    it.each(['s-gone', 's-other', 'nobody'])('rejects %s because they are not in the class', async (id) => {
      expect((await service.setIncluded('c-1', id, false)).ok).toBe(false);
    });

    it('fails for an unknown course', async () => {
      expect((await service.setIncluded('nope', 's-1', false)).ok).toBe(false);
    });
  });

  describe('setAll', () => {
    it('excludes everybody and includes everybody again', async () => {
      await service.setAll('c-1', false);
      const none = await service.list('c-1');
      expect(none.ok && none.value.every((e) => !e.included)).toBe(true);

      await service.setAll('c-1', true);
      const all = await service.list('c-1');
      expect(all.ok && all.value.every((e) => e.included)).toBe(true);
    });

    it('fails for an unknown course', async () => {
      expect((await service.setAll('nope', true)).ok).toBe(false);
    });
  });

  describe('members', () => {
    it('returns the taught students as student dtos sorted by name', async () => {
      await service.setIncluded('c-1', 's-3', false);

      const result = await service.members('c-1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.map((s) => s.id)).toEqual(['s-2', 's-1']);
      expect(result.value[1]).toMatchObject({
        firstName: 'Max',
        lastName: 'Muster',
        color: '#ed1943',
        schoolClass: { id: 'class-1', name: '4A', schoolYear: '2026/27' },
      });
    });

    it('fails for an unknown course', async () => {
      expect((await service.members('nope')).ok).toBe(false);
    });
  });

  describe('rosterOf', () => {
    it('returns the students taught in the course, sorted by name', async () => {
      await service.setIncluded('c-1', 's-1', false);

      const result = await service.rosterOf('c-1');

      expect(result.ok && result.value.map((s) => s.id.value)).toEqual(['s-2', 's-3']);
    });

    it('fails for an unknown course', async () => {
      expect((await service.rosterOf('nope')).ok).toBe(false);
    });
  });
});
