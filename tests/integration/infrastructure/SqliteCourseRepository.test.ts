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
