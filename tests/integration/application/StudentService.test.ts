import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { StudentService } from '../../../src/application/StudentService';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('StudentService', () => {
  let db: Db;
  let service: StudentService;
  let classId: string;

  beforeEach(async () => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    service = new StudentService(studentRepo, classRepo);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    await classRepo.save(schoolClass);
    classId = 'class-1';
  });

  afterEach(() => {
    db.close();
  });

  it('lists students (empty)', async () => {
    const list = await service.list();
    expect(list).toEqual([]);
  });

  it('creates a student', async () => {
    const result = await service.create({
      firstName: 'Max',
      lastName: 'Mustermann',
      schoolClassId: classId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.firstName).toBe('Max');
    expect(result.value.lastName).toBe('Mustermann');
  });

  it('fails to create with empty firstName', async () => {
    const result = await service.create({
      firstName: '',
      lastName: 'Mustermann',
      schoolClassId: classId,
    });
    expect(result.ok).toBe(false);
  });

  it('fails to create with missing school class', async () => {
    const result = await service.create({
      firstName: 'Max',
      lastName: 'Mustermann',
      schoolClassId: 'nonexistent',
    });
    expect(result.ok).toBe(false);
  });

  it('finds a student by id', async () => {
    const created = await service.create({ firstName: 'Max', lastName: 'Mustermann', schoolClassId: classId });
    if (!created.ok) return;
    const found = await service.findById(created.value.id);
    expect(found.ok).toBe(true);
  });

  it('updates a student', async () => {
    const created = await service.create({ firstName: 'Max', lastName: 'Mustermann', schoolClassId: classId });
    if (!created.ok) return;
    const updated = await service.update(created.value.id, { firstName: 'Moritz' });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.firstName).toBe('Moritz');
  });

  it('deletes a student (soft delete)', async () => {
    const created = await service.create({ firstName: 'Max', lastName: 'Mustermann', schoolClassId: classId });
    if (!created.ok) return;
    const deleted = await service.delete(created.value.id);
    expect(deleted.ok).toBe(true);
    const list = await service.list();
    expect(list).toHaveLength(0);
  });
});
