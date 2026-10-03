import { ValueObject } from '../shared/ValueObject';
import { Result } from '../shared/Result';
import { ValidationError } from '../../shared/errors';

interface SchoolYearProps {
  startYear: number;
  endYear: number;
}

const SCHOOL_YEAR_PATTERN = /^(\d{4})\/(\d{2})$/;

export class SchoolYear extends ValueObject<SchoolYearProps> {
  private constructor(startYear: number, endYear: number) {
    super({ startYear, endYear });
  }

  static create(raw: string): Result<SchoolYear> {
    const match = raw.trim().match(SCHOOL_YEAR_PATTERN);
    if (!match) {
      return Result.fail(new ValidationError('SchoolYear must be in format YYYY/YY'));
    }

    const startYear = parseInt(match[1]!, 10);
    const endShort = parseInt(match[2]!, 10);
    const endYear = Number(`20${endShort < 10 ? `0${endShort}` : endShort}`);

    if (startYear < 2000) {
      return Result.fail(new ValidationError('SchoolYear start year must be 2000 or later'));
    }

    if (endYear !== startYear + 1) {
      return Result.fail(new ValidationError('SchoolYear end year must follow start year'));
    }

    return Result.ok(new SchoolYear(startYear, endYear));
  }

  get startYear(): number {
    return this.props.startYear;
  }

  get endYear(): number {
    return this.props.endYear;
  }

  get startDate(): Date {
    return new Date(this.startYear, 8, 1); // September 1st
  }

  toString(): string {
    const endShort = this.endYear % 100;
    return `${this.startYear}/${endShort.toString().padStart(2, '0')}`;
  }

  next(): SchoolYear {
    return new SchoolYear(this.startYear + 1, this.endYear + 1);
  }

  compareTo(other: SchoolYear): number {
    return this.startYear - other.startYear;
  }
}
