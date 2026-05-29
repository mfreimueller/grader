import { ValidationError } from '../../shared/errors';
import { Result } from '../shared/Result';
import { StudentPerformance } from './StudentPerformance';
import { GradedPerformance } from './GradedPerformance';
import { GradedAssessment } from './GradedAssessment';
import { ParticipationPerformance } from './ParticipationPerformance';

export function normalizeScore(
  score: number,
  maxPoints: number,
): Result<number> {
  if (maxPoints <= 0) {
    return Result.fail(
      new ValidationError('maxPoints must be greater than 0'),
    );
  }
  if (score < 0 || score > maxPoints) {
    return Result.fail(
      new ValidationError(
        `score must be between 0 and ${maxPoints}`,
      ),
    );
  }
  return Result.ok(score / maxPoints);
}

export function performanceToValue(
  performance: StudentPerformance,
): Result<number> {
  if (performance instanceof GradedPerformance) {
    const gradedAssessment = performance.assessment as GradedAssessment;
    const normalized = normalizeScore(performance.score!, gradedAssessment.maxPoints);
    if (normalized.ok) {
      console.log(
        '[GRADE]',
        `Normalize: student=${performance.student.name.firstName} ${performance.student.name.lastName}, ` +
          `assessment=${performance.assessment.title}, category=${performance.assessment.category.title}, ` +
          `score=${performance.score}, maxPoints=${gradedAssessment.maxPoints}, normalized=${normalized.value}`,
      );
    }
    return normalized;
  }
  if (performance instanceof ParticipationPerformance) {
    const value = performance.toScore();
    console.log(
      '[GRADE]',
      `Normalize: student=${performance.student.name.firstName} ${performance.student.name.lastName}, ` +
        `assessment=${performance.assessment.title}, category=${performance.assessment.category.title}, ` +
        `symbol=${performance.symbol.value}, toScore=${value}`,
    );
    return Result.ok(value);
  }
  return Result.fail(
    new ValidationError('Unknown performance type'),
  );
}
