import { Assessment } from '../../../../src/domain/grade/Assessment';
import { AssessmentCategory } from '../../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../../src/domain/grade/GradingType';
import { Course } from '../../../../src/domain/grade/Course';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';

let validClass: SchoolClass;
let validCourse: Course;
let validCategory: AssessmentCategory;

beforeAll(() => {
  const year = SchoolYear.create('2025/26');
  if (!year.ok) throw new Error('Test setup failed');
  validClass = new SchoolClass('class-1', '1A', year.value);
  validCourse = Course.create('course-1', 'Mathematik', validClass);
  validCategory = new AssessmentCategory('cat-1', 'Schularbeit', GradingType.NUMERIC, true);
});

describe('Assessment', () => {
  describe('create', () => {
    it('creates an assessment with id, title, date, category, course', () => {
      const date = new Date(2025, 9, 15);
      const assessment = new Assessment(
        'ass-1', 'Test 1', date, validCategory, validCourse,
      );
      expect(assessment.id).toBe('ass-1');
      expect(assessment.title).toBe('Test 1');
      expect(assessment.date).toBe(date);
      expect(assessment.category.id).toBe('cat-1');
      expect(assessment.course.id).toBe('course-1');
      expect(assessment.isImpromptu).toBe(false);
    });

    it('creates an impromptu assessment', () => {
      const date = new Date(2025, 9, 15);
      const assessment = new Assessment(
        'ass-2', 'Kurztest', date, validCategory, validCourse, true,
      );
      expect(assessment.isImpromptu).toBe(true);
    });
  });

  describe('equals', () => {
    it('returns true for assessments with same id', () => {
      const date = new Date(2025, 9, 15);
      const a = new Assessment('ass-1', 'Test', date, validCategory, validCourse);
      const b = new Assessment('ass-1', 'Other', date, validCategory, validCourse);
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for assessments with different ids', () => {
      const date = new Date(2025, 9, 15);
      const a = new Assessment('ass-1', 'Test', date, validCategory, validCourse);
      const b = new Assessment('ass-2', 'Test', date, validCategory, validCourse);
      expect(a.equals(b)).toBe(false);
    });
  });
});
