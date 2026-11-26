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
import { NotFoundError, ValidationError } from '../../../src/shared/errors';
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

  describe('changeCategory', () => {
    const insertCategory = (id: string, title: string, type: string, course = 'course-1'): void => {
      db.prepare(
        'INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id) VALUES (?, ?, ?, 0, ?)',
      ).run(id, title, type, course);
    };

    const createShared = async (): Promise<string> => {
      const created = await service.create({ sessionId, title: 'Test', categoryId, courseId, isImpromptu: false });
      if (!created.ok) throw created.error;
      return created.value.id;
    };

    it('moves the assessment to another category of the same grading type', async () => {
      insertCategory('cat-uebung', 'Übung', 'TERTIARY');
      const assessmentId = await createShared();

      const result = await service.changeCategory({ assessmentId, categoryId: 'cat-uebung' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.category.id).toBe('cat-uebung');
      expect(result.value.category.title).toBe('Übung');
      expect(result.value.date).toBe(new Date('2025-10-01').toISOString());
      const listed = await service.listBySession(sessionId);
      expect(listed[0]!.category.id).toBe('cat-uebung');
    });

    it('keeps results and findings of the assessment', async () => {
      insertCategory('cat-uebung', 'Übung', 'TERTIARY');
      const assessmentId = await createShared();
      db.prepare('INSERT INTO students (id, first_name, last_name, school_class_id) VALUES (?, ?, ?, ?)')
        .run('stu-1', 'Anna', 'Hoffmann', 'class-1');
      db.prepare(
        "INSERT INTO student_performances (id, student_id, assessment_id, symbol, type) VALUES ('p-1', 'stu-1', ?, 'PLUS', 'participation')",
      ).run(assessmentId);
      db.prepare(
        "INSERT INTO findings (id, student_performance_id, type, text_content) VALUES ('f-1', 'p-1', 'note', 'gut')",
      ).run();

      const result = await service.changeCategory({ assessmentId, categoryId: 'cat-uebung' });

      expect(result.ok).toBe(true);
      expect(db.prepare('SELECT id FROM student_performances WHERE assessment_id = ?').all(assessmentId)).toHaveLength(1);
      expect(db.prepare("SELECT id FROM findings WHERE student_performance_id = 'p-1'").all()).toHaveLength(1);
    });

    it('succeeds without change for the current category', async () => {
      const assessmentId = await createShared();
      const result = await service.changeCategory({ assessmentId, categoryId });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.category.id).toBe(categoryId);
    });

    it('rejects a category with a different grading type', async () => {
      insertCategory('cat-sa', 'Schularbeit', 'NUMERIC');
      const assessmentId = await createShared();

      const result = await service.changeCategory({ assessmentId, categoryId: 'cat-sa' });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
      const listed = await service.listBySession(sessionId);
      expect(listed[0]!.category.id).toBe(categoryId);
    });

    it('fails with NotFoundError for an unknown assessment', async () => {
      const result = await service.changeCategory({ assessmentId: 'missing', categoryId });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    });

    it('fails with NotFoundError for a category of another course', async () => {
      db.prepare("INSERT INTO courses (id, title, school_class_id) VALUES ('course-2', 'Deutsch', 'class-1')").run();
      insertCategory('cat-foreign', 'Übung', 'TERTIARY', 'course-2');
      const assessmentId = await createShared();

      const result = await service.changeCategory({ assessmentId, categoryId: 'cat-foreign' });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toContain('AssessmentCategory');
      }
    });

    it('fails with NotFoundError when the course of the assessment is gone', async () => {
      const assessmentId = await createShared();
      const missingCourse = new AssessmentService(
        new SqliteAssessmentRepository(db),
        sessionRepo,
        { findById: async () => null } as unknown as SqliteCourseRepository,
      );

      const result = await missingCourse.changeCategory({ assessmentId, categoryId });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('Course');
    });

    it('fails with NotFoundError when the session of the assessment is gone', async () => {
      insertCategory('cat-uebung', 'Übung', 'TERTIARY');
      const assessmentId = await createShared();
      const noSession = new AssessmentService(
        new SqliteAssessmentRepository(db),
        { findById: async () => null } as unknown as SqliteSessionRepository,
        new SqliteCourseRepository(db),
      );

      const result = await noSession.changeCategory({ assessmentId, categoryId: 'cat-uebung' });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toContain('Session');
    });
  });
});
