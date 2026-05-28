import { ValueObject } from '../shared/ValueObject';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

interface NameProps {
  firstName: string;
  lastName: string;
}

export class Name extends ValueObject<NameProps> {
  private constructor(firstName: string, lastName: string) {
    super({ firstName, lastName });
  }

  static create(firstName: string, lastName: string): Result<Name> {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (trimmedFirst.length === 0) {
      return Result.fail(new ValidationError('firstName must not be empty'));
    }
    if (trimmedLast.length === 0) {
      return Result.fail(new ValidationError('lastName must not be empty'));
    }

    return Result.ok(new Name(trimmedFirst, trimmedLast));
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
