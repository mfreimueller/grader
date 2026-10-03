import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteStudentPickCountRepository } from '../../../src/infrastructure/persistence/SqliteStudentPickCountRepository';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { CourseRosterService } from '../../../src/application/CourseRosterService';
import { StudentPickerService } from '../../../src/application/StudentPickerService';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('StudentPickerService', () => {
  let db: Db;
  let random: () => number;
  let service: StudentPickerService;
  let rosterService: CourseRosterService;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    random = () => 0;
    const courseRepo = new SqliteCourseRepository(db);
    rosterService = new CourseRosterService(
      courseRepo,
      new SqliteStudentRepository(db),
      new SqliteCourseRosterRepository(db),
    );
    service = new StudentPickerService(
      courseRepo,
      rosterService,
      new SqliteStudentPickCountRepository(db),
      () => random(),
    );
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '4A', '2025/26');
      INSERT INTO school_classes (id, name, school_year) VALUES ('class-2', '4B', '2025/26');
      INSERT INTO students (id, first_name, last_name, school_class_id, color) VALUES ('s-1', 'Max', 'Muster', 'class-1', '#ed1943');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-2', 'Anna', 'Gruber', 'class-1');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-3', 'Zoe', 'Zimmer', 'class-1');
      INSERT INTO students (id, first_name, last_name, school_class_id, deleted_at)
        VALUES ('s-gone', 'Old', 'Student', 'class-1', '2025-01-01 10:00:00');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-other', 'Other', 'Class', 'class-2');
      INSERT INTO courses (id, title, school_class_id) VALUES ('c-1', 'Mathematik', 'class-1');
      INSERT INTO courses (id, title, school_class_id) VALUES ('c-empty', 'Leer', 'class-2');
      DELETE FROM students WHERE id = 's-other';
    `);
  });

  afterEach(() => {
    db.close();
  });

  const picked = async (action: Promise<{ ok: boolean; value?: { studentId: string } }>): Promise<string> => {
    const result = await action;
    if (!result.ok || !result.value) throw new Error('expected ok');
    return result.value.studentId;
  };

  describe('list', () => {
    it('lists the live students of the courses class sorted by name with counts and colors', async () => {
      await service.setPickCount('c-1', 's-2', 3);

      const result = await service.list('c-1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.map((s) => [s.studentId, s.pickCount, s.color])).toEqual([
        ['s-2', 3, null],
        ['s-1', 0, '#ed1943'],
        ['s-3', 0, null],
      ]);
    });

    it('marks who is in the fair pool: everybody at the minimum count', async () => {
      await service.setPickCount('c-1', 's-2', 3);
      await service.setPickCount('c-1', 's-1', 1);

      const result = await service.list('c-1');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.filter((s) => s.inFairPool).map((s) => s.studentId)).toEqual(['s-3']);
    });

    it('has everybody in the fair pool when all counts are equal', async () => {
      const result = await service.list('c-1');

      expect(result.ok && result.value.every((s) => s.inFairPool)).toBe(true);
    });

    it('leaves out students who are not taught in the course', async () => {
      await rosterService.setIncluded('c-1', 's-1', false);

      const result = await service.list('c-1');

      expect(result.ok && result.value.map((s) => s.studentId)).toEqual(['s-2', 's-3']);
    });

    it('fails for an unknown course', async () => {
      expect((await service.list('nope')).ok).toBe(false);
    });
  });

  describe('pickRandom', () => {
    it('increments the count of the winner and returns the new count', async () => {
      const result = await service.pickRandom('c-1', true);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toMatchObject({ studentId: 's-2', pickCount: 1 });
    });

    it('in fair mode never repeats a student before everybody was picked', async () => {
      random = Math.random;

      const winners = [
        await picked(service.pickRandom('c-1', true)),
        await picked(service.pickRandom('c-1', true)),
        await picked(service.pickRandom('c-1', true)),
      ];

      expect(new Set(winners).size).toBe(3);
    });

    it('with fair mode off may pick a student who is ahead of the others', async () => {
      await service.setPickCount('c-1', 's-2', 4);

      const winner = await picked(service.pickRandom('c-1', false));

      expect(winner).toBe('s-2');
    });

    it('never picks deleted students', async () => {
      random = () => 0.999;

      for (let i = 0; i < 6; i++) {
        expect(await picked(service.pickRandom('c-1', false))).not.toBe('s-gone');
      }
    });

    it('never picks a student who is not taught in the course', async () => {
      await rosterService.setIncluded('c-1', 's-1', false);
      random = () => 0.999;

      for (let i = 0; i < 6; i++) {
        expect(await picked(service.pickRandom('c-1', false))).not.toBe('s-1');
      }
    });

    it('fails when the class has no students', async () => {
      const result = await service.pickRandom('c-empty', true);

      expect(result.ok).toBe(false);
    });

    it('fails for an unknown course', async () => {
      expect((await service.pickRandom('nope', true)).ok).toBe(false);
    });
  });

  describe('pickStudent', () => {
    it('increments exactly that student regardless of fairness', async () => {
      await service.pickStudent('c-1', 's-3');
      const result = await service.pickStudent('c-1', 's-3');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toMatchObject({ studentId: 's-3', pickCount: 2 });
    });

    it('rejects a student who is not taught in the course', async () => {
      await rosterService.setIncluded('c-1', 's-2', false);

      expect((await service.pickStudent('c-1', 's-2')).ok).toBe(false);
    });

    it.each(['s-gone', 'unknown'])('rejects %s because they are not on the roster', async (id) => {
      expect((await service.pickStudent('c-1', id)).ok).toBe(false);
    });
  });

  describe('setPickCount', () => {
    it('sets the count absolutely and idempotently', async () => {
      await service.setPickCount('c-1', 's-1', 2);
      const result = await service.setPickCount('c-1', 's-1', 2);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.pickCount).toBe(2);
    });

    it.each([-1, 1.5])('rejects %p', async (count) => {
      expect((await service.setPickCount('c-1', 's-1', count)).ok).toBe(false);
    });

    it('rejects a student who is not on the roster', async () => {
      expect((await service.setPickCount('c-1', 's-gone', 1)).ok).toBe(false);
    });
  });

  describe('reset', () => {
    it('sets every count of the course back to zero', async () => {
      await service.pickStudent('c-1', 's-1');
      await service.pickStudent('c-1', 's-2');

      const result = await service.reset('c-1');

      expect(result.ok).toBe(true);
      const list = await service.list('c-1');
      expect(list.ok && list.value.every((s) => s.pickCount === 0)).toBe(true);
    });

    it('fails for an unknown course', async () => {
      expect((await service.reset('nope')).ok).toBe(false);
    });
  });
});
