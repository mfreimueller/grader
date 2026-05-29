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
    it('creates an assessment with id, title, category, course, and sessionId', () => {
      const assessment = new Assessment(
        'ass-1', 'Test 1', validCategory, validCourse, 'session-1',
      );
      expect(assessment.id).toBe('ass-1');
      expect(assessment.title).toBe('Test 1');
      expect(assessment.category.id).toBe('cat-1');
      expect(assessment.course.id).toBe('course-1');
      expect(assessment.sessionId).toBe('session-1');
      expect(assessment.isImpromptu).toBe(false);
    });

    it('creates an impromptu assessment', () => {
      const assessment = new Assessment(
        'ass-2', 'Kurztest', validCategory, validCourse, 'session-1', true,
      );
      expect(assessment.isImpromptu).toBe(true);
    });
  });

  describe('equals', () => {
    it('returns true for assessments with same id', () => {
      const a = new Assessment('ass-1', 'Test', validCategory, validCourse, 'session-1');
      const b = new Assessment('ass-1', 'Other', validCategory, validCourse, 'session-1');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for assessments with different ids', () => {
      const a = new Assessment('ass-1', 'Test', validCategory, validCourse, 'session-1');
      const b = new Assessment('ass-2', 'Test', validCategory, validCourse, 'session-1');
      expect(a.equals(b)).toBe(false);
    });
  });
});
