import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteStudentRepository } from '../../../src/infrastructure/persistence/SqliteStudentRepository';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/SqliteSessionRepository';
import { SqliteGradeRepository } from '../../../src/infrastructure/persistence/SqliteGradeRepository';
import { SqliteFindingRepository } from '../../../src/infrastructure/persistence/SqliteFindingRepository';
import { SqliteStudentPickCountRepository } from '../../../src/infrastructure/persistence/SqliteStudentPickCountRepository';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { SqliteUnitOfWork } from '../../../src/infrastructure/persistence/SqliteUnitOfWork';
import { DigigradeImportService } from '../../../src/application/DigigradeImportService';
import type { DigigradeExport } from '../../../src/application/DigigradeExport';
import { rejectionMessage } from '../../helpers/rejection';
import type { Db } from '../../../src/infrastructure/persistence/db';

const fixture = (): DigigradeExport =>
  JSON.parse(readFileSync(join(__dirname, '../../fixtures/digigrade-export.json'), 'utf-8')) as DigigradeExport;

describe('DigigradeImportService', () => {
  let db: Db;
  let service: DigigradeImportService;

  const count = (table: string, where = '1=1'): number =>
    (db.prepare(`SELECT COUNT(*) AS cnt FROM ${table} WHERE ${where}`).get() as { cnt: number }).cnt;

  const snapshot = (): number[] =>
    ['school_classes', 'students', 'courses', 'sessions', 'assessments', 'student_performances', 'findings', 'grades', 'course_student_picks']
      .map((t) => count(t));

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    const gradeRepo = new SqliteGradeRepository(db);
    service = new DigigradeImportService(
      new SqliteSchoolClassRepository(db),
      new SqliteStudentRepository(db),
      new SqliteCourseRepository(db),
      new SqliteSessionRepository(db),
      gradeRepo,
      new SqliteFindingRepository(db),
      gradeRepo,
      new SqliteStudentPickCountRepository(db),
      new SqliteCourseRosterRepository(db),
      new SqliteUnitOfWork(db),
    );
  });

  afterEach(() => {
    db.close();
  });

  describe('fresh import', () => {
    it('creates classes, students and the course and reports the counts', async () => {
      const result = await service.import(fixture());

      expect(result.classes).toEqual({ created: 2, skipped: 0 });
      expect(result.students).toEqual({ created: 4, skipped: 0 });
      expect(result.courses).toEqual({ created: 1, skipped: 0 });
      expect(result.sessionsCreated).toBe(1);
      expect(result.performancesCreated).toBe(2);
    });

    it('stores classes with their school year and students with a normalised color', async () => {
      await service.import(fixture());

      const classes = db.prepare('SELECT name, school_year FROM school_classes ORDER BY name').all();
      expect(classes).toEqual([
        { name: '1A', school_year: '2026/27' },
        { name: '4EHIF', school_year: '2026/27' },
      ]);
      const max = db.prepare("SELECT color FROM students WHERE last_name = 'Muster'").get() as { color: string };
      const zoe = db.prepare("SELECT color FROM students WHERE last_name = 'Zimmer'").get() as { color: string | null };
      expect(max.color).toBe('#ed1943');
      expect(zoe.color).toBeNull();
    });

    it('creates the course with its categories and rounded compositions', async () => {
      const result = await service.import(fixture());

      const course = db.prepare("SELECT id, title FROM courses").get() as { id: string; title: string };
      expect(course.title).toBe('Mathematik');
      const categories = db
        .prepare('SELECT title, grading_type, display_as_grade, is_hidden FROM assessment_categories ORDER BY title')
        .all();
      expect(categories).toEqual([
        { title: 'Mitarbeit', grading_type: 'TERTIARY', display_as_grade: 0, is_hidden: 1 },
        { title: 'Schularbeit', grading_type: 'NUMERIC', display_as_grade: 1, is_hidden: 0 },
      ]);
      const compositions = db
        .prepare(
          `SELECT c.title, g.weight, g.sub_weight_type FROM grade_compositions g
           JOIN assessment_categories c ON c.id = g.category_id ORDER BY c.title`,
        )
        .all();
      expect(compositions).toEqual([
        { title: 'Mitarbeit', weight: 40, sub_weight_type: 'NONE' },
        { title: 'Schularbeit', weight: 61, sub_weight_type: 'CHRONOLOGICAL' },
      ]);
      expect(result.warnings.filter((w) => w.includes('gerundet'))).toHaveLength(2);
    });

    it('lets the sessions participants be the class students minus the excluded ones', async () => {
      await service.import(fixture());

      const rows = db
        .prepare(
          `SELECT s.last_name FROM session_students ss JOIN students s ON s.id = ss.student_id ORDER BY s.last_name`,
        )
        .all() as { last_name: string }[];
      expect(rows.map((r) => r.last_name)).toEqual(['Gruber', 'Muster']);
    });

    it('stores the excluded students as the roster of the imported course', async () => {
      await service.import(fixture());

      const excluded = db
        .prepare(
          `SELECT s.last_name FROM course_excluded_students e JOIN students s ON s.id = e.student_id`,
        )
        .all() as { last_name: string }[];
      expect(excluded.map((e) => e.last_name)).toEqual(['Zimmer']);
    });

    it('imports assessments, performances, notes, links, grades and pick counts', async () => {
      await service.import(fixture());

      const assessments = db.prepare('SELECT title, max_points, is_impromptu FROM assessments ORDER BY title').all();
      expect(assessments).toEqual([
        { title: 'Mündlich', max_points: null, is_impromptu: 0 },
        { title: 'Test 1', max_points: 30, is_impromptu: 0 },
      ]);
      const performances = db
        .prepare(
          `SELECT s.last_name, p.score, p.symbol, p.type FROM student_performances p
           JOIN students s ON s.id = p.student_id ORDER BY s.last_name`,
        )
        .all();
      expect(performances).toEqual([
        { last_name: 'Gruber', score: null, symbol: 'PLUS', type: 'participation' },
        { last_name: 'Muster', score: 24, symbol: null, type: 'graded' },
      ]);
      const findings = db.prepare('SELECT type, text_content, url FROM findings ORDER BY type').all();
      expect(findings).toEqual([
        { type: 'note', text_content: 'Gut gemacht', url: null },
        { type: 'remote_document', text_content: null, url: 'https://example.org/a' },
      ]);
      expect(db.prepare('SELECT score FROM grades').all()).toEqual([{ score: 2 }]);
      const picks = db
        .prepare(
          `SELECT s.last_name, p.pick_count FROM course_student_picks p
           JOIN students s ON s.id = p.student_id ORDER BY s.last_name`,
        )
        .all();
      expect(picks).toEqual([
        { last_name: 'Gruber', pick_count: 1 },
        { last_name: 'Muster', pick_count: 3 },
      ]);
    });
  });

  describe('re-import', () => {
    it('is a no-op the second time and reports everything as skipped', async () => {
      await service.import(fixture());
      const before = snapshot();

      const again = await service.import(fixture());

      expect(snapshot()).toEqual(before);
      expect(again.classes).toEqual({ created: 0, skipped: 2 });
      expect(again.students).toEqual({ created: 0, skipped: 4 });
      expect(again.courses).toEqual({ created: 0, skipped: 1 });
      expect(again.sessionsCreated).toBe(0);
      expect(again.performancesCreated).toBe(0);
    });
  });

  describe('merging into existing data', () => {
    it('reuses an existing class and student without overwriting them', async () => {
      db.exec(`
        INSERT INTO school_classes (id, name, school_year) VALUES ('mine', '4EHIF', '2026/27');
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('max-mine', 'Max', 'Muster', 'mine');
      `);

      const result = await service.import(fixture());

      expect(result.classes).toEqual({ created: 1, skipped: 1 });
      expect(result.students).toEqual({ created: 3, skipped: 1 });
      expect(count('students', "last_name = 'Muster'")).toBe(1);
      const max = db.prepare("SELECT color FROM students WHERE id = 'max-mine'").get() as { color: string | null };
      expect(max.color).toBeNull();
      const performance = db.prepare("SELECT student_id FROM student_performances WHERE score = 24").get() as { student_id: string };
      expect(performance.student_id).toBe('max-mine');
    });

    it('skips a course that already exists entirely, including its sessions and pick counts', async () => {
      db.exec(`
        INSERT INTO school_classes (id, name, school_year) VALUES ('mine', '4EHIF', '2026/27');
        INSERT INTO courses (id, title, school_class_id) VALUES ('course-mine', 'Mathematik', 'mine');
      `);

      const result = await service.import(fixture());

      expect(result.courses).toEqual({ created: 0, skipped: 1 });
      expect(count('courses')).toBe(1);
      expect(count('sessions')).toBe(0);
      expect(count('course_student_picks')).toBe(0);
      expect(count('grades')).toBe(0);
    });
  });

  describe('problems in the data', () => {
    it('skips a composition whose rounded weight is not allowed and warns', async () => {
      const doc = fixture();
      doc.courses[0]!.compositions[0]!.weight = 0.2;

      const result = await service.import(doc);

      expect(count('grade_compositions')).toBe(1);
      expect(result.warnings.some((w) => w.includes('Gewichtung'))).toBe(true);
    });

    it('skips a graded performance above the maximum points and warns', async () => {
      const doc = fixture();
      doc.courses[0]!.sessions[0]!.assessments[0]!.performances[0]!.score = 31;

      const result = await service.import(doc);

      expect(result.performancesCreated).toBe(1);
      expect(result.warnings.some((w) => w.includes('Test 1'))).toBe(true);
    });

    it('skips a performance of an unknown student and warns', async () => {
      const doc = fixture();
      doc.courses[0]!.sessions[0]!.assessments[1]!.performances[0]!.studentId = 'nobody';

      const result = await service.import(doc);

      expect(result.performancesCreated).toBe(1);
      expect(result.warnings.some((w) => w.includes('nobody'))).toBe(true);
    });

    it('skips a student whose class is missing and warns', async () => {
      const doc = fixture();
      doc.students[0]!.classId = 'unknown-class';

      const result = await service.import(doc);

      expect(result.students.created).toBe(3);
      expect(result.warnings.some((w) => w.includes('Muster'))).toBe(true);
    });

    it('skips an invalid manual grade and warns', async () => {
      const doc = fixture();
      doc.courses[0]!.grades[0]!.score = 7;

      const result = await service.import(doc);

      expect(count('grades')).toBe(0);
      expect(result.warnings.some((w) => w.includes('Note'))).toBe(true);
    });

    it('skips a course whose class is missing and warns', async () => {
      const doc = fixture();
      doc.courses[0]!.classId = 'unknown-class';

      const result = await service.import(doc);

      expect(result.courses).toEqual({ created: 0, skipped: 1 });
      expect(result.warnings.some((w) => w.includes('Mathematik'))).toBe(true);
    });

    it('skips a class with an invalid school year and the students that belong to it', async () => {
      const doc = fixture();
      doc.classes[1]!.schoolYear = 'next year';

      const result = await service.import(doc);

      expect(result.classes.created).toBe(1);
      expect(result.students.created).toBe(3);
      expect(result.warnings.some((w) => w.includes('1A'))).toBe(true);
    });

    it('skips a student without a usable name', async () => {
      const doc = fixture();
      doc.students[0]!.firstName = '   ';

      const result = await service.import(doc);

      expect(result.students.created).toBe(3);
      expect(result.warnings.some((w) => w.includes('Muster'))).toBe(true);
    });

    it('imports a student without color when the color is invalid and warns', async () => {
      const doc = fixture();
      doc.students[0]!.color = 'red';

      const result = await service.import(doc);

      expect(result.students.created).toBe(4);
      const max = db.prepare("SELECT color FROM students WHERE last_name = 'Muster'").get() as { color: string | null };
      expect(max.color).toBeNull();
      expect(result.warnings.some((w) => w.includes('Farbe'))).toBe(true);
    });

    it('skips a category with an unknown grading type together with its assessments', async () => {
      const doc = fixture();
      doc.courses[0]!.categories[0]!.gradingType = 'SOMETHING';

      const result = await service.import(doc);

      expect(count('assessment_categories')).toBe(1);
      expect(result.performancesCreated).toBe(1);
      expect(result.warnings.some((w) => w.includes('Mitarbeit'))).toBe(true);
    });

    it('skips a session with an invalid date', async () => {
      const doc = fixture();
      doc.courses[0]!.sessions[0]!.date = 'yesterday';

      const result = await service.import(doc);

      expect(result.sessionsCreated).toBe(0);
      expect(count('sessions')).toBe(0);
      expect(result.warnings.some((w) => w.includes('yesterday'))).toBe(true);
    });

    it('skips a graded assessment with zero maximum points', async () => {
      const doc = fixture();
      doc.courses[0]!.sessions[0]!.assessments[0]!.maxPoints = 0;

      const result = await service.import(doc);

      expect(count('assessments')).toBe(1);
      expect(result.warnings.some((w) => w.includes('Test 1'))).toBe(true);
    });

    it('skips a participation with an unknown symbol', async () => {
      const doc = fixture();
      doc.courses[0]!.sessions[0]!.assessments[1]!.performances[0]!.symbol = 'GREAT';

      const result = await service.import(doc);

      expect(result.performancesCreated).toBe(1);
      expect(result.warnings.some((w) => w.includes('Mündlich'))).toBe(true);
    });

    it('skips a negative pick count and warns', async () => {
      const doc = fixture();
      doc.courses[0]!.pickCounts[0]!.pickCount = -1;

      const result = await service.import(doc);

      expect(count('course_student_picks')).toBe(1);
      expect(result.warnings.some((w) => w.includes('Aufrufzähler'))).toBe(true);
    });

    it('skips an assessment whose category was not exported', async () => {
      const doc = fixture();
      doc.courses[0]!.sessions[0]!.assessments[1]!.categoryId = 'unknown';

      const result = await service.import(doc);

      expect(count('assessments')).toBe(1);
      expect(result.warnings.some((w) => w.includes('Kategorie nicht vorhanden'))).toBe(true);
    });

    it('ignores findings of unknown type such as documents', async () => {
      const doc = fixture();
      doc.courses[0]!.sessions[0]!.assessments[0]!.performances[0]!.findings.push(
        { type: 'DOCUMENT', text: null, url: null },
      );

      await service.import(doc);

      expect(count('findings')).toBe(2);
    });
  });

  describe('atomicity', () => {
    it('rolls back everything when a write fails midway', async () => {
      db.exec(`CREATE TRIGGER fail_perf BEFORE INSERT ON student_performances
               BEGIN SELECT RAISE(ABORT, 'boom'); END;`);

      expect(await rejectionMessage(service.import(fixture()))).toContain('boom');

      expect(snapshot()).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });
  });
});
