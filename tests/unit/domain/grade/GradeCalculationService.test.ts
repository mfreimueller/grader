import { GradeCalculationService, normalizedToGrade } from '../../../../src/domain/grade/GradeCalculationService';
import { GradedPerformance } from '../../../../src/domain/grade/GradedPerformance';
import { GradedAssessment } from '../../../../src/domain/grade/GradedAssessment';
import { AssessmentCategory } from '../../../../src/domain/grade/AssessmentCategory';
import { GradeComposition } from '../../../../src/domain/grade/GradeComposition';
import { GradingType } from '../../../../src/domain/grade/GradingType';
import { Course } from '../../../../src/domain/grade/Course';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';
import { Student } from '../../../../src/domain/student/Student';
import { StudentId } from '../../../../src/domain/student/StudentId';
import { Name } from '../../../../src/domain/student/Name';

describe('normalizedToGrade', () => {
  it('maps 1.0 to grade 1', () => { expect(normalizedToGrade(1.0)).toBe(1); });
  it('maps 0.9 to grade 1', () => { expect(normalizedToGrade(0.9)).toBe(1); });
  it('maps 0.85 to grade 1', () => { expect(normalizedToGrade(0.85)).toBe(1); });
  it('maps 0.84 to grade 2', () => { expect(normalizedToGrade(0.84)).toBe(2); });
  it('maps 0.65 to grade 2', () => { expect(normalizedToGrade(0.65)).toBe(2); });
  it('maps 0.64 to grade 3', () => { expect(normalizedToGrade(0.64)).toBe(3); });
  it('maps 0.45 to grade 3', () => { expect(normalizedToGrade(0.45)).toBe(3); });
  it('maps 0.44 to grade 4', () => { expect(normalizedToGrade(0.44)).toBe(4); });
  it('maps 0.2 to grade 4', () => { expect(normalizedToGrade(0.2)).toBe(4); });
  it('maps 0.19 to grade 5', () => { expect(normalizedToGrade(0.19)).toBe(5); });
  it('maps 0.0 to grade 5', () => { expect(normalizedToGrade(0.0)).toBe(5); });
});

describe('GradeCalculationService', () => {
  let service: GradeCalculationService;
  let student: Student;
  let course: Course;
  let schularbeitCategory: AssessmentCategory;
  let referenceDate: Date;

  beforeAll(() => {
    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw new Error('Test setup failed');
    const validClass = new SchoolClass('class-1', '1A', year.value);
    course = Course.create('course-1', 'Mathematik', validClass);

    const id = StudentId.create('s-001');
    const name = Name.create('Max', 'Mustermann');
    if (!id.ok || !name.ok) throw new Error('Test setup failed');
    student = Student.create(id.value, name.value, validClass);

    schularbeitCategory = new AssessmentCategory('cat-1', 'Schularbeit', GradingType.NUMERIC, true);
    course.addAssessmentCategory(schularbeitCategory);

    const composition = GradeComposition.create(schularbeitCategory, 80);
    if (!composition.ok) throw new Error('Failed to create composition');
    course.addGradeComposition(composition.value);

    service = new GradeCalculationService();
    referenceDate = new Date(2025, 9, 15);
  });

  it('calculates a grade from graded performances', () => {
    const assessment = GradedAssessment.create(
      'a-001', 'Test 1', referenceDate, schularbeitCategory, course, 30,
    );
    if (!assessment.ok) throw new Error('Assessment creation failed');

    const perf = GradedPerformance.create(
      'p-001', referenceDate, student, assessment.value, 27,
    );
    if (!perf.ok) throw new Error('Performance creation failed');

    const result = service.calculate([perf.value], course, referenceDate);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rawScore).toBeCloseTo(0.9);
      expect(result.value.displayGrade).toBe(1);
    }
  });

  it('returns error when course has no compositions', () => {
    const emptyCourse = Course.create('c-empty', 'Empty', course.schoolClass);
    const result = service.calculate([], emptyCourse, referenceDate);
    expect(result.ok).toBe(false);
  });
});
