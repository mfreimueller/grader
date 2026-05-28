import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { GradingService } from '../../../src/application/GradingService';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Course } from '../../../src/domain/grade/Course';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { Name } from '../../../src/domain/student/Name';
import { Assessment } from '../../../src/domain/grade/Assessment';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('GradingService', () => {
  let db: Db;
  let service: GradingService;
  let courseId: string;
  let studentId: string;
  let assessmentId: string;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    const assessmentRepo = new SqliteAssessmentRepository(db);
    const gradeRepo = new SqliteGradeRepository(db);
    service = new GradingService(gradeRepo, courseRepo, gradeRepo, studentRepo, assessmentRepo);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    classRepo.save(schoolClass);

    const course = Course.create('course-1', 'Mathematik', schoolClass);
    courseRepo.save(course);
    courseId = 'course-1';

    const sid = StudentId.create('s-001');
    if (!sid.ok) throw sid.error;
    const name = Name.create('Max', 'Mustermann');
    if (!name.ok) throw name.error;
    const student = Student.create(sid.value, name.value, schoolClass);
    studentRepo.save(student);
    studentId = 's-001';

    const mitarbeit = course.assessmentCategories[0]!;
    const assessment = new Assessment('a-001', 'Mündlich', new Date('2025-10-01'), mitarbeit, course);
    assessmentRepo.save(assessment);
    assessmentId = 'a-001';
  });

  afterEach(() => {
    db.close();
  });

  it('records a participation performance', async () => {
    const result = await service.recordPerformance({
      studentId,
      assessmentId,
      symbol: 'PLUS',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('participation');
    expect(result.value.symbol).toBe('PLUS');
  });

  it('lists performances by assessment', async () => {
    await service.recordPerformance({ studentId, assessmentId, symbol: 'PLUS' });
    const list = await service.getPerformancesByAssessment(assessmentId);
    expect(list).toHaveLength(1);
  });

  it('saves a manual grade', async () => {
    const result = await service.saveManualGrade({
      studentId,
      courseId,
      score: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.score).toBe(2);
  });

  it('retrieves a manual grade', async () => {
    await service.saveManualGrade({ studentId, courseId, score: 2 });
    const grade = await service.getGrade(studentId, courseId);
    expect(grade.ok).toBe(true);
    if (!grade.ok) return;
    expect(grade.value!.score).toBe(2);
  });
});
