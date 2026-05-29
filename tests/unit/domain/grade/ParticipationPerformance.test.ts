import { ParticipationPerformance } from '../../../../src/domain/grade/ParticipationPerformance';
import { ParticipationSymbol } from '../../../../src/domain/grade/ParticipationSymbol';
import { Assessment } from '../../../../src/domain/grade/Assessment';
import { AssessmentCategory } from '../../../../src/domain/grade/AssessmentCategory';
import { GradingType } from '../../../../src/domain/grade/GradingType';
import { Course } from '../../../../src/domain/grade/Course';
import { SchoolClass } from '../../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../../src/domain/student/SchoolYear';
import { Student } from '../../../../src/domain/student/Student';
import { StudentId } from '../../../../src/domain/student/StudentId';
import { Name } from '../../../../src/domain/student/Name';

let student: Student;
let assessment: Assessment;

beforeAll(() => {
  const year = SchoolYear.create('2025/26');
  if (!year.ok) throw new Error('Test setup failed');
  const validClass = new SchoolClass('class-1', '1A', year.value);
  const validCourse = Course.create('course-1', 'Mathematik', validClass);
  const category = new AssessmentCategory('cat-1', 'Mitarbeit', GradingType.TERTIARY, false);

  const id = StudentId.create('s-001');
  const name = Name.create('Max', 'Mustermann');
  if (!id.ok || !name.ok) throw new Error('Test setup failed');
  student = Student.create(id.value, name.value, validClass);

  assessment = new Assessment('ass-1', 'Mündlich', category, validCourse, 'session-1');
});

describe('ParticipationPerformance', () => {
  describe('create', () => {
    it('creates with a valid ParticipationSymbol', () => {
      const symbol = ParticipationSymbol.create('PLUS');
      expect(symbol.ok).toBe(true);
      if (symbol.ok) {
        const result = ParticipationPerformance.create(
          'pp-1', student, assessment, symbol.value,
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.symbol.value).toBe('PLUS');
        }
      }
    });

    it('creates with MINUS symbol', () => {
      const symbol = ParticipationSymbol.create('MINUS');
      expect(symbol.ok).toBe(true);
      if (symbol.ok) {
        const result = ParticipationPerformance.create(
          'pp-2', student, assessment, symbol.value,
        );
        expect(result.ok).toBe(true);
      }
    });

    it('creates with WELLE symbol', () => {
      const symbol = ParticipationSymbol.create('WELLE');
      expect(symbol.ok).toBe(true);
      if (symbol.ok) {
        const result = ParticipationPerformance.create(
          'pp-3', student, assessment, symbol.value,
        );
        expect(result.ok).toBe(true);
      }
    });
  });

  describe('toScore', () => {
    it('returns 2.0 for PLUS', () => {
      const symbol = ParticipationSymbol.create('PLUS');
      if (symbol.ok) {
        const result = ParticipationPerformance.create(
          'pp-1', student, assessment, symbol.value,
        );
        expect(result.ok && result.value.toScore()).toBe(2.0);
      }
    });

    it('returns 0.0 for MINUS', () => {
      const symbol = ParticipationSymbol.create('MINUS');
      if (symbol.ok) {
        const result = ParticipationPerformance.create(
          'pp-2', student, assessment, symbol.value,
        );
        expect(result.ok && result.value.toScore()).toBe(0.0);
      }
    });

    it('returns 1.0 for WELLE', () => {
      const symbol = ParticipationSymbol.create('WELLE');
      if (symbol.ok) {
        const result = ParticipationPerformance.create(
          'pp-3', student, assessment, symbol.value,
        );
        expect(result.ok && result.value.toScore()).toBe(1.0);
      }
    });
  });

  describe('inherits StudentPerformance', () => {
    it('has null score (symbol-based, not points)', () => {
      const symbol = ParticipationSymbol.create('PLUS');
      if (symbol.ok) {
        const result = ParticipationPerformance.create(
          'pp-1', student, assessment, symbol.value,
        );
        expect(result.ok && result.value.score).toBeNull();
      }
    });
  });
});
