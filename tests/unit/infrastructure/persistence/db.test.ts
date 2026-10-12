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

describe('migration 013 (Mündlich becomes per-student Mitarbeit)', () => {
  const seed = (db: ReturnType<typeof createInMemoryDb>): void => {
    db.exec(`
      INSERT INTO school_classes (id, name, school_year) VALUES ('cl-1', '1A', '2025/26');
      INSERT INTO students (id, first_name, last_name, school_class_id) VALUES
        ('s-1', 'Max', 'Muster', 'cl-1'), ('s-2', 'Eva', 'Muster', 'cl-1');
      INSERT INTO courses (id, title, school_class_id) VALUES ('co-1', 'Mathe', 'cl-1');
      INSERT INTO assessment_categories (id, title, grading_type, display_as_grade, course_id)
        VALUES ('cat-m', 'Mitarbeit', 'TERTIARY', 0, 'co-1');
      INSERT INTO sessions (id, date, notes, course_id) VALUES
        ('se-1', '2025-10-15T00:00:00.000Z', '', 'co-1'), ('se-2', '2025-10-16T00:00:00.000Z', '', 'co-1');
      INSERT INTO assessments (id, title, category_id, course_id, is_impromptu, session_id) VALUES
        ('se-1:muendlich', 'Mündlich', 'cat-m', 'co-1', 0, 'se-1'),
        ('se-2:muendlich', 'Mündlich', 'cat-m', 'co-1', 0, 'se-2'),
        ('a-own', 'Mündlich', 'cat-m', 'co-1', 0, 'se-1');
      INSERT INTO student_performances (id, student_id, assessment_id, symbol, type) VALUES
        ('p-1', 's-1', 'se-1:muendlich', 'PLUS', 'participation'),
        ('p-2', 's-2', 'se-1:muendlich', 'MINUS', 'participation'),
        ('p-own', 's-1', 'a-own', 'WELLE', 'participation');
      INSERT INTO findings (id, student_performance_id, type, text_content) VALUES ('f-1', 'p-1', 'note', 'meldet sich');
    `);
  };

  const migrateFrom012 = (): ReturnType<typeof createInMemoryDb> => {
    const db = createInMemoryDb();
    runMigrations(db);
    seed(db);
    db.exec("DELETE FROM _migrations WHERE id = '013';");
    runMigrations(db);
    return db;
  };

  it('is a known migration', () => {
    expect(KNOWN_MIGRATION_IDS).toContain('013');
  });

  it('gives every result of an auto-created Mündlich its own impromptu Mitarbeit assessment', () => {
    const db = migrateFrom012();
    const rows = db
      .prepare("SELECT id, title, category_id, course_id, is_impromptu, max_points, session_id FROM assessments WHERE id LIKE 'p-%' ORDER BY id")
      .all();
    expect(rows).toEqual([
      { id: 'p-1:mitarbeit', title: 'Mitarbeit', category_id: 'cat-m', course_id: 'co-1', is_impromptu: 1, max_points: null, session_id: 'se-1' },
      { id: 'p-2:mitarbeit', title: 'Mitarbeit', category_id: 'cat-m', course_id: 'co-1', is_impromptu: 1, max_points: null, session_id: 'se-1' },
    ]);
    db.close();
  });

  it('moves the results and keeps their notes', () => {
    const db = migrateFrom012();
    const perfs = db.prepare("SELECT id, assessment_id, symbol FROM student_performances WHERE id IN ('p-1', 'p-2') ORDER BY id").all();
    expect(perfs).toEqual([
      { id: 'p-1', assessment_id: 'p-1:mitarbeit', symbol: 'PLUS' },
      { id: 'p-2', assessment_id: 'p-2:mitarbeit', symbol: 'MINUS' },
    ]);
    const note = db.prepare("SELECT student_performance_id FROM findings WHERE id = 'f-1'").get();
    expect(note).toEqual({ student_performance_id: 'p-1' });
    db.close();
  });

  it('removes the auto-created Mündlich assessments, empty ones included', () => {
    const db = migrateFrom012();
    const left = db.prepare("SELECT id FROM assessments WHERE id LIKE '%:muendlich'").all();
    expect(left).toEqual([]);
    db.close();
  });

  it('leaves shared assessments the teacher created alone', () => {
    const db = migrateFrom012();
    expect(db.prepare("SELECT title, is_impromptu FROM assessments WHERE id = 'a-own'").get()).toEqual({ title: 'Mündlich', is_impromptu: 0 });
    expect(db.prepare("SELECT assessment_id FROM student_performances WHERE id = 'p-own'").get()).toEqual({ assessment_id: 'a-own' });
    db.close();
  });
});
