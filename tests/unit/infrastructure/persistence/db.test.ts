import { createInMemoryDb, runMigrations } from '../../../../src/infrastructure/persistence/db';

describe('createInMemoryDb', () => {
  it('creates an in-memory SQLite database', () => {
    const db = createInMemoryDb();
    const row = db.prepare('SELECT 1 as n').get() as { n: number };
    expect(row.n).toBe(1);
    db.close();
  });

  it('has foreign keys enabled', () => {
    const db = createInMemoryDb();
    const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(row.foreign_keys).toBe(1);
    db.close();
  });
});

describe('runMigrations', () => {
  it('creates the _migrations table', () => {
    const db = createInMemoryDb();
    runMigrations(db);
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'",
    ).get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.name).toBe('_migrations');
    db.close();
  });

  it('creates all expected tables', () => {
    const db = createInMemoryDb();
    runMigrations(db);
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('school_classes');
    expect(tableNames).toContain('students');
    expect(tableNames).toContain('student_additional_information');
    expect(tableNames).toContain('courses');
    expect(tableNames).toContain('assessment_categories');
    expect(tableNames).toContain('grade_compositions');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('assessments');
    expect(tableNames).toContain('student_performances');
    expect(tableNames).toContain('findings');
    expect(tableNames).toContain('grades');
  });

  it('is idempotent (can be run multiple times)', () => {
    const db = createInMemoryDb();
    runMigrations(db);
    runMigrations(db);
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all() as { name: string }[];
    expect(tables.length).toBeGreaterThan(1);
    db.close();
  });
});
