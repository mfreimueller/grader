import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

export enum GradingType {
  NUMERIC = 'NUMERIC',
  TERTIARY = 'TERTIARY',
}

export namespace GradingType {
  export function fromString(raw: string): Result<GradingType> {
    switch (raw) {
      case 'NUMERIC':
        return Result.ok(GradingType.NUMERIC);
      case 'TERTIARY':
        return Result.ok(GradingType.TERTIARY);
      default:
        return Result.fail(
          new ValidationError(`Invalid GradingType: "${raw}". Must be NUMERIC or TERTIARY`),
        );
    }
  }
}
