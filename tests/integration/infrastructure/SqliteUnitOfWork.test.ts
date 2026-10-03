import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteUnitOfWork } from '../../../src/infrastructure/persistence/SqliteUnitOfWork';
import type { Db } from '../../../src/infrastructure/persistence/db';

describe('SqliteUnitOfWork', () => {
  let db: Db;
  let uow: SqliteUnitOfWork;

  const classCount = (): number =>
    (db.prepare('SELECT COUNT(*) AS cnt FROM school_classes').get() as { cnt: number }).cnt;

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    uow = new SqliteUnitOfWork(db);
  });

  afterEach(() => {
    db.close();
  });

  it('commits all writes when the work succeeds and returns its value', async () => {
    const result = await uow.run(async () => {
      db.prepare("INSERT INTO school_classes (id, name, school_year) VALUES ('c1', '1A', '2025/26')").run();
      await Promise.resolve();
      db.prepare("INSERT INTO school_classes (id, name, school_year) VALUES ('c2', '1B', '2025/26')").run();
      return 'done';
    });

    expect(result).toBe('done');
    expect(classCount()).toBe(2);
  });

  it('rolls back all writes and rethrows when the work fails', async () => {
    await expect(
      uow.run(async () => {
        db.prepare("INSERT INTO school_classes (id, name, school_year) VALUES ('c1', '1A', '2025/26')").run();
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(classCount()).toBe(0);
  });

  it('supports transactions started inside the work', async () => {
    await uow.run(async () => {
      db.transaction(() => {
        db.prepare("INSERT INTO school_classes (id, name, school_year) VALUES ('c1', '1A', '2025/26')").run();
      })();
    });

    expect(classCount()).toBe(1);
  });
});
