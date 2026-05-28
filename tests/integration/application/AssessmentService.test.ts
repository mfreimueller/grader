import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { AssessmentService } from '../../../src/application/AssessmentService';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Course } from '../../../src/domain/grade/Course';
import { Session } from '../../../src/domain/grade/Session';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('AssessmentService', () => {
  let db: Db;
  let service: AssessmentService;
  let courseId: string;
  let categoryId: string;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const sessionRepo = new SqliteSessionRepository(db);
    const assessmentRepo = new SqliteAssessmentRepository(db);
    service = new AssessmentService(assessmentRepo, sessionRepo, courseRepo);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    classRepo.save(schoolClass);

    const course = Course.create('course-1', 'Mathematik', schoolClass);
    courseRepo.save(course);
    courseId = 'course-1';
    categoryId = course.assessmentCategories[0]!.id;
  });

  afterEach(() => {
    db.close();
  });

  it('creates an assessment', async () => {
    const result = await service.create({
      title: 'Test 1',
      date: '2025-10-01T00:00:00.000Z',
      categoryId,
      courseId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Test 1');
    expect(result.value.maxPoints).toBeNull();
  });

  it('creates a graded assessment with maxPoints', async () => {
    const result = await service.create({
      title: 'Schularbeit',
      date: '2025-10-01T00:00:00.000Z',
      categoryId,
      courseId,
      maxPoints: 100,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.maxPoints).toBe(100);
  });

  it('fails with invalid category', async () => {
    const result = await service.create({
      title: 'Test',
      date: '2025-10-01T00:00:00.000Z',
      categoryId: 'nonexistent',
      courseId,
    });
    expect(result.ok).toBe(false);
  });

  it('creates assessment linked to a session', async () => {
    const courseRepo2 = new SqliteCourseRepository(db);
    const course = await courseRepo2.findById(courseId);
    const s = Session.create('session-1', new Date('2025-10-01'), '', course!);
    const sessionRepo2 = new SqliteSessionRepository(db);
    await sessionRepo2.save(s);

    const result = await service.create({
      sessionId: 'session-1',
      title: 'Session Test',
      date: '2025-10-01T00:00:00.000Z',
      categoryId,
      courseId,
    });
    expect(result.ok).toBe(true);
  });

  it('deletes an assessment', async () => {
    const created = await service.create({ title: 'Test', date: '2025-10-01T00:00:00.000Z', categoryId, courseId });
    if (!created.ok) return;
    const deleted = await service.delete(created.value.id);
    expect(deleted.ok).toBe(true);
  });
});
