import Database from 'better-sqlite3';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateDbFile } from '../../../src/infrastructure/persistence/dbFileValidation';
import { runMigrations } from '../../../src/infrastructure/persistence/db';

describe('validateDbFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'grdr-validate-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const createGraderDb = (name: string): string => {
    const path = join(dir, name);
    const db = new Database(path);
    runMigrations(db);
    db.close();
    return path;
  };

  it('accepts a migrated grader database', () => {
    const result = validateDbFile(createGraderDb('ok.db'));

    expect(result.ok).toBe(true);
  });

  it('rejects a path that does not exist', () => {
    const result = validateDbFile(join(dir, 'missing.db'));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('nicht gefunden');
  });

  it('rejects a file that is not a SQLite database', () => {
    const path = join(dir, 'text.db');
    writeFileSync(path, 'this is not sqlite');

    const result = validateDbFile(path);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('keine SQLite-Datenbank');
  });

  it('rejects a SQLite database that is not a grader database', () => {
    const path = join(dir, 'other.db');
    const db = new Database(path);
    db.exec('CREATE TABLE unrelated (id INTEGER)');
    db.close();

    const result = validateDbFile(path);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('keine grader-Datenbank');
  });

  it('rejects a database migrated by a newer app version', () => {
    const path = createGraderDb('newer.db');
    const db = new Database(path);
    db.prepare('INSERT INTO _migrations (id) VALUES (?)').run('999');
    db.close();

    const result = validateDbFile(path);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('neueren Version');
  });

  it('accepts an older database that still needs migrations', () => {
    const path = join(dir, 'old.db');
    const db = new Database(path);
    db.exec(`CREATE TABLE school_classes (id TEXT PRIMARY KEY, name TEXT, school_year TEXT);
             CREATE TABLE _migrations (id TEXT PRIMARY KEY, applied_at TEXT);
             INSERT INTO _migrations (id) VALUES ('001');`);
    db.close();

    expect(validateDbFile(path).ok).toBe(true);
  });
});
