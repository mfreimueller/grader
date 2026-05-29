import { Assessment } from './Assessment';
import { AssessmentCategory } from './AssessmentCategory';
import { Course } from './Course';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

export class GradedAssessment extends Assessment {
  private readonly _maxPoints: number;

  private constructor(
    id: string,
    title: string,
    category: AssessmentCategory,
    course: Course,
    sessionId: string,
    maxPoints: number,
    isImpromptu = false,
  ) {
    super(id, title, category, course, sessionId, isImpromptu);
    this._maxPoints = maxPoints;
  }

  static create(
    id: string,
    title: string,
    category: AssessmentCategory,
    course: Course,
    sessionId: string,
    maxPoints: number,
    isImpromptu = false,
  ): Result<GradedAssessment> {
    if (maxPoints <= 0) {
      return Result.fail(
        new ValidationError('GradedAssessment maxPoints must be greater than 0'),
      );
    }
    return Result.ok(
      new GradedAssessment(id, title, category, course, sessionId, maxPoints, isImpromptu),
    );
  }

  get maxPoints(): number {
    return this._maxPoints;
  }
}
