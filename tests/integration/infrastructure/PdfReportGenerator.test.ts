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
      "INSERT INTO assessments (id, title, date, category_id, course_id, is_impromptu, max_points) VALUES ('a-001', 'Test 1', '2025-10-01', 'cat-1', 'course-1', 0, 30)",
    ).run();
    db.prepare(
      "INSERT INTO student_performances (id, date, student_id, assessment_id, score, symbol, type) VALUES ('p-001', '2025-10-01', 's-001', 'a-001', 24, NULL, 'graded')",
    ).run();
    db.prepare(
      "INSERT INTO student_performances (id, date, student_id, assessment_id, score, symbol, type) VALUES ('p-002', '2025-10-01', 's-002', 'a-001', 18, NULL, 'graded')",
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
    generator = new PdfReportGenerator(reportRepo);
  });

  afterEach(() => {
    db.close();
  });

  it('generates a valid PDF buffer', async () => {
    const buffer = await generator.generateCourseReport('course-1');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
  });

  it('throws for a non-existent course', async () => {
    await expect(
      generator.generateCourseReport('nonexistent'),
    ).rejects.toThrow('Course nonexistent not found');
  });
});
