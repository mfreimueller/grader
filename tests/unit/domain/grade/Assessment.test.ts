import { Assessment } from '../../../../src/domain/grade/Assessment';
import { AssessmentCategory } from '../../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../../src/domain/grade/GradingType';
import { Course } from '../../../../src/domain/grade/Course';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';
import { GradedAssessment } from '../../../../src/domain/grade/GradedAssessment';
import { ValidationError } from '../../../../src/shared/errors';

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

  describe('changeCategory', () => {
    const aCategory = (id: string, type: GradingType): AssessmentCategory =>
      new AssessmentCategory(id, `Kategorie ${id}`, type, true);

    it('moves the assessment to another category of the same grading type', () => {
      const assessment = new Assessment('ass-1', 'Test', validCategory, validCourse, 'session-1');
      const result = assessment.changeCategory(aCategory('cat-2', GradingType.NUMERIC));
      expect(result.ok).toBe(true);
      expect(assessment.category.id).toBe('cat-2');
    });

    it('is a no-op success for the current category', () => {
      const assessment = new Assessment('ass-1', 'Test', validCategory, validCourse, 'session-1');
      const result = assessment.changeCategory(validCategory);
      expect(result.ok).toBe(true);
      expect(assessment.category.id).toBe('cat-1');
    });

    it('returns a ValidationError when the grading type differs', () => {
      const assessment = new Assessment('ass-1', 'Test', validCategory, validCourse, 'session-1');
      const result = assessment.changeCategory(aCategory('cat-3', GradingType.TERTIARY));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
      expect(assessment.category.id).toBe('cat-1');
    });

    it('keeps maxPoints of a GradedAssessment', () => {
      const created = GradedAssessment.create('ass-g', 'Test', validCategory, validCourse, 'session-1', 30);
      if (!created.ok) throw new Error('Test setup failed');
      const result = created.value.changeCategory(aCategory('cat-2', GradingType.NUMERIC));
      expect(result.ok).toBe(true);
      expect(created.value.category.id).toBe('cat-2');
      expect(created.value.maxPoints).toBe(30);
    });
  });
});
