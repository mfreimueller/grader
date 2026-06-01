import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteReportRepository } from '../../../src/infrastructure/persistence/SqliteReportRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { PdfReportGenerator } from '../../../src/infrastructure/pdf/PdfReportGenerator';
import { GradeCalculationService } from '../../../src/domain/grade/GradeCalculationService';
import { ReportService } from '../../../src/application/ReportService';
import { GradeCalculationAppService } from '../../../src/application/GradeCalculationAppService';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Course } from '../../../src/domain/grade/Course';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('ReportService', () => {
  let db: Db;
  let service: ReportService;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const gradeRepo = new SqliteGradeRepository(db);
    const sessionRepo = new SqliteSessionRepository(db);
    const reportRepo = new SqliteReportRepository(db);
    const gradeCalc = new GradeCalculationAppService(courseRepo, gradeRepo, sessionRepo, new GradeCalculationService());
    service = new ReportService(reportRepo, new PdfReportGenerator(), gradeCalc);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    classRepo.save(schoolClass);

    const course = Course.create('course-1', 'Mathematik', schoolClass);
    courseRepo.save(course);
  });

  afterEach(() => {
    db.close();
  });

  it('generates a reduced mode report', async () => {
    const result = await service.generate('course-1', 'reduced');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeInstanceOf(Buffer);
  });

  it('generates a full mode report', async () => {
    const result = await service.generate('course-1', 'full');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeInstanceOf(Buffer);
  });

  it('fails for nonexistent course', async () => {
    const result = await service.generate('nonexistent', 'full');
    expect(result.ok).toBe(false);
  });
});
