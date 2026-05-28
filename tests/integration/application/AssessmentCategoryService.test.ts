import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { AssessmentCategoryService } from '../../../src/application/AssessmentCategoryService';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Course } from '../../../src/domain/grade/Course';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('AssessmentCategoryService', () => {
  let db: Db;
  let service: AssessmentCategoryService;
  let courseId: string;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    service = new AssessmentCategoryService(courseRepo);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    classRepo.save(schoolClass);

    const course = Course.create('course-1', 'Mathematik', schoolClass);
    courseRepo.save(course);
    courseId = 'course-1';
  });

  afterEach(() => {
    db.close();
  });

  it('lists categories for a course', async () => {
    const list = await service.listByCourse(courseId);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]!.title).toBe('Mitarbeit');
  });

  it('creates a category', async () => {
    const result = await service.create({
      courseId,
      title: 'Schularbeit',
      gradingType: 'NUMERIC',
      displayAsGrade: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Schularbeit');
    expect(result.value.gradingType).toBe('NUMERIC');
  });

  it('updates a category', async () => {
    const list = await service.listByCourse(courseId);
    const catId = list[0]!.id;
    const result = await service.update(catId, { title: 'Mitarbeit Updated' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Mitarbeit Updated');
  });

  it('prevents deletion of Mitarbeit category', async () => {
    const list = await service.listByCourse(courseId);
    const mitarbeitId = list.find(c => c.title === 'Mitarbeit')!.id;
    const result = await service.delete(mitarbeitId);
    expect(result.ok).toBe(false);
  });
});
