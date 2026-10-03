import Database from 'better-sqlite3';
import { closeSync, existsSync, openSync, readSync } from 'node:fs';
import { Result } from '../../domain/shared/Result';
import { ValidationError } from '../../shared/errors';
import { KNOWN_MIGRATION_IDS } from './db';

const SQLITE_HEADER = 'SQLite format 3\0';

function hasSqliteHeader(path: string): boolean {
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(SQLITE_HEADER.length);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    return bytesRead === buffer.length && buffer.toString('latin1') === SQLITE_HEADER;
  } finally {
    closeSync(fd);
  }
}

export function validateDbFile(path: string): Result<void> {
  if (!existsSync(path)) {
    return Result.fail(new ValidationError('Datei nicht gefunden.'));
  }
  if (!hasSqliteHeader(path)) {
    return Result.fail(new ValidationError('Die Datei ist keine SQLite-Datenbank.'));
  }

  let db: Database.Database;
  try {
    db = new Database(path, { readonly: true, fileMustExist: true });
  } catch {
    return Result.fail(new ValidationError('Die Datenbank kann nicht geöffnet werden.'));
  }

  try {
    const tables = new Set(
      (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
        .map((row) => row.name),
    );
    if (!tables.has('school_classes')) {
      return Result.fail(new ValidationError('Die Datei ist keine grader-Datenbank.'));
    }
    if (tables.has('_migrations')) {
      const applied = (db.prepare('SELECT id FROM _migrations').all() as { id: string }[]).map((row) => row.id);
      if (applied.some((id) => !KNOWN_MIGRATION_IDS.includes(id))) {
        return Result.fail(
          new ValidationError('Die Datenbank stammt von einer neueren Version von grader. Bitte aktualisieren Sie die Anwendung.'),
        );
      }
    }
    return Result.ok(undefined as void);
  } catch {
    return Result.fail(new ValidationError('Die Datenbank kann nicht gelesen werden.'));
  } finally {
    db.close();
  }
}
