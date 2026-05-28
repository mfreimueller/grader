import { StudentPerformance } from '../../../../src/domain/grade/StudentPerformance';
import { Assessment } from '../../../../src/domain/grade/Assessment';
import { AssessmentCategory } from '../../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../../src/domain/grade/GradingType';
import { Course } from '../../../../src/domain/grade/Course';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';
import { Student } from '../../../../src/domain/student/Student';
import { StudentId } from '../../../../src/domain/student/StudentId';
import { Name } from '../../../../src/domain/student/Name';

class TestPerformance extends StudentPerformance {
  constructor(
    id: string,
    date: Date,
    student: Student,
    assessment: Assessment,
    score: number | null,
  ) {
    super(id, date, student, assessment, score);
  }
}

let validClass: SchoolClass;
let validCourse: Course;
let validCategory: AssessmentCategory;
let validAssessment: Assessment;
let student: Student;

beforeAll(() => {
  const year = SchoolYear.create('2025/26');
  if (!year.ok) throw new Error('Test setup failed');
  validClass = new SchoolClass('class-1', '1A', year.value);
  validCourse = Course.create('course-1', 'Mathematik', validClass);
  validCategory = new AssessmentCategory('cat-1', 'Schularbeit', GradingType.NUMERIC, true);
  validAssessment = new Assessment('ass-1', 'Test 1', new Date(2025, 9, 15), validCategory, validCourse);

  const id = StudentId.create('s-001');
  const name = Name.create('Max', 'Mustermann');
  if (!id.ok || !name.ok) throw new Error('Test setup failed');
  student = Student.create(id.value, name.value, validClass);
});

describe('StudentPerformance', () => {
  describe('create', () => {
    it('creates with id, date, student, assessment, and score', () => {
      const date = new Date(2025, 10, 1);
      const perf = new TestPerformance('perf-1', date, student, validAssessment, 24);
      expect(perf.id).toBe('perf-1');
      expect(perf.date).toBe(date);
      expect(perf.student.id.equals(student.id)).toBe(true);
      expect(perf.assessment.id).toBe('ass-1');
      expect(perf.score).toBe(24);
    });

    it('accepts null score (not yet graded)', () => {
      const perf = new TestPerformance('perf-2', new Date(2025, 10, 1), student, validAssessment, null);
      expect(perf.score).toBeNull();
    });

    it('accepts score of 0', () => {
      const perf = new TestPerformance('perf-3', new Date(2025, 10, 1), student, validAssessment, 0);
      expect(perf.score).toBe(0);
    });

    it('starts with empty findings', () => {
      const perf = new TestPerformance('perf-1', new Date(2025, 10, 1), student, validAssessment, 24);
      expect(perf.findings).toEqual([]);
    });
  });

  describe('equals', () => {
    it('returns true for performances with same id', () => {
      const date = new Date(2025, 10, 1);
      const a = new TestPerformance('perf-1', date, student, validAssessment, 24);
      const b = new TestPerformance('perf-1', date, student, validAssessment, 30);
      expect(a.equals(b)).toBe(true);
    });

    it('returns false for performances with different ids', () => {
      const date = new Date(2025, 10, 1);
      const a = new TestPerformance('perf-1', date, student, validAssessment, 24);
      const b = new TestPerformance('perf-2', date, student, validAssessment, 24);
      expect(a.equals(b)).toBe(false);
    });
  });
});
