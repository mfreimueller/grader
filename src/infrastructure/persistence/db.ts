import Database from 'better-sqlite3';

export type Db = Database.Database;

export function createInMemoryDb(): Db {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function createFileDb(filePath: string): Db {
  const db = new Database(filePath);
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

const MIGRATION_002: Migration = {
  id: '002',
  description: 'Add deleted_at columns for soft delete',
  sql: `
    ALTER TABLE students ADD COLUMN deleted_at TEXT;
    ALTER TABLE student_performances ADD COLUMN deleted_at TEXT;
    ALTER TABLE findings ADD COLUMN deleted_at TEXT;
    ALTER TABLE grades ADD COLUMN deleted_at TEXT;
  `,
};

const MIGRATION_003: Migration = {
  id: '003',
  description: 'Add session_id to assessments, add session_students table',
  sql: `
    ALTER TABLE assessments ADD COLUMN session_id TEXT REFERENCES sessions(id);
    CREATE TABLE IF NOT EXISTS session_students (
      session_id TEXT NOT NULL REFERENCES sessions(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      PRIMARY KEY (session_id, student_id)
    );
  `,
};

const MIGRATION_004: Migration = {
  id: '004',
  description: 'Add deleted_at to school_classes for soft delete',
  sql: `
    ALTER TABLE school_classes ADD COLUMN deleted_at TEXT;
  `,
};

const MIGRATION_005: Migration = {
  id: '005',
  description: 'Remove date columns from assessments and student_performances (session is source of truth)',
  sql: `
    ALTER TABLE assessments DROP COLUMN date;
    ALTER TABLE student_performances DROP COLUMN date;
  `,
};

const MIGRATION_006: Migration = {
  id: '006',
  description: 'Add sub_weight_type to grade_compositions for granular grading',
  sql: `
    ALTER TABLE grade_compositions ADD COLUMN sub_weight_type TEXT NOT NULL DEFAULT 'NONE' CHECK(sub_weight_type IN ('NONE', 'CHRONOLOGICAL'));
  `,
};

const MIGRATION_007: Migration = {
  id: '007',
  description: 'Add is_hidden column to assessment_categories',
  sql: `
    ALTER TABLE assessment_categories ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;
  `,
};

const MIGRATION_008: Migration = {
  id: '008',
  description: 'Add deleted_at to courses for soft delete',
  sql: `
    ALTER TABLE courses ADD COLUMN deleted_at TEXT;
  `,
};

const MIGRATION_009: Migration = {
  id: '009',
  description: 'Add student color and per-course student pick counts',
  sql: `
    ALTER TABLE students ADD COLUMN color TEXT;

    CREATE TABLE IF NOT EXISTS course_student_picks (
      course_id TEXT NOT NULL REFERENCES courses(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      pick_count INTEGER NOT NULL DEFAULT 0 CHECK(pick_count >= 0),
      PRIMARY KEY (course_id, student_id)
    );
  `,
};

const MIGRATION_010: Migration = {
  id: '010',
  description: 'Add course_excluded_students so a course can cover only part of its class',
  sql: `
    CREATE TABLE IF NOT EXISTS course_excluded_students (
      course_id TEXT NOT NULL REFERENCES courses(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      PRIMARY KEY (course_id, student_id)
    );
  `,
};

const MIGRATION_011: Migration = {
  id: '011',
  description: 'Add session_absences so students can be marked absent for a session',
  sql: `
    CREATE TABLE IF NOT EXISTS session_absences (
      session_id TEXT NOT NULL REFERENCES sessions(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      PRIMARY KEY (session_id, student_id)
    );
  `,
};

const MIGRATION_012: Migration = {
  id: '012',
  description: 'Add session_student_notes so a student can get a general note for a session',
  sql: `
    CREATE TABLE IF NOT EXISTS session_student_notes (
      session_id TEXT NOT NULL REFERENCES sessions(id),
      student_id TEXT NOT NULL REFERENCES students(id),
      text TEXT NOT NULL,
      PRIMARY KEY (session_id, student_id)
    );
  `,
};

const ALL_MIGRATIONS: Migration[] = [MIGRATION_001, MIGRATION_002, MIGRATION_003, MIGRATION_004, MIGRATION_005, MIGRATION_006, MIGRATION_007, MIGRATION_008, MIGRATION_009, MIGRATION_010, MIGRATION_011, MIGRATION_012];

export const KNOWN_MIGRATION_IDS: readonly string[] = ALL_MIGRATIONS.map((m) => m.id);

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
