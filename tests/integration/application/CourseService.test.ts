import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { CourseService } from '../../../src/application/CourseService';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
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
    service = new CourseService(courseRepo, classRepo, new SqliteCourseRosterRepository(db));

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

  describe('cloning the roster', () => {
    beforeEach(() => {
      db.exec(`
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Muster', 'class-1');
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-2', 'Anna', 'Gruber', 'class-1');
      `);
    });

    const excludedOf = (courseId: string): string[] =>
      (db.prepare('SELECT student_id FROM course_excluded_students WHERE course_id = ?').all(courseId) as { student_id: string }[])
        .map((r) => r.student_id);

    it('copies the exclusion list when the clone stays in the same class', async () => {
      const created = await service.create({ title: 'Mathematik', schoolClassId: classId });
      if (!created.ok) throw created.error;
      db.prepare("INSERT INTO course_excluded_students (course_id, student_id) VALUES (?, 's-2')").run(created.value.id);

      const cloned = await service.clone(created.value.id, classId);

      expect(cloned.ok).toBe(true);
      if (cloned.ok) expect(excludedOf(cloned.value.id)).toEqual(['s-2']);
    });

    it('starts with the whole class when the clone goes to another class', async () => {
      const created = await service.create({ title: 'Mathematik', schoolClassId: classId });
      if (!created.ok) throw created.error;
      db.prepare("INSERT INTO course_excluded_students (course_id, student_id) VALUES (?, 's-2')").run(created.value.id);
      const otherYear = SchoolYear.create('2026/27');
      if (!otherYear.ok) throw otherYear.error;
      new SqliteSchoolClassRepository(db).save(new SchoolClass('class-2', '2A', otherYear.value));

      const cloned = await service.clone(created.value.id, 'class-2');

      expect(cloned.ok).toBe(true);
      if (cloned.ok) expect(excludedOf(cloned.value.id)).toEqual([]);
    });
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
