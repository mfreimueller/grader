import type { Db } from './db';
import { UnitOfWork } from '../../domain/shared/UnitOfWork';

// The repositories wrap synchronous better-sqlite3 calls in async functions, so awaiting them only
// yields to microtasks. Nothing else can touch the connection between BEGIN and COMMIT, as long as
// the work awaits nothing but repository calls.
export class SqliteUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Db) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    this.db.exec('BEGIN');
    try {
      const result = await work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
