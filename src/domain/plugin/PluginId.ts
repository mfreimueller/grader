import { ValueObject } from '../shared/ValueObject';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

const MAX_LENGTH = 100;
// Reverse-DNS style, lower case only: the id doubles as the host name of the plugin's URL.
const PATTERN = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;

export class PluginId extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): Result<PluginId> {
    if (raw.length > MAX_LENGTH || !PATTERN.test(raw)) {
      return Result.fail(
        new ValidationError(
          `PluginId must be lower-case reverse-DNS notation (e.g. at.example.tool), got "${raw}"`,
        ),
      );
    }
    return Result.ok(new PluginId(raw));
  }

  get value(): string {
    return this.props.value;
  }
}
