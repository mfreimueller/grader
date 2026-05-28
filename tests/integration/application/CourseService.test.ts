import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { CourseService } from '../../../src/application/CourseService';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('CourseService', () => {
  let db: Db;
  let service: CourseService;
  let classId: string;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    service = new CourseService(courseRepo, classRepo);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    classRepo.save(schoolClass);
    classId = 'class-1';
  });

  afterEach(() => {
    db.close();
  });

  it('creates a course with Mitarbeit category', async () => {
    const result = await service.create({ title: 'Mathematik', schoolClassId: classId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Mathematik');
    expect(result.value.assessmentCategories.length).toBeGreaterThanOrEqual(1);
    const mitarbeit = result.value.assessmentCategories.find(c => c.title === 'Mitarbeit');
    expect(mitarbeit).toBeDefined();
  });

  it('lists courses', async () => {
    await service.create({ title: 'Mathematik', schoolClassId: classId });
    const list = await service.list();
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('finds course by id', async () => {
    const created = await service.create({ title: 'Mathematik', schoolClassId: classId });
    if (!created.ok) return;
    const found = await service.findById(created.value.id);
    expect(found.ok).toBe(true);
  });

  it('clones a course', async () => {
    const created = await service.create({ title: 'Mathematik', schoolClassId: classId });
    if (!created.ok) return;
    const oldYear = SchoolYear.create('2024/25');
    if (!oldYear.ok) throw oldYear.error;
    const oldClass = new SchoolClass('class-2', '2A', oldYear.value);
    const classRepo = new SqliteSchoolClassRepository(db);
    classRepo.save(oldClass);

    const cloned = await service.clone(created.value.id, 'class-2');
    expect(cloned.ok).toBe(true);
    if (!cloned.ok) return;
    expect(cloned.value.title).toBe('Mathematik');
    expect(cloned.value.schoolClass.id).toBe('class-2');
  });

  it('deletes a course', async () => {
    const created = await service.create({ title: 'Mathematik', schoolClassId: classId });
    if (!created.ok) return;
    const deleted = await service.delete(created.value.id);
    expect(deleted.ok).toBe(true);
    const found = await service.findById(created.value.id);
    expect(found.ok).toBe(false);
  });
});
