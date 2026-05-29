import { StudentPerformance } from './StudentPerformance';
import { Course } from './Course';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';
import { performanceToValue } from './performanceNormalization';
import { computeFinalGrade } from './computeFinalGrade';
export interface GradeCalculationResult {
  rawScore: number;
  displayGrade: 1 | 2 | 3 | 4 | 5;
}

export function normalizedToGrade(value: number): 1 | 2 | 3 | 4 | 5 {
  if (value >= 0.875) return 1;
  if (value >= 0.75) return 2;
  if (value >= 0.625) return 3;
  if (value >= 0.5) return 4;
  return 5;
}

export class GradeCalculationService {
  calculate(
    performances: StudentPerformance[],
    course: Course,
  ): Result<GradeCalculationResult> {
    const inputs: { categoryId: string; normalizedValue: number }[] = [];

    for (const perf of performances) {
      const normalized = performanceToValue(perf);
      if (!normalized.ok) {
        return Result.fail(normalized.error);
      }
      inputs.push({
        categoryId: perf.assessment.category.id,
        normalizedValue: normalized.value,
      });
    }

    console.log(
      '[GRADE]',
      `Calculation: student=${performances.length > 0 ? performances[0]!.student.name.firstName + ' ' + performances[0]!.student.name.lastName : '?'}, ` +
        `performances=${inputs.length}, course=${course.title}`,
    );

    const compositions = course.gradeCompositions.map(gc => ({
      categoryId: gc.assessmentCategory.id,
      weight: gc.weight,
    }));

    console.log(
      '[GRADE]',
      `Compositions: ${compositions.map(c => `${c.categoryId}=${c.weight}`).join(', ')}`,
    );

    if (compositions.length === 0) {
      return Result.fail(
        new ValidationError('Course has no grade compositions configured'),
      );
    }

    const rawScore = computeFinalGrade(inputs, compositions);
    const displayGrade = normalizedToGrade(rawScore);

    console.log(
      '[GRADE]',
      `Result: rawScore=${rawScore.toFixed(4)}, displayGrade=${displayGrade}`,
    );

    return Result.ok({ rawScore, displayGrade });
  }
}
