import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
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
    it('removes a school class', async () => {
      const year = SchoolYear.create('2025/26');
      if (!year.ok) throw new Error('SchoolYear creation failed');
      await repo.save(new SchoolClass('class-1', '1A', year.value));

      await repo.delete('class-1');
      const found = await repo.findById('class-1');
      expect(found).toBeNull();
    });
  });
});
