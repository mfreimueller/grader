import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { GradingService } from '../../../src/application/GradingService';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { CourseRosterService } from '../../../src/application/CourseRosterService';
import { MitarbeitPickService } from '../../../src/application/MitarbeitPickService';
import { Course } from '../../../src/domain/grade/Course';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('MitarbeitPickService', () => {
  let db: Db;
  let service: MitarbeitPickService;
  let grading: GradingService;
  let rosterService: CourseRosterService;

  const count = (table: string): number =>
    (db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as { cnt: number }).cnt;

  beforeEach(async () => {
    db = createInMemoryDb();
    runMigrations(db);
    const courseRepo = new SqliteCourseRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    const sessionRepo = new SqliteSessionRepository(db);
    const gradeRepo = new SqliteGradeRepository(db);
    grading = new GradingService(gradeRepo, courseRepo, gradeRepo, studentRepo, new SqliteAssessmentRepository(db), sessionRepo);
    rosterService = new CourseRosterService(courseRepo, studentRepo, new SqliteCourseRosterRepository(db));
    service = new MitarbeitPickService(courseRepo, sessionRepo, studentRepo, grading, rosterService);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '4A', year.value);
    db.exec("INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '4A', '2025/26')");
    await courseRepo.save(Course.create('course-1', 'Mathematik', schoolClass));
    db.exec(`
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Muster', 'class-1');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-2', 'Anna', 'Gruber', 'class-1');
    `);
  });

  afterEach(() => {
    db.close();
  });

  const input = (studentId: string, symbol: string, date = '2026-10-03') => ({
    courseId: 'course-1',
    studentId,
    symbol,
    date,
  });

  it('creates the session for that day with its Mündlich assessment and records the symbol', async () => {
    const result = await service.record(input('s-1', 'PLUS'));

    expect(result.ok).toBe(true);
    expect(count('sessions')).toBe(1);
    expect(count('assessments')).toBe(1);
    const row = db.prepare('SELECT symbol, type FROM student_performances').get() as { symbol: string; type: string };
    expect(row).toEqual({ symbol: 'PLUS', type: 'participation' });
    const assessment = db.prepare('SELECT title, category_id FROM assessments').get() as { title: string; category_id: string };
    expect(assessment).toEqual({ title: 'Mündlich', category_id: 'course-1:mitarbeit' });
  });

  it('adds the picked student to the sessions participants', async () => {
    await service.record(input('s-1', 'PLUS'));

    const rows = db.prepare('SELECT student_id FROM session_students').all() as { student_id: string }[];
    expect(rows.map((r) => r.student_id)).toEqual(['s-1']);
  });

  it('reuses the session and assessment for a second pick on the same day', async () => {
    await service.record(input('s-1', 'PLUS'));
    await service.record(input('s-2', 'MINUS'));

    expect(count('sessions')).toBe(1);
    expect(count('assessments')).toBe(1);
    expect(count('student_performances')).toBe(2);
    expect(count('session_students')).toBe(2);
  });

  it('uses a separate session for a different day', async () => {
    await service.record(input('s-1', 'PLUS', '2026-10-03'));
    await service.record(input('s-1', 'PLUS', '2026-10-04'));

    expect(count('sessions')).toBe(2);
  });

  it('replaces the symbol when the same student is picked again that day', async () => {
    await service.record(input('s-1', 'PLUS'));
    await service.record(input('s-1', 'MINUS'));

    expect(count('student_performances')).toBe(1);
    const row = db.prepare('SELECT symbol FROM student_performances').get() as { symbol: string };
    expect(row.symbol).toBe('MINUS');
  });

  it('returns the performance id so the entry can be undone without touching others', async () => {
    const first = await service.record(input('s-1', 'PLUS'));
    await service.record(input('s-2', 'WELLE'));
    if (!first.ok) throw first.error;

    await grading.deletePerformance(first.value.performanceId);

    const remaining = db.prepare('SELECT student_id FROM student_performances WHERE deleted_at IS NULL').all() as { student_id: string }[];
    expect(remaining.map((r) => r.student_id)).toEqual(['s-2']);
  });

  it.each([
    ['an unknown course', { ...input('s-1', 'PLUS'), courseId: 'nope' }],
    ['an unknown student', input('nope', 'PLUS')],
    ['an invalid symbol', input('s-1', 'GREAT')],
    ['an invalid date', input('s-1', 'PLUS', 'yesterday')],
  ])('fails for %s and creates nothing', async (_label, bad) => {
    const result = await service.record(bad);

    expect(result.ok).toBe(false);
    expect(count('sessions')).toBe(0);
    expect(count('student_performances')).toBe(0);
  });

  it('rejects a student who is not taught in the course and creates nothing', async () => {
    await rosterService.setIncluded('course-1', 's-1', false);

    const result = await service.record(input('s-1', 'PLUS'));

    expect(result.ok).toBe(false);
    expect(count('sessions')).toBe(0);
    expect(count('student_performances')).toBe(0);
  });

  it('fails with a readable error when the course has no Mitarbeit category', async () => {
    db.exec("DELETE FROM assessment_categories WHERE course_id = 'course-1'");

    const result = await service.record(input('s-1', 'PLUS'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Mitarbeit');
    expect(count('sessions')).toBe(0);
  });
});
