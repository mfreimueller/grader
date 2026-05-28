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
    date: Date,
    category: AssessmentCategory,
    course: Course,
    maxPoints: number,
    isImpromptu = false,
  ) {
    super(id, title, date, category, course, isImpromptu);
    this._maxPoints = maxPoints;
  }

  static create(
    id: string,
    title: string,
    date: Date,
    category: AssessmentCategory,
    course: Course,
    maxPoints: number,
    isImpromptu = false,
  ): Result<GradedAssessment> {
    if (maxPoints <= 0) {
      return Result.fail(
        new ValidationError('GradedAssessment maxPoints must be greater than 0'),
      );
    }
    return Result.ok(
      new GradedAssessment(id, title, date, category, course, maxPoints, isImpromptu),
    );
  }

  get maxPoints(): number {
    return this._maxPoints;
  }
}
