import { ValueObject } from '../shared/ValueObject';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';
import { AssessmentCategory } from './AssessmentCategory';
import { SubWeightType } from './SubWeightType';

interface GradeCompositionProps {
  assessmentCategory: AssessmentCategory;
  weight: number;
  subWeightType: SubWeightType;
}

export class GradeComposition extends ValueObject<GradeCompositionProps> {
  private constructor(
    assessmentCategory: AssessmentCategory,
    weight: number,
    subWeightType: SubWeightType,
  ) {
    super({ assessmentCategory, weight, subWeightType });
  }

  static create(
    assessmentCategory: AssessmentCategory,
    weight: number,
    subWeightType: SubWeightType = SubWeightType.NONE,
  ): Result<GradeComposition> {
    if (weight <= 0 || weight >= 100) {
      return Result.fail(
        new ValidationError('GradeComposition weight must be between 1 and 99'),
      );
    }
    return Result.ok(new GradeComposition(assessmentCategory, weight, subWeightType));
  }

  get assessmentCategory(): AssessmentCategory {
    return this.props.assessmentCategory;
  }

  get weight(): number {
    return this.props.weight;
  }

  get subWeightType(): SubWeightType {
    return this.props.subWeightType;
  }
}
