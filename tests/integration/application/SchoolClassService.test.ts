import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SchoolClassService } from '../../../src/application/SchoolClassService';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SchoolClassService', () => {
  let db: Db;
  let service: SchoolClassService;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    service = new SchoolClassService(new SqliteSchoolClassRepository(db));
  });

  afterEach(() => {
    db.close();
  });

  it('lists classes (empty)', async () => {
    const list = await service.list();
    expect(list).toEqual([]);
  });

  it('creates a class', async () => {
    const result = await service.create({ name: '1A', schoolYear: '2025/26' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('1A');
    expect(result.value.schoolYear).toBe('2025/26');
  });

  it('finds a class by id', async () => {
    const created = await service.create({ name: '1A', schoolYear: '2025/26' });
    if (!created.ok) return;
    const found = await service.findById(created.value.id);
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.name).toBe('1A');
  });

  it('returns not found for missing id', async () => {
    const found = await service.findById('nonexistent');
    expect(found.ok).toBe(false);
  });

  it('updates a class', async () => {
    const created = await service.create({ name: '1A', schoolYear: '2025/26' });
    if (!created.ok) return;
    const updated = await service.update(created.value.id, { name: '1B' });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.name).toBe('1B');
    expect(updated.value.schoolYear).toBe('2025/26');
  });

  it('deletes a class', async () => {
    const created = await service.create({ name: '1A', schoolYear: '2025/26' });
    if (!created.ok) return;
    const deleted = await service.delete(created.value.id);
    expect(deleted.ok).toBe(true);
    const list = await service.list();
    expect(list).toHaveLength(0);
  });

  it('validates school year format on create', async () => {
    const result = await service.create({ name: '1A', schoolYear: 'invalid' });
    expect(result.ok).toBe(false);
  });

  describe('deleting a class with its students and courses', () => {
    const seedClass = (): void => {
      db.exec(`
        INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '4EHIF', '2025/26');
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Muster', 'class-1');
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-2', 'Anna', 'Gruber', 'class-1');
        INSERT INTO courses (id, title, school_class_id) VALUES ('c-1', 'Mathematik', 'class-1');
      `);
    };

    it('reports how many students and courses a deletion would remove', async () => {
      seedClass();

      const result = await service.dependents('class-1');

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual({ students: 2, courses: 1 });
    });

    it('fails with NotFound when asking dependents of an unknown class', async () => {
      const result = await service.dependents('nope');

      expect(result.ok).toBe(false);
    });

    it('soft-deletes the class together with its students and courses', async () => {
      seedClass();

      const result = await service.delete('class-1');

      expect(result.ok).toBe(true);
      const live = (table: string): number =>
        (db.prepare(`SELECT COUNT(*) AS cnt FROM ${table} WHERE deleted_at IS NULL`).get() as { cnt: number }).cnt;
      expect(live('school_classes')).toBe(0);
      expect(live('students')).toBe(0);
      expect(live('courses')).toBe(0);
      const rows = db.prepare('SELECT COUNT(*) AS cnt FROM students').get() as { cnt: number };
      expect(rows.cnt).toBe(2);
    });

    it('fails with NotFound when deleting an unknown class', async () => {
      const result = await service.delete('nope');

      expect(result.ok).toBe(false);
    });
  });
});
