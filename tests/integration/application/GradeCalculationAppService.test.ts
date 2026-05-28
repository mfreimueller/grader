import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { GradeCalculationAppService } from '../../../src/application/GradeCalculationAppService';
import { GradeCalculationService } from '../../../src/domain/grade/GradeCalculationService';
import { GradeComposition } from '../../../src/domain/grade/GradeComposition';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Course } from '../../../src/domain/grade/Course';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { Name } from '../../../src/domain/student/Name';
import { Assessment } from '../../../src/domain/grade/Assessment';
import { ParticipationPerformance } from '../../../src/domain/grade/ParticipationPerformance';
import { ParticipationSymbol } from '../../../src/domain/grade/ParticipationSymbol';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('GradeCalculationAppService', () => {
  let db: Db;
  let service: GradeCalculationAppService;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    const assessmentRepo = new SqliteAssessmentRepository(db);
    const gradeRepo = new SqliteGradeRepository(db);
    service = new GradeCalculationAppService(courseRepo, gradeRepo, new GradeCalculationService());

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    classRepo.save(schoolClass);

    const course = Course.create('course-1', 'Mathematik', schoolClass);
    const mitarbeit = course.assessmentCategories[0]!;
    const composition = GradeComposition.create(mitarbeit, 50);
    if (!composition.ok) throw composition.error;
    const reconstituted = Course.reconstitute('course-1', 'Mathematik', schoolClass, [mitarbeit], [composition.value]);
    courseRepo.save(reconstituted);

    const sid = StudentId.create('s-001');
    if (!sid.ok) throw sid.error;
    const name = Name.create('Max', 'Mustermann');
    if (!name.ok) throw name.error;
    const student = Student.create(sid.value, name.value, schoolClass);
    studentRepo.save(student);

    const assessment = new Assessment('a-001', 'Mündlich', new Date('2025-10-01'), mitarbeit, reconstituted);
    assessmentRepo.save(assessment);

    const symbol = ParticipationSymbol.create('PLUS');
    if (!symbol.ok) throw symbol.error;
    const perf = ParticipationPerformance.create('p-001', new Date('2025-10-01'), student, assessment, symbol.value);
    if (!perf.ok) throw perf.error;
    gradeRepo.savePerformance(perf.value);
  });

  afterEach(() => {
    db.close();
  });

  it('calculates a grade', async () => {
    const result = await service.calculate('course-1', 's-001');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayGrade).toBeGreaterThanOrEqual(1);
    expect(result.value.displayGrade).toBeLessThanOrEqual(5);
  });

  it('fails for nonexistent course', async () => {
    const result = await service.calculate('nonexistent', 's-001');
    expect(result.ok).toBe(false);
  });

  it('returns grade 5 for student with no performances', async () => {
    const result = await service.calculate('course-1', 'bad-id');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayGrade).toBe(5);
  });
});
