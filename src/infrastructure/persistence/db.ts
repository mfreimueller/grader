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

// Sessions used to get a shared "Mündlich" assessment (id `<session>:muendlich`). Mitarbeit is now recorded as
// one impromptu "Mitarbeit" assessment per result, so every result of such a column moves to its own assessment.
const MIGRATION_013: Migration = {
  id: '013',
  description: 'Split the auto-created Mündlich assessments into one impromptu Mitarbeit assessment per result',
  sql: `
    INSERT INTO assessments (id, title, category_id, course_id, is_impromptu, max_points, session_id)
      SELECT p.id || ':mitarbeit', 'Mitarbeit', a.category_id, a.course_id, 1, NULL, a.session_id
      FROM student_performances p
      JOIN assessments a ON p.assessment_id = a.id
      WHERE a.id = a.session_id || ':muendlich' AND a.is_impromptu = 0
      ORDER BY p.rowid;

    UPDATE student_performances SET assessment_id = id || ':mitarbeit'
      WHERE assessment_id IN (SELECT id FROM assessments WHERE id = session_id || ':muendlich' AND is_impromptu = 0);

    DELETE FROM assessments WHERE id = session_id || ':muendlich' AND is_impromptu = 0;
  `,
};

// Neither table has a foreign key on purpose. plugin_data.course_id '' is the plugin-global scope. And
// SqliteSessionRepository.save writes assessments with INSERT OR REPLACE, which deletes the old row first: an
// ON DELETE CASCADE from plugin_assessments would wipe the ownership of every earlier assessment of a session each
// time another one is added. The rows of a course are removed explicitly in SqliteCourseRepository.hardDelete; a row
// left behind by an assessment the teacher deleted is harmless (PluginHostService.deleteImpromptu cleans it up).
const MIGRATION_014: Migration = {
  id: '014',
  description: 'Add plugin_data key-value store and plugin_assessments for assessments created by plugins',
  sql: `
    CREATE TABLE IF NOT EXISTS plugin_data (
      plugin_id TEXT NOT NULL,
      course_id TEXT NOT NULL DEFAULT '',
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (plugin_id, course_id, key)
    );

    CREATE TABLE IF NOT EXISTS plugin_assessments (
      assessment_id TEXT PRIMARY KEY,
      plugin_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `,
};

// Encrypted by the application (Electron safeStorage), so the value is an opaque BLOB that only decrypts on the
// machine and user that wrote it: a backup restored elsewhere keeps the rows but needs the secrets set again.
// plugin_id has no foreign key, like plugin_data: plugins are not rows of the database.
const MIGRATION_015: Migration = {
  id: '015',
  description: 'Add plugin_secrets for encrypted plugin secrets such as access tokens',
  sql: `
    CREATE TABLE IF NOT EXISTS plugin_secrets (
      plugin_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value BLOB NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (plugin_id, key)
    );
  `,
};

// The J;DE connection (Gradeflow source J;DE). The API key is encrypted by the application (Electron safeStorage), like
// plugin_secrets: a backup restored on another machine keeps the rows but needs the key entered again. The links are
// confirmed by the teacher and removed together with the course or student they belong to.
const MIGRATION_016: Migration = {
  id: '016',
  description: 'Add the J;DE connection and the links between Grader and J;DE courses and students',
  sql: `
    CREATE TABLE IF NOT EXISTS jide_connection (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      base_url TEXT NOT NULL,
      api_key BLOB NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jide_course_links (
      course_id TEXT PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
      jide_course_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jide_student_links (
      student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      jide_student_id TEXT NOT NULL
    );
  `,
};

const ALL_MIGRATIONS: Migration[] = [MIGRATION_001, MIGRATION_002, MIGRATION_003, MIGRATION_004, MIGRATION_005, MIGRATION_006, MIGRATION_007, MIGRATION_008, MIGRATION_009, MIGRATION_010, MIGRATION_011, MIGRATION_012, MIGRATION_013, MIGRATION_014, MIGRATION_015, MIGRATION_016];

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
