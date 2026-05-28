import { Course } from '../../../../src/domain/grade/Course';
import { AssessmentCategory } from '../../../../src/domain/grade/AssessmentCategory';
import { GradeComposition } from '../../../../src/domain/grade/GradeComposition';
import { GradingType } from '../../../../src/domain/grade/GradingType';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';

let validClass: SchoolClass;

beforeAll(() => {
  const year = SchoolYear.create('2025/26');
  if (!year.ok) throw new Error('Test setup failed');
  validClass = new SchoolClass('class-1', '1A', year.value);
});

describe('Course', () => {
  describe('create', () => {
    it('creates a course with id, title, and school class', () => {
      const course = Course.create('course-1', 'Mathematik', validClass);
      expect(course.id).toBe('course-1');
      expect(course.title).toBe('Mathematik');
      expect(course.schoolClass.id).toBe('class-1');
    });

    it('seeds a default "Mitarbeit" assessment category', () => {
      const course = Course.create('course-1', 'Mathematik', validClass);
      expect(course.assessmentCategories).toHaveLength(1);
      expect(course.assessmentCategories[0]?.title).toBe('Mitarbeit');
      expect(course.assessmentCategories[0]?.gradingType).toBe(GradingType.TERTIARY);
      expect(course.assessmentCategories[0]?.displayAsGrade).toBe(false);
    });

    it('starts with empty gradeCompositions', () => {
      const course = Course.create('course-1', 'Mathematik', validClass);
      expect(course.gradeCompositions).toEqual([]);
    });
  });

  describe('addAssessmentCategory', () => {
    it('adds a new assessment category', () => {
      const course = Course.create('course-1', 'Mathematik', validClass);
      const cat = new AssessmentCategory('cat-2', 'Schularbeit', GradingType.NUMERIC, true);
      course.addAssessmentCategory(cat);
      expect(course.assessmentCategories).toHaveLength(2);
      expect(course.assessmentCategories[1]?.title).toBe('Schularbeit');
    });
  });

  describe('addGradeComposition', () => {
    it('adds a grade composition', () => {
      const course = Course.create('course-1', 'Mathematik', validClass);
      const cat = course.assessmentCategories[0]!;
      const comp = GradeComposition.create(cat, 50);
      expect(comp.ok).toBe(true);
      if (comp.ok) {
        course.addGradeComposition(comp.value);
        expect(course.gradeCompositions).toHaveLength(1);
        expect(course.gradeCompositions[0]?.weight).toBe(50);
      }
    });
  });

  describe('removeGradeComposition', () => {
    it('removes a grade composition by category id', () => {
      const course = Course.create('course-1', 'Mathematik', validClass);
      const cat = course.assessmentCategories[0]!;
      const comp = GradeComposition.create(cat, 50);
      expect(comp.ok).toBe(true);
      if (comp.ok) {
        course.addGradeComposition(comp.value);
        course.removeGradeComposition(cat.id);
        expect(course.gradeCompositions).toHaveLength(0);
      }
    });

    it('does nothing when composition for category does not exist', () => {
      const course = Course.create('course-1', 'Mathematik', validClass);
      course.removeGradeComposition('nonexistent');
      expect(course.gradeCompositions).toEqual([]);
    });
  });

  describe('getMitarbeitCategory', () => {
    it('returns the Mitarbeit category', () => {
      const course = Course.create('course-1', 'Mathematik', validClass);
      const mitarbeit = course.getMitarbeitCategory();
      expect(mitarbeit?.title).toBe('Mitarbeit');
    });
  });

  describe('equals', () => {
    it('returns true for courses with same id', () => {
      const a = Course.create('course-1', 'Mathematik', validClass);
      const b = Course.create('course-1', 'Physik', validClass);
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for courses with different ids', () => {
      const a = Course.create('course-1', 'Mathematik', validClass);
      const b = Course.create('course-2', 'Mathematik', validClass);
      expect(a.equals(b)).toBe(false);
    });
  });
});
