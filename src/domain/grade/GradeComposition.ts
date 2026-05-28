import { ValueObject } from '../shared/ValueObject';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';
import { AssessmentCategory } from './AssessmentCategory';

interface GradeCompositionProps {
  assessmentCategory: AssessmentCategory;
  weight: number;
}

export class GradeComposition extends ValueObject<GradeCompositionProps> {
  private constructor(
    assessmentCategory: AssessmentCategory,
    weight: number,
  ) {
    super({ assessmentCategory, weight });
  }

  static create(
    assessmentCategory: AssessmentCategory,
    weight: number,
  ): Result<GradeComposition> {
    if (weight <= 0 || weight >= 100) {
      return Result.fail(
        new ValidationError('GradeComposition weight must be between 1 and 99'),
      );
    }
    return Result.ok(new GradeComposition(assessmentCategory, weight));
  }

  get assessmentCategory(): AssessmentCategory {
    return this.props.assessmentCategory;
  }

  get weight(): number {
    return this.props.weight;
  }
}
