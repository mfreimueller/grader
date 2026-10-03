import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { GradeCalculationAppService } from '../../../src/application/GradeCalculationAppService';
import { GradeCalculationService } from '../../../src/domain/grade/GradeCalculationService';
import { CourseRosterService } from '../../../src/application/CourseRosterService';
import { McpService } from '../../../src/mcp/mcpService';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('McpService.getCourseSummary', () => {
  let db: Db;
  let mcp: McpService;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    const classRepo = new SqliteSchoolClassRepository(db);
    const studentRepo = new SqliteStudentRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const gradeRepo = new SqliteGradeRepository(db);
    const calc = new GradeCalculationAppService(courseRepo, gradeRepo, new SqliteSessionRepository(db), new GradeCalculationService());
    const roster = new CourseRosterService(courseRepo, studentRepo, new SqliteCourseRosterRepository(db));
    mcp = new McpService(studentRepo, classRepo, courseRepo, gradeRepo, gradeRepo, calc, roster);
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '4A', '2026/27');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Muster', 'class-1');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-2', 'Anna', 'Gruber', 'class-1');
      INSERT INTO courses (id, title, school_class_id) VALUES ('c-1', 'Mathematik', 'class-1');
      INSERT INTO assessment_categories (id, title, grading_type, course_id) VALUES ('cat-1', 'Mitarbeit', 'TERTIARY', 'c-1');
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('lists the whole class when nobody is excluded', async () => {
    const summary = await mcp.getCourseSummary('c-1');

    expect(Array.isArray(summary) && summary.map((e) => e.studentId).sort()).toEqual(['s-1', 's-2']);
  });

  it('lists only the students taught in the course', async () => {
    db.prepare("INSERT INTO course_excluded_students (course_id, student_id) VALUES ('c-1', 's-2')").run();

    const summary = await mcp.getCourseSummary('c-1');

    expect(Array.isArray(summary) && summary.map((e) => e.studentId)).toEqual(['s-1']);
  });
});
