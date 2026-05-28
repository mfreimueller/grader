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
});
