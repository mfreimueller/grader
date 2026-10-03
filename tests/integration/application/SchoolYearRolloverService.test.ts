import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteUnitOfWork } from '../../../src/infrastructure/persistence/SqliteUnitOfWork';
import { SchoolYearRolloverService } from '../../../src/application/SchoolYearRolloverService';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SchoolYearRolloverService', () => {
  let db: Db;
  let service: SchoolYearRolloverService;

  const row = (table: string, id: string): Record<string, unknown> =>
    db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown>;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    service = new SchoolYearRolloverService(
      new SqliteSchoolClassRepository(db),
      new SqliteCourseRepository(db),
      new SqliteUnitOfWork(db),
    );
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('c4', '4EHIF', '2025/26');
      INSERT INTO school_classes (id, name, school_year) VALUES ('c5', '5EHIF', '2025/26');
      INSERT INTO school_classes (id, name, school_year) VALUES ('c1', '1A', '2025/26');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s4', 'Max', 'Muster', 'c4');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s5', 'Anna', 'Gruber', 'c5');
      INSERT INTO courses (id, title, school_class_id) VALUES ('k4', 'Mathematik', 'c4');
      INSERT INTO courses (id, title, school_class_id) VALUES ('k5', 'Physik', 'c5');
    `);
  });

  afterEach(() => {
    db.close();
  });

  describe('preview', () => {
    it('proposes the next school year and a suggested name per class', async () => {
      const preview = await service.preview();

      expect(preview.targetSchoolYear).toBe('2026/27');
      const byId = Object.fromEntries(preview.classes.map((c) => [c.id, c]));
      expect(byId['c4']).toMatchObject({ name: '4EHIF', schoolYear: '2025/26', suggestedName: '5EHIF' });
      expect(byId['c1']!.suggestedName).toBe('2A');
    });

    it('lists no classes and proposes no year when there are no classes', async () => {
      db.exec('DELETE FROM courses; DELETE FROM students; DELETE FROM school_classes;');

      const preview = await service.preview();

      expect(preview.classes).toEqual([]);
    });
  });

  describe('apply', () => {
    it('renames and re-years classes in place so their students follow', async () => {
      const result = await service.apply({
        targetSchoolYear: '2026/27',
        archiveCourses: false,
        entries: [{ classId: 'c1', action: { type: 'rename', newName: '2A' } }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual({ renamed: 1, dropped: 0, coursesArchived: 0 });
      expect(row('school_classes', 'c1')).toMatchObject({ name: '2A', school_year: '2026/27' });
    });

    it('drops a class with its students and courses into the bin', async () => {
      const result = await service.apply({
        targetSchoolYear: '2026/27',
        archiveCourses: false,
        entries: [{ classId: 'c5', action: { type: 'drop' } }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.dropped).toBe(1);
      expect(row('school_classes', 'c5').deleted_at).not.toBeNull();
      expect(row('students', 's5').deleted_at).not.toBeNull();
      expect(row('courses', 'k5').deleted_at).not.toBeNull();
    });

    it('swaps names within one plan without colliding (4EHIF→5EHIF while 5EHIF is dropped)', async () => {
      const result = await service.apply({
        targetSchoolYear: '2026/27',
        archiveCourses: false,
        entries: [
          { classId: 'c5', action: { type: 'drop' } },
          { classId: 'c4', action: { type: 'rename', newName: '5EHIF' } },
        ],
      });

      expect(result.ok).toBe(true);
      expect(row('school_classes', 'c4')).toMatchObject({ name: '5EHIF', school_year: '2026/27' });
    });

    it('archives the remaining courses when clean slate is requested', async () => {
      const result = await service.apply({
        targetSchoolYear: '2026/27',
        archiveCourses: true,
        entries: [
          { classId: 'c5', action: { type: 'drop' } },
          { classId: 'c4', action: { type: 'rename', newName: '5EHIF' } },
        ],
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.coursesArchived).toBe(1);
      expect(row('courses', 'k4').deleted_at).not.toBeNull();
      expect(row('students', 's4').deleted_at).toBeNull();
    });

    it('keeps courses when clean slate is not requested', async () => {
      await service.apply({
        targetSchoolYear: '2026/27',
        archiveCourses: false,
        entries: [{ classId: 'c4', action: { type: 'rename', newName: '5X' } }],
      });

      expect(row('courses', 'k4').deleted_at).toBeNull();
    });

    it.each([
      ['an invalid school year', { targetSchoolYear: 'abc', entries: [{ classId: 'c1', action: { type: 'rename' as const, newName: '2A' } }] }],
      ['an empty new name', { targetSchoolYear: '2026/27', entries: [{ classId: 'c1', action: { type: 'rename' as const, newName: '  ' } }] }],
      ['an unknown class', { targetSchoolYear: '2026/27', entries: [{ classId: 'nope', action: { type: 'drop' as const } }] }],
      ['the same class listed twice', { targetSchoolYear: '2026/27', entries: [
        { classId: 'c1', action: { type: 'drop' as const } },
        { classId: 'c1', action: { type: 'rename' as const, newName: '2A' } },
      ] }],
    ])('rejects %s without changing anything', async (_label, input) => {
      const result = await service.apply({ ...input, archiveCourses: true });

      expect(result.ok).toBe(false);
      expect(row('school_classes', 'c1')).toMatchObject({ name: '1A', school_year: '2025/26', deleted_at: null });
      expect(row('courses', 'k4').deleted_at).toBeNull();
    });

    it('rejects two classes ending up with the same name in the target year', async () => {
      const result = await service.apply({
        targetSchoolYear: '2026/27',
        archiveCourses: false,
        entries: [
          { classId: 'c4', action: { type: 'rename', newName: '5X' } },
          { classId: 'c1', action: { type: 'rename', newName: '5X' } },
        ],
      });

      expect(result.ok).toBe(false);
    });

    it('rejects a new name that collides with a class that stays in the target year', async () => {
      db.exec("INSERT INTO school_classes (id, name, school_year) VALUES ('cx', '2A', '2026/27')");

      const result = await service.apply({
        targetSchoolYear: '2026/27',
        archiveCourses: false,
        entries: [{ classId: 'c1', action: { type: 'rename', newName: '2A' } }],
      });

      expect(result.ok).toBe(false);
    });

    it('rolls back everything when a later step fails', async () => {
      db.exec(`CREATE TRIGGER fail_course_update BEFORE UPDATE ON courses
               BEGIN SELECT RAISE(ABORT, 'boom'); END;`);

      await expect(
        service.apply({
          targetSchoolYear: '2026/27',
          archiveCourses: true,
          entries: [{ classId: 'c1', action: { type: 'rename', newName: '2A' } }],
        }),
      ).rejects.toThrow('boom');

      expect(row('school_classes', 'c1')).toMatchObject({ name: '1A', school_year: '2025/26' });
    });
  });
});
