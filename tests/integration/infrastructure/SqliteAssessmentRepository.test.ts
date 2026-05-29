import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteAssessmentRepository } from '../../../src/infrastructure/persistence/SqliteAssessmentRepository';
import { Assessment } from '../../../src/domain/grade/Assessment';
import { GradedAssessment } from '../../../src/domain/grade/GradedAssessment';
import { AssessmentCategory } from '../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../src/domain/grade/GradingType';
import { Course } from '../../../src/domain/grade/Course';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteAssessmentRepository', () => {
  let db: Db;
  let repo: SqliteAssessmentRepository;
  let course: Course;
  let category: AssessmentCategory;

  function seedSession(): void {
    db.prepare(
      "INSERT INTO sessions (id, date, notes, course_id) VALUES ('session-1', '2025-10-01', '', 'course-1')",
    ).run();
  }

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteAssessmentRepository(db);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw new Error('SchoolYear creation failed');
    const schoolClass = new SchoolClass('class-1', '1A', year.value);

    db.prepare(
      "INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '1A', '2025/26')",
    ).run();

    course = Course.create('course-1', 'Mathematik', schoolClass);

    db.prepare(
      "INSERT INTO courses (id, title, school_class_id) VALUES ('course-1', 'Mathematik', 'class-1')",
    ).run();
    db.prepare(
      "INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id) VALUES ('cat-1', 'Schularbeit', 'NUMERIC', 1, 'course-1')",
    ).run();
    db.prepare(
      "INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id) VALUES ('cat-2', 'Mitarbeit', 'TERTIARY', 0, 'course-1')",
    ).run();

    category = new AssessmentCategory('cat-1', 'Schularbeit', GradingType.NUMERIC, true);
  });

  afterEach(() => {
    db.close();
  });

  describe('save and findById', () => {
    it('persists a plain assessment and retrieves it', async () => {
      seedSession();
      const assessment = new Assessment(
        'a-001', 'Mündlich', category, course, 'session-1',
      );
      await repo.save(assessment);

      const found = await repo.findById('a-001');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('a-001');
      expect(found!.title).toBe('Mündlich');
      expect(found!.category.id).toBe('cat-1');
    });

    it('persists a GradedAssessment with maxPoints and retrieves it', async () => {
      seedSession();
      const result = GradedAssessment.create(
        'a-002', 'Test', category, course, 'session-1', 30,
      );
      if (!result.ok) throw new Error('GradedAssessment creation failed');
      await repo.save(result.value);

      const found = await repo.findById('a-002');
      expect(found).not.toBeNull();
      expect(found).toBeInstanceOf(GradedAssessment);
      expect((found as GradedAssessment).maxPoints).toBe(30);
    });

    it('returns null for non-existent id', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });

    it('updates an existing assessment', async () => {
      seedSession();
      const assessment = new Assessment(
        'a-001', 'Mündlich', category, course, 'session-1',
      );
      await repo.save(assessment);

      const updated = new Assessment(
        'a-001', 'Mündlich (2)', category, course, 'session-1',
      );
      await repo.save(updated);

      const found = await repo.findById('a-001');
      expect(found!.title).toBe('Mündlich (2)');
    });
  });

  describe('findBySession', () => {
    it('returns assessments linked to a session', async () => {
      seedSession();
      const assessment = new Assessment(
        'a-001', 'Mündlich', category, course, 'session-1',
      );
      await repo.save(assessment);

      const found = await repo.findBySession('session-1');
      expect(found).toHaveLength(1);
      expect(found[0]!.id).toBe('a-001');
    });

    it('returns empty array for session with no assessments', async () => {
      const found = await repo.findBySession('empty-session');
      expect(found).toEqual([]);
    });
  });

  describe('delete', () => {
    it('removes an assessment', async () => {
      seedSession();
      const assessment = new Assessment(
        'a-001', 'Mündlich', category, course, 'session-1',
      );
      await repo.save(assessment);

      await repo.delete('a-001');
      const found = await repo.findById('a-001');
      expect(found).toBeNull();
    });
  });

  describe('isImpromptu flag', () => {
    it('persists and loads the isImpromptu flag', async () => {
      seedSession();
      const assessment = new Assessment(
        'a-001', 'Spontan', category, course, 'session-1', true,
      );
      await repo.save(assessment);

      const found = await repo.findById('a-001');
      expect(found!.isImpromptu).toBe(true);
    });
  });

  describe('course reference', () => {
    it('persists and loads the course reference', async () => {
      seedSession();
      const assessment = new Assessment(
        'a-001', 'Mündlich', category, course, 'session-1',
      );
      await repo.save(assessment);

      const found = await repo.findById('a-001');
      expect(found!.course.id).toBe('course-1');
    });
  });
});
