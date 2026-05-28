import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteReportRepository } from '../../../src/infrastructure/persistence/SqliteReportRepository';
import type { StudentReportEntry } from '../../../src/domain/report/CourseReportData';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteReportRepository', () => {
  let db: Db;
  let repo: SqliteReportRepository;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    db.prepare(
      "INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '1A', '2025/26')",
    ).run();
    db.prepare(
      "INSERT INTO courses (id, title, school_class_id) VALUES ('course-1', 'Mathematik', 'class-1')",
    ).run();
    db.prepare(
      "INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-001', 'Anna', 'Muster', 'class-1')",
    ).run();
    db.prepare(
      "INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-002', 'Max', 'Mustermann', 'class-1')",
    ).run();
    db.prepare(
      "INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id) VALUES ('cat-1', 'Schularbeit', 'NUMERIC', 1, 'course-1')",
    ).run();
    db.prepare(
      "INSERT INTO assessments (id, title, date, category_id, course_id, is_impromptu, max_points) VALUES ('a-001', 'Test 1', '2025-10-01', 'cat-1', 'course-1', 0, 30)",
    ).run();
    db.prepare(
      "INSERT INTO student_performances (id, date, student_id, assessment_id, score, symbol, type) VALUES ('p-001', '2025-10-01', 's-001', 'a-001', 24, NULL, 'graded')",
    ).run();
    db.prepare(
      "INSERT INTO grades (id, student_id, course_id, score) VALUES ('g-001', 's-001', 'course-1', 2)",
    ).run();

    repo = new SqliteReportRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns course report data for a course with students', async () => {
    const data = await repo.findCourseReportData('course-1');

    expect(data).not.toBeNull();
    expect(data!.courseId).toBe('course-1');
    expect(data!.courseTitle).toBe('Mathematik');
    expect(data!.schoolYearLabel).toBe('2025/26');
  });

  it('returns students sorted alphabetically by last then first name', async () => {
    const data = await repo.findCourseReportData('course-1');
    expect(data!.students).toHaveLength(2);
    expect(data!.students[0]!.lastName).toBe('Muster');
    expect(data!.students[0]!.firstName).toBe('Anna');
    expect(data!.students[1]!.lastName).toBe('Mustermann');
  });

  it('includes manual grade for each student', async () => {
    const data = await repo.findCourseReportData('course-1');
    const anna = data!.students.find((s: StudentReportEntry) => s.firstName === 'Anna');
    expect(anna!.manualGrade).toBe(2);

    const max = data!.students.find((s: StudentReportEntry) => s.firstName === 'Max');
    expect(max!.manualGrade).toBeNull();
  });

  it('includes performances for each student', async () => {
    const data = await repo.findCourseReportData('course-1');
    const anna = data!.students.find((s: StudentReportEntry) => s.firstName === 'Anna');
    expect(anna!.performances).toHaveLength(1);
    expect(anna!.performances[0]!.assessmentTitle).toBe('Test 1');
    expect(anna!.performances[0]!.rawScore).toBe(24);
    expect(anna!.performances[0]!.maxPoints).toBe(30);
  });

  it('returns null for non-existent course', async () => {
    const data = await repo.findCourseReportData('nonexistent');
    expect(data).toBeNull();
  });
});
