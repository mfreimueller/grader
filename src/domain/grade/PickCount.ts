import { ValueObject } from '../shared/ValueObject';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

export class PickCount extends ValueObject<{ value: number }> {
  private constructor(value: number) {
    super({ value });
  }

  static create(raw: number): Result<PickCount> {
    if (!Number.isInteger(raw) || raw < 0) {
      return Result.fail(new ValidationError('PickCount must be a non-negative integer'));
    }
    return Result.ok(new PickCount(raw));
  }

  get value(): number {
    return this.props.value;
  }
}
