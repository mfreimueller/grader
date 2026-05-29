import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { AssessmentService } from '../../../src/application/AssessmentService';
import { GradingService } from '../../../src/application/GradingService';
import { ImpromptuAssessmentService } from '../../../src/application/ImpromptuAssessmentService';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Course } from '../../../src/domain/grade/Course';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { Name } from '../../../src/domain/student/Name';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('ImpromptuAssessmentService', () => {
  let db: Db;
  let service: ImpromptuAssessmentService;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    const assessmentRepo = new SqliteAssessmentRepository(db);
    const sessionRepo = new SqliteSessionRepository(db);
    const gradeRepo = new SqliteGradeRepository(db);

    const assessmentService = new AssessmentService(assessmentRepo, sessionRepo, courseRepo);
    const gradingService = new GradingService(gradeRepo, courseRepo, gradeRepo, studentRepo, assessmentRepo, sessionRepo);
    service = new ImpromptuAssessmentService(assessmentService, gradingService);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    classRepo.save(schoolClass);

    const course = Course.create('course-1', 'Mathematik', schoolClass);
    courseRepo.save(course);

    const sid = StudentId.create('s-001');
    if (!sid.ok) throw sid.error;
    const name = Name.create('Max', 'Mustermann');
    if (!name.ok) throw name.error;
    const student = Student.create(sid.value, name.value, schoolClass);
    studentRepo.save(student);

    db.prepare(
      "INSERT INTO sessions (id, date, notes, course_id) VALUES ('session-1', '2025-10-01', '', 'course-1')",
    ).run();
  });

  afterEach(() => {
    db.close();
  });

  it('creates an impromptu assessment with performance', async () => {
    const courseRepo = new SqliteCourseRepository(db);
    const course = await courseRepo.findById('course-1');
    const mitarbeitId = course!.assessmentCategories[0]!.id;

    const result = await service.create({
      courseId: 'course-1',
      studentId: 's-001',
      categoryId: mitarbeitId,
      sessionId: 'session-1',
      symbol: 'PLUS',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.assessmentId).toBeDefined();
    expect(result.value.performance.type).toBe('participation');
  });

  it('creates an impromptu assessment with score and maxPoints', async () => {
    const courseRepo = new SqliteCourseRepository(db);
    const course = await courseRepo.findById('course-1');
    const mitarbeitId = course!.assessmentCategories[0]!.id;

    const result = await service.create({
      courseId: 'course-1',
      studentId: 's-001',
      categoryId: mitarbeitId,
      sessionId: 'session-1',
      score: 85,
      maxPoints: 100,
    });
    expect(result.ok).toBe(true);
  });
});
