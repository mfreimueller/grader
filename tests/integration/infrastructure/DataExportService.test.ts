import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteReportRepository } from '../../../src/infrastructure/persistence/SqliteReportRepository';
import { DataExportService } from '../../../src/infrastructure/fs/DataExportService';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('DataExportService', () => {
  let db: Db;
  let reportRepo: SqliteReportRepository;
  let exporter: DataExportService;

  function seedData(): void {
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
      "INSERT INTO sessions (id, date, course_id) VALUES ('ses-1', '2025-10-01', 'course-1')",
    ).run();
    db.prepare(
      "INSERT INTO assessments (id, title, category_id, course_id, session_id, is_impromptu, max_points) VALUES ('a-001', 'Test 1', 'cat-1', 'course-1', 'ses-1', 0, 30)",
    ).run();
    db.prepare(
      "INSERT INTO student_performances (id, student_id, assessment_id, score, symbol, type) VALUES ('p-001', 's-001', 'a-001', 24, NULL, 'graded')",
    ).run();
    db.prepare(
      "INSERT INTO grades (id, student_id, course_id, score) VALUES ('g-001', 's-001', 'course-1', 2)",
    ).run();
  }

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    seedData();
    reportRepo = new SqliteReportRepository(db);
    exporter = new DataExportService(reportRepo);
  });

  afterEach(() => {
    db.close();
  });

  it('exports course report as CSV', async () => {
    const csv = await exporter.exportCourseReportCsv('course-1');
    expect(csv).toContain('Nachname;Vorname;Note');
    expect(csv).toContain('Muster;Anna;2');
    expect(csv).toContain('Mustermann;Max;');
  });

  it('includes performance columns in the CSV', async () => {
    const csv = await exporter.exportCourseReportCsv('course-1');
    expect(csv).toContain('Test 1');
    expect(csv).toContain('Schularbeit');
    expect(csv).toContain('24/30');
  });

  it('uses semicolon as delimiter', async () => {
    const csv = await exporter.exportCourseReportCsv('course-1');
    const lines = csv.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[1]!.split(';').length).toBe(4);
  });

  it('throws for a non-existent course', async () => {
    await expect(
      exporter.exportCourseReportCsv('nonexistent'),
    ).rejects.toThrow('Course nonexistent not found');
  });
});
