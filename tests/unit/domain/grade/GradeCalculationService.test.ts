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
  it('maps 0.875 to grade 1', () => { expect(normalizedToGrade(0.875)).toBe(1); });
  it('maps 0.874 to grade 2', () => { expect(normalizedToGrade(0.874)).toBe(2); });
  it('maps 0.75 to grade 2', () => { expect(normalizedToGrade(0.75)).toBe(2); });
  it('maps 0.749 to grade 3', () => { expect(normalizedToGrade(0.749)).toBe(3); });
  it('maps 0.625 to grade 3', () => { expect(normalizedToGrade(0.625)).toBe(3); });
  it('maps 0.624 to grade 4', () => { expect(normalizedToGrade(0.624)).toBe(4); });
  it('maps 0.5 to grade 4', () => { expect(normalizedToGrade(0.5)).toBe(4); });
  it('maps 0.499 to grade 5', () => { expect(normalizedToGrade(0.499)).toBe(5); });
  it('maps 0.0 to grade 5', () => { expect(normalizedToGrade(0.0)).toBe(5); });
});

describe('GradeCalculationService', () => {
  let service: GradeCalculationService;
  let student: Student;
  let course: Course;
  let schularbeitCategory: AssessmentCategory;

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
  });

  it('calculates a grade from graded performances', () => {
    const assessment = GradedAssessment.create(
      'a-001', 'Test 1', schularbeitCategory, course, 'session-1', 30,
    );
    if (!assessment.ok) throw new Error('Assessment creation failed');

    const perf = GradedPerformance.create(
      'p-001', student, assessment.value, 27,
    );
    if (!perf.ok) throw new Error('Performance creation failed');

    const result = service.calculate([perf.value], course);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rawScore).toBeCloseTo(0.9);
      expect(result.value.displayGrade).toBe(1);
      expect(result.value.categoryGrades).toHaveLength(1);
      expect(result.value.categoryGrades[0]!.categoryId).toBe('cat-1');
      expect(result.value.categoryGrades[0]!.categoryTitle).toBe('Schularbeit');
      expect(result.value.categoryGrades[0]!.weight).toBe(80);
      expect(result.value.categoryGrades[0]!.mean).toBeCloseTo(0.9);
      expect(result.value.categoryGrades[0]!.performanceCount).toBe(1);
      expect(result.value.categoryGrades[0]!.displayGrade).toBe(1);
    }
  });

  it('returns error when course has no compositions', () => {
    const emptyCourse = Course.create('c-empty', 'Empty', course.schoolClass);
    const result = service.calculate([], emptyCourse);
    expect(result.ok).toBe(false);
  });
});
