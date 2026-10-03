import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { rejectionMessage } from '../../helpers/rejection';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteSchoolClassRepository', () => {
  let db: Db;
  let repo: SqliteSchoolClassRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteSchoolClassRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('save and findById', () => {
    it('persists a school class and retrieves it by id', async () => {
      const year = SchoolYear.create('2025/26');
      if (!year.ok) throw new Error('SchoolYear creation failed');
      const schoolClass = new SchoolClass('class-1', '1A', year.value);

      await repo.save(schoolClass);
      const found = await repo.findById('class-1');

      expect(found).not.toBeNull();
      expect(found!.id).toBe('class-1');
      expect(found!.name).toBe('1A');
      expect(found!.schoolYear.toString()).toBe('2025/26');
    });

    it('returns null for non-existent id', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });

    it('updates an existing class on save', async () => {
      const year = SchoolYear.create('2025/26');
      if (!year.ok) throw new Error('SchoolYear creation failed');
      const schoolClass = new SchoolClass('class-1', '1A', year.value);
      await repo.save(schoolClass);

      const updated = new SchoolClass('class-1', '1B', year.value);
      await repo.save(updated);

      const found = await repo.findById('class-1');
      expect(found!.name).toBe('1B');
    });
  });

  describe('findAll', () => {
    it('returns all school classes', async () => {
      const year = SchoolYear.create('2025/26');
      if (!year.ok) throw new Error('SchoolYear creation failed');

      await repo.save(new SchoolClass('class-1', '1A', year.value));
      await repo.save(new SchoolClass('class-2', '2A', year.value));

      const all = await repo.findAll();
      expect(all).toHaveLength(2);
    });

    it('returns empty array when no classes exist', async () => {
      const all = await repo.findAll();
      expect(all).toEqual([]);
    });
  });

  describe('delete', () => {
    it('soft-deletes a school class (sets deleted_at, row remains in DB)', async () => {
      const year = SchoolYear.create('2025/26');
      if (!year.ok) throw new Error('SchoolYear creation failed');
      await repo.save(new SchoolClass('class-1', '1A', year.value));

      await repo.delete('class-1');

      const found = await repo.findById('class-1');
      expect(found).toBeNull();

      const raw = db
        .prepare('SELECT id, deleted_at FROM school_classes WHERE id = ?')
        .get('class-1') as { id: string; deleted_at: string | null };
      expect(raw).not.toBeUndefined();
      expect(raw!.deleted_at).not.toBeNull();
    });
  });

  describe('class deletion with dependents', () => {
    const seed = (): void => {
      db.exec(`
        INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '4EHIF', '2025/26');
        INSERT INTO school_classes (id, name, school_year) VALUES ('class-2', '3EHIF', '2025/26');
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Muster', 'class-1');
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-2', 'Anna', 'Gruber', 'class-1');
        INSERT INTO students (id, first_name, last_name, school_class_id, deleted_at)
          VALUES ('s-gone', 'Old', 'Student', 'class-1', '2025-01-01 10:00:00');
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-3', 'Other', 'Class', 'class-2');
        INSERT INTO courses (id, title, school_class_id) VALUES ('c-1', 'Mathematik', 'class-1');
        INSERT INTO courses (id, title, school_class_id) VALUES ('c-2', 'Physik', 'class-2');
      `);
    };

    const deletedAt = (table: string, id: string): string | null =>
      (db.prepare(`SELECT deleted_at FROM ${table} WHERE id = ?`).get(id) as { deleted_at: string | null }).deleted_at;

    it('counts the live students and courses that a deletion would remove', async () => {
      seed();

      expect(await repo.countDependents('class-1')).toEqual({ students: 2, courses: 1 });
    });

    it('soft-deletes the class with its students and courses using one shared timestamp', async () => {
      seed();

      await repo.softDeleteWithDependents('class-1');

      const stamp = deletedAt('school_classes', 'class-1');
      expect(stamp).not.toBeNull();
      expect(deletedAt('students', 's-1')).toBe(stamp);
      expect(deletedAt('students', 's-2')).toBe(stamp);
      expect(deletedAt('courses', 'c-1')).toBe(stamp);
    });

    it('leaves other classes and previously deleted students untouched', async () => {
      seed();

      await repo.softDeleteWithDependents('class-1');

      expect(deletedAt('school_classes', 'class-2')).toBeNull();
      expect(deletedAt('students', 's-3')).toBeNull();
      expect(deletedAt('courses', 'c-2')).toBeNull();
      expect(deletedAt('students', 's-gone')).toBe('2025-01-01 10:00:00');
    });

    it('rolls everything back when one step fails', async () => {
      seed();
      db.exec(`CREATE TRIGGER fail_course_update BEFORE UPDATE ON courses
               BEGIN SELECT RAISE(ABORT, 'boom'); END;`);

      expect(await rejectionMessage(repo.softDeleteWithDependents('class-1'))).toContain('boom');

      expect(deletedAt('school_classes', 'class-1')).toBeNull();
      expect(deletedAt('students', 's-1')).toBeNull();
    });

    it('restores the class with exactly the students and courses deleted together with it', async () => {
      seed();
      await repo.softDeleteWithDependents('class-1');

      await repo.restoreWithDependents('class-1');

      expect(deletedAt('school_classes', 'class-1')).toBeNull();
      expect(deletedAt('students', 's-1')).toBeNull();
      expect(deletedAt('students', 's-2')).toBeNull();
      expect(deletedAt('courses', 'c-1')).toBeNull();
      expect(deletedAt('students', 's-gone')).toBe('2025-01-01 10:00:00');
    });

    it('refuses to hard-delete a class that still has courses', async () => {
      db.exec(`
        INSERT INTO school_classes (id, name, school_year, deleted_at) VALUES ('class-1', '4EHIF', '2025/26', '2026-01-01');
        INSERT INTO courses (id, title, school_class_id, deleted_at) VALUES ('c-1', 'Mathematik', 'class-1', '2026-01-01');
      `);

      await expect(repo.hardDelete('class-1')).rejects.toThrow('Kurs');
    });
  });
});
