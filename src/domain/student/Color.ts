import { ValueObject } from '../shared/ValueObject';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class Color extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): Result<Color> {
    if (!HEX_COLOR.test(raw)) {
      return Result.fail(new ValidationError('Color must be a hex value like #ed1943'));
    }
    return Result.ok(new Color(raw.toLowerCase()));
  }

  get value(): string {
    return this.props.value;
  }
}
