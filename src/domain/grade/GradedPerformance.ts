import { StudentPerformance } from './StudentPerformance';
import { GradedAssessment } from './GradedAssessment';
import { Student } from '../student/Student';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

export class GradedPerformance extends StudentPerformance {
  private constructor(
    id: string,
    date: Date,
    student: Student,
    assessment: GradedAssessment,
    score: number | null,
  ) {
    super(id, date, student, assessment, score);
  }

  static create(
    id: string,
    date: Date,
    student: Student,
    assessment: GradedAssessment,
    score: number,
  ): Result<GradedPerformance> {
    if (score < 0 || score > assessment.maxPoints) {
      return Result.fail(
        new ValidationError(
          `GradedPerformance score must be between 0 and ${assessment.maxPoints}`,
        ),
      );
    }
    return Result.ok(new GradedPerformance(id, date, student, assessment, score));
  }
}
