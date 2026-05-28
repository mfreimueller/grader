import { Entity } from '../shared/Entity';
import { SchoolYear } from './SchoolYear';

export class SchoolClass extends Entity<string> {
  constructor(
    id: string,
    public readonly name: string,
    public readonly schoolYear: SchoolYear,
  ) {
    super(id);
  }
}
