import { Entity } from '../shared/Entity';

export abstract class Finding extends Entity<string> {
  constructor(id: string) {
    super(id);
  }
}
