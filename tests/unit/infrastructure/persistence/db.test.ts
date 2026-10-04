import { createInMemoryDb, runMigrations, KNOWN_MIGRATION_IDS } from '../../../../src/infrastructure/persistence/db';

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

describe('migration 011 (session_absences)', () => {
  const seedSession = (db: ReturnType<typeof createInMemoryDb>): void => {
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('cl-1', '1A', '2025/26');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Mustermann', 'cl-1');
      INSERT INTO courses (id, title, school_class_id) VALUES ('co-1', 'Mathe', 'cl-1');
      INSERT INTO sessions (id, date, notes, course_id) VALUES ('se-1', '2025-10-15T00:00:00.000Z', '', 'co-1');
    `);
  };

  it('is a known migration', () => {
    expect(KNOWN_MIGRATION_IDS).toContain('011');
  });

  it('creates the session_absences table with the expected columns', () => {
    const db = createInMemoryDb();
    runMigrations(db);
    const cols = db.prepare('PRAGMA table_info(session_absences)').all() as { name: string; pk: number }[];
    expect(cols.map((c) => c.name).sort()).toEqual(['session_id', 'student_id']);
    expect(cols.every((c) => c.pk > 0)).toBe(true);
    db.close();
  });

  it('rejects the same student twice for one session', () => {
    const db = createInMemoryDb();
    runMigrations(db);
    seedSession(db);
    const insert = db.prepare('INSERT INTO session_absences (session_id, student_id) VALUES (?, ?)');
    insert.run('se-1', 's-1');
    expect(() => insert.run('se-1', 's-1')).toThrow();
    db.close();
  });

  it('enforces foreign keys to sessions and students', () => {
    const db = createInMemoryDb();
    runMigrations(db);
    seedSession(db);
    const insert = db.prepare('INSERT INTO session_absences (session_id, student_id) VALUES (?, ?)');
    expect(() => insert.run('missing', 's-1')).toThrow();
    expect(() => insert.run('se-1', 'missing')).toThrow();
    db.close();
  });

  it('upgrades a database that is at migration 010 without touching existing data', () => {
    const db = createInMemoryDb();
    runMigrations(db);
    seedSession(db);
    db.exec("DROP TABLE session_absences; DELETE FROM _migrations WHERE id = '011';");
    runMigrations(db);
    const table = db.prepare("SELECT name FROM sqlite_master WHERE name = 'session_absences'").get();
    expect(table).toBeDefined();
    const sessions = db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number };
    expect(sessions.n).toBe(1);
    db.close();
  });
});

describe('migration 012 (session_student_notes)', () => {
  const seedSession = (db: ReturnType<typeof createInMemoryDb>): void => {
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('cl-1', '1A', '2025/26');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES ('s-1', 'Max', 'Mustermann', 'cl-1');
      INSERT INTO courses (id, title, school_class_id) VALUES ('co-1', 'Mathe', 'cl-1');
      INSERT INTO sessions (id, date, notes, course_id) VALUES ('se-1', '2025-10-15T00:00:00.000Z', '', 'co-1');
    `);
  };

  it('is a known migration', () => {
    expect(KNOWN_MIGRATION_IDS).toContain('012');
  });

  it('creates the table with the expected columns', () => {
    const db = createInMemoryDb();
    runMigrations(db);
    const cols = db.prepare('PRAGMA table_info(session_student_notes)').all() as { name: string }[];
    expect(cols.map((c) => c.name).sort()).toEqual(['session_id', 'student_id', 'text']);
    db.close();
  });

  it('allows one note per student and session and enforces foreign keys', () => {
    const db = createInMemoryDb();
    runMigrations(db);
    seedSession(db);
    const insert = db.prepare('INSERT INTO session_student_notes (session_id, student_id, text) VALUES (?, ?, ?)');
    insert.run('se-1', 's-1', 'ruhig');
    expect(() => insert.run('se-1', 's-1', 'nochmal')).toThrow();
    expect(() => insert.run('missing', 's-1', 'x')).toThrow();
    expect(() => insert.run('se-1', 'missing', 'x')).toThrow();
    db.close();
  });
});
