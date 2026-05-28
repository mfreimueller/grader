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
    return normalizeScore(performance.score!, gradedAssessment.maxPoints);
  }
  if (performance instanceof ParticipationPerformance) {
    return Result.ok(performance.toScore());
  }
  return Result.fail(
    new ValidationError('Unknown performance type'),
  );
}
