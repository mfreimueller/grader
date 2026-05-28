import { normalizeScore, performanceToValue } from '../../../../src/domain/grade/performanceNormalization';
import { GradedPerformance } from '../../../../src/domain/grade/GradedPerformance';
import { ParticipationPerformance } from '../../../../src/domain/grade/ParticipationPerformance';
import { ParticipationSymbol } from '../../../../src/domain/grade/ParticipationSymbol';
import { GradedAssessment } from '../../../../src/domain/grade/GradedAssessment';
import { AssessmentCategory } from '../../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../../src/domain/grade/GradingType';
import { Course } from '../../../../src/domain/grade/Course';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';
import { Student } from '../../../../src/domain/student/Student';
import { StudentId } from '../../../../src/domain/student/StudentId';
import { Name } from '../../../../src/domain/student/Name';
import { Assessment } from '../../../../src/domain/grade/Assessment';

let student: Student;
let gradedAssessment: GradedAssessment;
let participationAssessment: Assessment;

beforeAll(() => {
  const year = SchoolYear.create('2025/26');
  if (!year.ok) throw new Error('Test setup failed');
  const validClass = new SchoolClass('class-1', '1A', year.value);
  const validCourse = Course.create('course-1', 'Mathematik', validClass);
  const numericCategory = new AssessmentCategory('cat-1', 'Schularbeit', GradingType.NUMERIC, true);
  const tertiaryCategory = new AssessmentCategory('cat-2', 'Mitarbeit', GradingType.TERTIARY, false);

  const id = StudentId.create('s-001');
  const name = Name.create('Max', 'Mustermann');
  if (!id.ok || !name.ok) throw new Error('Test setup failed');
  student = Student.create(id.value, name.value, validClass);

  const ga = GradedAssessment.create(
    'ga-1', 'Test 1', new Date(2025, 9, 15), numericCategory, validCourse, 30,
  );
  if (!ga.ok) throw new Error('Test setup failed');
  gradedAssessment = ga.value;

  participationAssessment = new Assessment(
    'ass-1', 'Mündlich', new Date(2025, 9, 15), tertiaryCategory, validCourse,
  );
});

describe('normalizeScore', () => {
  it('returns 0.0 for score 0', () => {
    const result = normalizeScore(0, 30);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(0.0);
  });

  it('returns 0.5 for score 15 out of 30', () => {
    const result = normalizeScore(15, 30);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(0.5);
  });

  it('returns 1.0 for score equal to maxPoints', () => {
    const result = normalizeScore(30, 30);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(1.0);
  });

  it('returns error for maxPoints of 0', () => {
    const result = normalizeScore(10, 0);
    expect(result.ok).toBe(false);
  });

  it('returns error for negative maxPoints', () => {
    const result = normalizeScore(10, -5);
    expect(result.ok).toBe(false);
  });

  it('returns error for score less than 0', () => {
    const result = normalizeScore(-1, 30);
    expect(result.ok).toBe(false);
  });

  it('returns error for score greater than maxPoints', () => {
    const result = normalizeScore(31, 30);
    expect(result.ok).toBe(false);
  });
});

describe('performanceToValue', () => {
  it('normalizes a GradedPerformance to a 0-1 ratio', () => {
    const perf = GradedPerformance.create(
      'p-001', new Date(2025, 9, 15), student, gradedAssessment, 24,
    );
    if (!perf.ok) throw new Error('GradedPerformance creation failed');
    const result = performanceToValue(perf.value);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(0.8);
  });

  it('maps PLUS symbol for ParticipationPerformance', () => {
    const symbol = ParticipationSymbol.create('PLUS');
    expect(symbol.ok).toBe(true);
    if (!symbol.ok) return;
    const perf = ParticipationPerformance.create(
      'p-002', new Date(2025, 9, 15), student, participationAssessment, symbol.value,
    );
    if (!perf.ok) throw new Error('ParticipationPerformance creation failed');
    const result = performanceToValue(perf.value);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(2.0);
  });
});
