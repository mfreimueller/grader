import Database from 'better-sqlite3';

export type Db = Database.Database;

export function createInMemoryDb(): Db {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export interface Migration {
  id: string;
  description: string;
  sql: string;
}

const MIGRATION_001: Migration = {
  id: '001',
  description: 'Create initial schema',
  sql: `
    CREATE TABLE IF NOT EXISTS school_classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      school_year TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      school_class_id TEXT NOT NULL REFERENCES school_classes(id)
    );

    CREATE TABLE IF NOT EXISTS student_additional_information (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      key TEXT NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      school_class_id TEXT NOT NULL REFERENCES school_classes(id)
    );

    CREATE TABLE IF NOT EXISTS assessment_categories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      grading_type TEXT NOT NULL CHECK(grading_type IN ('NUMERIC', 'TERTIARY')),
      display_as_grade INTEGER NOT NULL DEFAULT 0,
      course_id TEXT NOT NULL REFERENCES courses(id)
    );

    CREATE TABLE IF NOT EXISTS grade_compositions (
      category_id TEXT NOT NULL REFERENCES assessment_categories(id),
      course_id TEXT NOT NULL REFERENCES courses(id),
      weight INTEGER NOT NULL,
      PRIMARY KEY (category_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      notes TEXT,
      course_id TEXT NOT NULL REFERENCES courses(id)
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES assessment_categories(id),
      course_id TEXT NOT NULL REFERENCES courses(id),
      is_impromptu INTEGER NOT NULL DEFAULT 0,
      max_points INTEGER
    );

    CREATE TABLE IF NOT EXISTS student_performances (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id),
      assessment_id TEXT NOT NULL REFERENCES assessments(id),
      score REAL,
      symbol TEXT,
      type TEXT NOT NULL CHECK(type IN ('graded', 'participation'))
    );

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      student_performance_id TEXT NOT NULL REFERENCES student_performances(id),
      type TEXT NOT NULL CHECK(type IN ('document', 'note', 'remote_document')),
      file_path TEXT,
      text_content TEXT,
      url TEXT
    );

    CREATE TABLE IF NOT EXISTS grades (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      course_id TEXT NOT NULL REFERENCES courses(id),
      score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5)
    );
  `,
};

const ALL_MIGRATIONS: Migration[] = [MIGRATION_001];

export function runMigrations(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  for (const migration of ALL_MIGRATIONS) {
    const alreadyApplied = db
      .prepare('SELECT id FROM _migrations WHERE id = ?')
      .get(migration.id);

    if (!alreadyApplied) {
      db.exec(migration.sql);
      db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(migration.id);
    }
  }
}
