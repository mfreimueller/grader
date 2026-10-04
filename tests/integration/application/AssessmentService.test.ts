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
  let sessionId: string;
  let sessionRepo: SqliteSessionRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    sessionRepo = new SqliteSessionRepository(db);
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

    const s = Session.create('session-1', new Date('2025-10-01'), '', course);
    sessionRepo.save(s);
    sessionId = 'session-1';
  });

  afterEach(() => {
    db.close();
  });

  it('creates an assessment', async () => {
    const result = await service.create({
      sessionId,
      title: 'Test 1',
      categoryId,
      courseId,
      isImpromptu: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Test 1');
    expect(result.value.maxPoints).toBeNull();
  });

  it('keeps the absent students of the session when adding an assessment', async () => {
    const stored = await sessionRepo.findById(sessionId);
    if (!stored) throw new Error('session missing');
    db.prepare('INSERT INTO students (id, first_name, last_name, school_class_id) VALUES (?, ?, ?, ?)')
      .run('stu-1', 'Anna', 'Hoffmann', 'class-1');
    await sessionRepo.save(
      Session.reconstitute(stored.id, stored.date, stored.notes, stored.course, [], [], ['stu-1']),
    );

    const result = await service.create({ sessionId, title: 'Test 2', categoryId, courseId, isImpromptu: false });
    expect(result.ok).toBe(true);

    const reloaded = await sessionRepo.findById(sessionId);
    expect(reloaded?.absentStudentIds).toEqual(['stu-1']);
  });

  it('keeps the student notes of the session when adding an assessment', async () => {
    const stored = await sessionRepo.findById(sessionId);
    if (!stored) throw new Error('session missing');
    db.prepare('INSERT INTO students (id, first_name, last_name, school_class_id) VALUES (?, ?, ?, ?)')
      .run('stu-1', 'Anna', 'Hoffmann', 'class-1');
    await sessionRepo.save(
      Session.reconstitute(stored.id, stored.date, stored.notes, stored.course, [], [], [], [{ studentId: 'stu-1', text: 'ruhig' }]),
    );

    const result = await service.create({ sessionId, title: 'Test 2', categoryId, courseId, isImpromptu: false });
    expect(result.ok).toBe(true);

    const reloaded = await sessionRepo.findById(sessionId);
    expect(reloaded?.studentNotes).toEqual([{ studentId: 'stu-1', text: 'ruhig' }]);
  });

  it('creates a graded assessment with maxPoints', async () => {
    const result = await service.create({
      sessionId,
      title: 'Schularbeit',
      categoryId,
      courseId,
      maxPoints: 100,
      isImpromptu: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.maxPoints).toBe(100);
  });

  it('fails with invalid category', async () => {
    const result = await service.create({
      sessionId,
      title: 'Test',
      categoryId: 'nonexistent',
      courseId,
      isImpromptu: false,
    });
    expect(result.ok).toBe(false);
  });

  it('creates assessment linked to a session', async () => {
    const result = await service.create({
      sessionId,
      title: 'Session Test',
      categoryId,
      courseId,
      isImpromptu: false,
    });
    expect(result.ok).toBe(true);
  });

  it('deletes an assessment', async () => {
    const created = await service.create({ sessionId, title: 'Test', categoryId, courseId, isImpromptu: false });
    if (!created.ok) return;
    const deleted = await service.delete(created.value.id);
    expect(deleted.ok).toBe(true);
  });
});
