import { GradedPerformance } from '../../../../src/domain/grade/GradedPerformance';
import { GradedAssessment } from '../../../../src/domain/grade/GradedAssessment';
import { AssessmentCategory } from '../../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../../src/domain/grade/GradingType';
import { Course } from '../../../../src/domain/grade/Course';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';
import { Student } from '../../../../src/domain/student/Student';
import { StudentId } from '../../../../src/domain/student/StudentId';
import { Name } from '../../../../src/domain/student/Name';

let student: Student;
let gradedAssessment: GradedAssessment;

beforeAll(() => {
  const year = SchoolYear.create('2025/26');
  if (!year.ok) throw new Error('Test setup failed');
  const validClass = new SchoolClass('class-1', '1A', year.value);
  const validCourse = Course.create('course-1', 'Mathematik', validClass);
  const category = new AssessmentCategory('cat-1', 'Schularbeit', GradingType.NUMERIC, true);

  const id = StudentId.create('s-001');
  const name = Name.create('Max', 'Mustermann');
  if (!id.ok || !name.ok) throw new Error('Test setup failed');
  student = Student.create(id.value, name.value, validClass);

  const assessment = GradedAssessment.create(
    'ga-1', 'Test 1', new Date(2025, 9, 15), category, validCourse, 30,
  );
  if (!assessment.ok) throw new Error('Test setup failed');
  gradedAssessment = assessment.value;
});

describe('GradedPerformance', () => {
  describe('create', () => {
    it('creates with score within maxPoints', () => {
      const result = GradedPerformance.create(
        'gp-1', new Date(2025, 10, 1), student, gradedAssessment, 24,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.score).toBe(24);
        expect(result.value.assessment.id).toBe('ga-1');
      }
    });

    it('accepts score of 0', () => {
      const result = GradedPerformance.create(
        'gp-2', new Date(2025, 10, 1), student, gradedAssessment, 0,
      );
      expect(result.ok).toBe(true);
    });

    it('accepts score equal to maxPoints', () => {
      const result = GradedPerformance.create(
        'gp-3', new Date(2025, 10, 1), student, gradedAssessment, 30,
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('validation', () => {
    it('rejects negative score', () => {
      const result = GradedPerformance.create(
        'gp-4', new Date(2025, 10, 1), student, gradedAssessment, -1,
      );
      expect(result.ok).toBe(false);
    });

    it('rejects score exceeding maxPoints', () => {
      const result = GradedPerformance.create(
        'gp-4', new Date(2025, 10, 1), student, gradedAssessment, 31,
      );
      expect(result.ok).toBe(false);
    });
  });
});
