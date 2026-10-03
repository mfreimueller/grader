import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { Course } from '../../../src/domain/grade/Course';
import { AssessmentCategory } from '../../../src/domain/grade/AssessmentCategory';
import { GradeComposition } from '../../../src/domain/grade/GradeComposition';
import { GradingType } from '../../../src/domain/grade/GradingType';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteCourseRepository', () => {
  let db: Db;
  let repo: SqliteCourseRepository;
  let schoolClass: SchoolClass;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqliteCourseRepository(db);

    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw new Error('SchoolYear creation failed');
    schoolClass = new SchoolClass('class-1', '1A', year.value);

    db.prepare(
      "INSERT INTO school_classes (id, name, school_year) VALUES ('class-1', '1A', '2025/26')",
    ).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('save and findById', () => {
    it('persists a course and retrieves it by id', async () => {
      const course = Course.create('course-1', 'Mathematik', schoolClass);
      await repo.save(course);

      const found = await repo.findById('course-1');

      expect(found).not.toBeNull();
      expect(found!.id).toBe('course-1');
      expect(found!.title).toBe('Mathematik');
      expect(found!.schoolClass.id).toBe('class-1');
    });

    it('returns null for non-existent id', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });

    it('updates an existing course on save', async () => {
      const course = Course.create('course-1', 'Mathematik', schoolClass);
      await repo.save(course);

      const updatedCourse = Course.reconstitute(
        'course-1',
        'Physik',
        schoolClass,
        [],
        [],
      );
      await repo.save(updatedCourse);

      const found = await repo.findById('course-1');
      expect(found!.title).toBe('Physik');
    });
  });

  describe('findAll', () => {
    it('returns all courses', async () => {
      await repo.save(Course.create('course-1', 'Mathematik', schoolClass));
      await repo.save(Course.create('course-2', 'Physik', schoolClass));

      const all = await repo.findAll();
      expect(all).toHaveLength(2);
    });

    it('returns empty array when no courses exist', async () => {
      const all = await repo.findAll();
      expect(all).toEqual([]);
    });
  });

  describe('findBySchoolYear', () => {
    it('filters courses by school year', async () => {
      const year2 = SchoolYear.create('2024/25');
      if (!year2.ok) throw new Error('SchoolYear creation failed');
      const class2 = new SchoolClass('class-2', '2A', year2.value);
      db.prepare(
        "INSERT INTO school_classes (id, name, school_year) VALUES ('class-2', '2A', '2024/25')",
      ).run();

      await repo.save(Course.create('course-1', 'Mathematik', schoolClass));
      await repo.save(Course.create('course-2', 'Physik', class2));

      const yearFilter = SchoolYear.create('2025/26');
      if (!yearFilter.ok) throw new Error('SchoolYear creation failed');
      const found = await repo.findBySchoolYear(yearFilter.value);

      expect(found).toHaveLength(1);
      expect(found[0]!.title).toBe('Mathematik');
    });
  });

  describe('delete', () => {
    it('removes a course', async () => {
      await repo.save(Course.create('course-1', 'Mathematik', schoolClass));
      await repo.delete('course-1');
      const found = await repo.findById('course-1');
      expect(found).toBeNull();
    });
  });

  describe('soft delete', () => {
    it('hides a soft-deleted course from findById, findAll and findBySchoolYear', async () => {
      await repo.save(Course.create('course-1', 'Mathematik', schoolClass));

      await repo.softDelete('course-1', '2026-10-03T10:00:00.000Z');

      const year = SchoolYear.create('2025/26');
      if (!year.ok) throw new Error('SchoolYear creation failed');
      expect(await repo.findById('course-1')).toBeNull();
      expect(await repo.findAll()).toHaveLength(0);
      expect(await repo.findBySchoolYear(year.value)).toHaveLength(0);
    });

    it('hides courses whose class is soft-deleted', async () => {
      await repo.save(Course.create('course-1', 'Mathematik', schoolClass));
      db.prepare("UPDATE school_classes SET deleted_at = datetime('now') WHERE id = 'class-1'").run();

      expect(await repo.findById('course-1')).toBeNull();
      expect(await repo.findAll()).toHaveLength(0);
    });

    it('lists soft-deleted courses with class info and deletion timestamp', async () => {
      await repo.save(Course.create('course-1', 'Mathematik', schoolClass));
      await repo.softDelete('course-1', '2026-10-03T10:00:00.000Z');

      const deleted = await repo.findDeleted();

      expect(deleted).toEqual([
        {
          id: 'course-1',
          title: 'Mathematik',
          className: '1A',
          schoolYear: '2025/26',
          deletedAt: '2026-10-03T10:00:00.000Z',
        },
      ]);
    });

    it('restores a soft-deleted course', async () => {
      await repo.save(Course.create('course-1', 'Mathematik', schoolClass));
      await repo.softDelete('course-1', '2026-10-03T10:00:00.000Z');

      await repo.restore('course-1');

      expect(await repo.findById('course-1')).not.toBeNull();
      expect(await repo.findDeleted()).toHaveLength(0);
    });

    it('permanently removes a course with its sessions, assessments, performances and grades', async () => {
      await repo.save(Course.create('course-1', 'Mathematik', schoolClass));
      db.exec(`
        INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Muster', 'class-1');
        INSERT INTO sessions (id, date, course_id) VALUES ('sess-1', '2026-01-01', 'course-1');
        INSERT INTO session_students (session_id, student_id) VALUES ('sess-1', 's-1');
        INSERT INTO assessments (id, title, category_id, course_id, session_id)
          VALUES ('a-1', 'Mündlich', 'course-1:mitarbeit', 'course-1', 'sess-1');
        INSERT INTO student_performances (id, student_id, assessment_id, symbol, type)
          VALUES ('p-1', 's-1', 'a-1', 'PLUS', 'participation');
        INSERT INTO findings (id, student_performance_id, type, text_content) VALUES ('f-1', 'p-1', 'note', 'x');
        INSERT INTO grades (id, student_id, course_id, score) VALUES ('g-1', 's-1', 'course-1', 2);
      `);

      await repo.hardDelete('course-1');

      for (const table of ['courses', 'sessions', 'assessments', 'student_performances', 'findings', 'grades', 'assessment_categories']) {
        const row = db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as { cnt: number };
        expect(row.cnt).toBe(0);
      }
      const students = db.prepare('SELECT COUNT(*) AS cnt FROM students').get() as { cnt: number };
      expect(students.cnt).toBe(1);
    });
  });

  describe('assessment categories', () => {
    it('persists and loads auto-seeded Mitarbeit category', async () => {
      const course = Course.create('course-1', 'Mathematik', schoolClass);
      await repo.save(course);

      const found = await repo.findById('course-1');
      expect(found!.assessmentCategories).toHaveLength(1);
      expect(found!.assessmentCategories[0]!.title).toBe('Mitarbeit');
      expect(found!.assessmentCategories[0]!.gradingType).toBe(GradingType.TERTIARY);
    });

    it('persists and loads additional categories', async () => {
      const course = Course.create('course-1', 'Mathematik', schoolClass);
      const schularbeit = new AssessmentCategory(
        'cat-2',
        'Schularbeit',
        GradingType.NUMERIC,
        true,
      );
      course.addAssessmentCategory(schularbeit);
      await repo.save(course);

      const found = await repo.findById('course-1');
      expect(found!.assessmentCategories).toHaveLength(2);
    });
  });

  describe('grade compositions', () => {
    it('persists and loads compositions', async () => {
      const course = Course.create('course-1', 'Mathematik', schoolClass);
      const mitarbeit = course.assessmentCategories[0]!;
      const comp = GradeComposition.create(mitarbeit, 50);
      if (!comp.ok) throw new Error('GradeComposition creation failed');
      course.addGradeComposition(comp.value);
      await repo.save(course);

      const found = await repo.findById('course-1');
      expect(found!.gradeCompositions).toHaveLength(1);
      expect(found!.gradeCompositions[0]!.weight).toBe(50);
    });
  });
});
