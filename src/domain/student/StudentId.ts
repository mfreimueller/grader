import { ValueObject } from '../shared/ValueObject';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

export class StudentId extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): Result<StudentId> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return Result.fail(new ValidationError('StudentId must not be empty'));
    }
    return Result.ok(new StudentId(trimmed));
  }

  get value(): string {
    return this.props.value;
  }
}
