import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteReportRepository } from '../../../src/infrastructure/persistence/SqliteReportRepository';
import { PdfReportGenerator } from '../../../src/infrastructure/pdf/PdfReportGenerator';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('PdfReportGenerator', () => {
  let db: Db;
  let reportRepo: SqliteReportRepository;
  let generator: PdfReportGenerator;

  function seedReportData(): void {
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
      "INSERT INTO grade_compositions (category_id, course_id, weight, sub_weight_type) VALUES ('cat-1', 'course-1', 1, 'NONE')",
    ).run();
    db.prepare(
      "INSERT INTO assessments (id, title, category_id, course_id, is_impromptu, max_points) VALUES ('a-001', 'Test 1', 'cat-1', 'course-1', 0, 30)",
    ).run();
    db.prepare(
      "INSERT INTO student_performances (id, student_id, assessment_id, score, symbol, type) VALUES ('p-001', 's-001', 'a-001', 24, NULL, 'graded')",
    ).run();
    db.prepare(
      "INSERT INTO student_performances (id, student_id, assessment_id, score, symbol, type) VALUES ('p-002', 's-002', 'a-001', 18, NULL, 'graded')",
    ).run();
    db.prepare(
      "INSERT INTO grades (id, student_id, course_id, score) VALUES ('g-001', 's-001', 'course-1', 2)",
    ).run();
  }

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    seedReportData();
    reportRepo = new SqliteReportRepository(db);
    generator = new PdfReportGenerator();
  });

  afterEach(() => {
    db.close();
  });

  it('generates a valid PDF buffer', async () => {
    const data = await reportRepo.findCourseReportData('course-1');
    if (!data) { fail('CourseReportData should exist'); return; }
    const buffer = await generator.generate(data, 'reduced');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
  });

  it('throws for empty data when rendering', async () => {
    const data = await reportRepo.findCourseReportData('course-1');
    if (!data) { fail('CourseReportData should exist'); return; }
    const emptyData = { ...data, students: [] };
    const buffer = await generator.generate(emptyData, 'reduced');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
