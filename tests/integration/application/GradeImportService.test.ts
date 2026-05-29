import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { GradeImportService } from '../../../src/application/GradeImportService';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { Course } from '../../../src/domain/grade/Course';
import { Student } from '../../../src/domain/student/Student';
import { StudentId } from '../../../src/domain/student/StudentId';
import { Name } from '../../../src/domain/student/Name';
import { AssessmentCategory } from '../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../src/domain/grade/GradingType';
import { Session } from '../../../src/domain/grade/Session';
import type { Db } from '../../../src/infrastructure/persistence/db';

function createDate(dd: number, mm: number, yy: number): Date {
  return new Date(2000 + yy, mm - 1, dd);
}

describe('GradeImportService', () => {
  let db: Db;
  let service: GradeImportService;
  let studentRepo: SqliteStudentRepository;
  let classRepo: SqliteSchoolClassRepository;
  let courseRepo: SqliteCourseRepository;
  let sessionRepo: SqliteSessionRepository;
  let assessmentRepo: SqliteAssessmentRepository;
  let perfRepo: SqliteGradeRepository;
  let course: Course;
  let catProjekt: AssessmentCategory;
  let catPLU: AssessmentCategory;
  let catMitarbeit: AssessmentCategory;

  beforeEach(async () => {
    db = createInMemoryDb();
    runMigrations(db);

    classRepo = new SqliteSchoolClassRepository(db);
    studentRepo = new SqliteStudentRepository(db);
    courseRepo = new SqliteCourseRepository(db);
    sessionRepo = new SqliteSessionRepository(db);
    assessmentRepo = new SqliteAssessmentRepository(db);
    perfRepo = new SqliteGradeRepository(db);

    service = new GradeImportService(
      sessionRepo, assessmentRepo, perfRepo, studentRepo, courseRepo,
    );

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    await classRepo.save(schoolClass);

    course = Course.create('course-1', 'POS', schoolClass);
    catProjekt = new AssessmentCategory('cat-projekt', 'Projekt', GradingType.NUMERIC, true);
    catPLU = new AssessmentCategory('cat-plue', 'PLÜ', GradingType.NUMERIC, true);
    catMitarbeit = new AssessmentCategory('cat-mitarbeit', 'Mitarbeit', GradingType.TERTIARY, false);
    course.addAssessmentCategory(catProjekt);
    course.addAssessmentCategory(catPLU);
    course.addAssessmentCategory(catMitarbeit);
    await courseRepo.save(course);

    const sid = StudentId.create('s-001');
    const name = Name.create('Elias', 'Bräuer');
    if (!sid.ok || !name.ok) throw new Error('setup failed');
    await studentRepo.save(Student.create(sid.value, name.value, schoolClass));
  });

  afterEach(() => {
    db.close();
  });

  it('creates session, assessment, and performance from a CSV row', async () => {
    const csv = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Bräuer;Elias;Projekt;Dom-Mod.;01.11.25;5;5';

    const result = await service.importCsv('course-1', csv);

    expect(result.sessionsCreated).toBe(1);
    expect(result.assessmentsCreated).toBe(1);
    expect(result.performancesCreated).toBe(1);
    expect(result.performancesUpdated).toBe(0);
    expect(result.warnings).toEqual([]);

    const sessions = await sessionRepo.findByCourse('course-1');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.date.getFullYear()).toBe(2025);
    expect(sessions[0]!.date.getMonth()).toBe(10);
    expect(sessions[0]!.date.getDate()).toBe(1);

    const sessionAssessments = sessions[0]!.assessments;
    const imported = sessionAssessments.find(a => a.title === 'Dom-Mod.');
    expect(imported).toBeDefined();
    if (imported) {
      expect(imported.category.title).toBe('Projekt');
    }

    const performances = await perfRepo.findPerformancesByAssessment(imported!.id);
    expect(performances).toHaveLength(1);
    expect(performances[0]!.score).toBe(5);
    expect(performances[0]!.student.id.value).toBe('s-001');
  });

  it('reuses existing session with same date', async () => {
    const existingSession = Session.create('session-1', createDate(1, 11, 25), 'existing', course);
    await sessionRepo.save(existingSession);

    const csv = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Bräuer;Elias;Projekt;Dom-Mod.;01.11.25;5;5';

    const result = await service.importCsv('course-1', csv);

    expect(result.sessionsCreated).toBe(0);
    expect(result.assessmentsCreated).toBe(1);
    expect(result.performancesCreated).toBe(1);
    expect(result.warnings).toEqual([]);

    const sessions = await sessionRepo.findByCourse('course-1');
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe('session-1');
    expect(sessions[0]!.notes).toBe('existing');
  });

  it('reuses existing assessment with same name in session', async () => {
    const session = Session.create('session-1', createDate(1, 11, 2025), '', course);
    await sessionRepo.save(session);

    const csv = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Bräuer;Elias;Projekt;Dom-Mod.;01.11.25;5;5';

    const result = await service.importCsv('course-1', csv);

    expect(result.assessmentsCreated).toBe(1);
    expect(result.performancesCreated).toBe(1);

    const csv2 = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Bräuer;Elias;Projekt;Dom-Mod.;01.11.25;5;4';

    const result2 = await service.importCsv('course-1', csv2);

    expect(result2.assessmentsCreated).toBe(0);
    expect(result2.performancesUpdated).toBe(1);
  });

  it('skips row when student is not found and adds warning', async () => {
    const csv = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Unknown;Student;Projekt;Test;01.11.25;10;8';

    const result = await service.importCsv('course-1', csv);
    expect(result.performancesCreated).toBe(0);
    expect(result.performancesUpdated).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Unknown');
  });

  it('skips row when category is not found and adds warning', async () => {
    const csv = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Bräuer;Elias;NonExistentCategory;Test;01.11.25;10;8';

    const result = await service.importCsv('course-1', csv);
    expect(result.performancesCreated).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('NonExistentCategory');
  });

  it('handles decimal scores with comma separator', async () => {
    const csv = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Bräuer;Elias;Projekt;PLÜ 2;01.11.25;100;82,68';

    const result = await service.importCsv('course-1', csv);
    expect(result.performancesCreated).toBe(1);
    expect(result.warnings).toEqual([]);

    const sessions = await sessionRepo.findByCourse('course-1');
    const performances = await perfRepo.findPerformancesByAssessment(
      sessions[0]!.assessments.find(a => a.title === 'PLÜ 2')!.id,
    );
    expect(performances[0]!.score).toBeCloseTo(82.68, 2);
  });

  it('creates participation performance for TERTIARY assessments', async () => {
    const csv = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Bräuer;Elias;Mitarbeit;Mitarbeit-1;25.02.26;;+';

    const result = await service.importCsv('course-1', csv);
    expect(result.performancesCreated).toBe(1);
    expect(result.warnings).toEqual([]);

    const sessions = await sessionRepo.findByCourse('course-1');
    const performances = await perfRepo.findPerformancesByAssessment(
      sessions[0]!.assessments.find(a => a.title === 'Mitarbeit-1')!.id,
    );
    expect(performances[0]!.score).toBeNull();
    expect(performances[0]).toHaveProperty('symbol');
  });

  it('imports multiple rows in one CSV', async () => {
    const csv = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Bräuer;Elias;Projekt;Dom-Mod.;01.11.25;5;5\n'
      + 'Bräuer;Elias;Projekt;1. PR;06.11.26;25;23\n'
      + 'Bräuer;Elias;PLÜ;PLÜ 1;03.12.26;71;65';

    const result = await service.importCsv('course-1', csv);
    expect(result.sessionsCreated).toBe(3);
    expect(result.assessmentsCreated).toBe(3);
    expect(result.performancesCreated).toBe(3);
    expect(result.warnings).toEqual([]);

    const sessions = await sessionRepo.findByCourse('course-1');
    expect(sessions).toHaveLength(3);
  });

  it('handles empty note value', async () => {
    const csv = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Bräuer;Elias;Projekt;EmptyTest;01.11.25;10;';

    const result = await service.importCsv('course-1', csv);
    expect(result.performancesCreated).toBe(1);
    expect(result.warnings).toEqual([]);

    const sessions = await sessionRepo.findByCourse('course-1');
    const performances = await perfRepo.findPerformancesByAssessment(
      sessions[0]!.assessments.find(a => a.title === 'EmptyTest')!.id,
    );
    expect(performances[0]!.score).toBe(0);
  });

  it('skips duplicate student names with warning', async () => {
    const sid2 = StudentId.create('s-002');
    const name2 = Name.create('Elias', 'Bräuer');
    if (!sid2.ok || !name2.ok) throw new Error('setup failed');
    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    await studentRepo.save(Student.create(sid2.value, name2.value, new SchoolClass('class-2', '1A', year.value)));

    const csv = 'Nachname;Vorname;Typ;Name;Datum;Max;Note\n'
      + 'Bräuer;Elias;Projekt;Test;01.11.25;10;8';

    const result = await service.importCsv('course-1', csv);
    expect(result.performancesCreated).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Bräuer');
  });
});
