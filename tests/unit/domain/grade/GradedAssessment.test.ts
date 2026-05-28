import { GradedAssessment } from '../../../../src/domain/grade/GradedAssessment';
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

describe('GradedAssessment', () => {
  describe('create', () => {
    it('creates with id, title, date, category, course, and maxPoints', () => {
      const date = new Date(2025, 9, 15);
      const result = GradedAssessment.create(
        'ga-1', 'Test 1', date, validCategory, validCourse, 30,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('ga-1');
        expect(result.value.title).toBe('Test 1');
        expect(result.value.maxPoints).toBe(30);
        expect(result.value.isImpromptu).toBe(false);
      }
    });

    it('creates an impromptu GradedAssessment', () => {
      const date = new Date(2025, 9, 15);
      const result = GradedAssessment.create(
        'ga-2', 'Kurztest', date, validCategory, validCourse, 10, true,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isImpromptu).toBe(true);
      }
    });

    it('rejects maxPoints of 0', () => {
      const date = new Date(2025, 9, 15);
      const result = GradedAssessment.create(
        'ga-3', 'Test', date, validCategory, validCourse, 0,
      );
      expect(result.ok).toBe(false);
    });

    it('rejects negative maxPoints', () => {
      const date = new Date(2025, 9, 15);
      const result = GradedAssessment.create(
        'ga-3', 'Test', date, validCategory, validCourse, -5,
      );
      expect(result.ok).toBe(false);
    });
  });

  describe('inherits Assessment', () => {
    it('has category, course, and title from Assessment', () => {
      const date = new Date(2025, 9, 15);
      const result = GradedAssessment.create(
        'ga-1', 'Test 1', date, validCategory, validCourse, 30,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.category.id).toBe('cat-1');
        expect(result.value.course.id).toBe('course-1');
      }
    });
  });
});
