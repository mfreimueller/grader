import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqliteCourseRepository } from '../../../src/infrastructure/persistence/SqliteCourseRepository';
import { SqliteSchoolClassRepository } from '../../../src/infrastructure/persistence/SqliteSchoolClassRepository';
import { SqliteCourseRosterRepository } from '../../../src/infrastructure/persistence/SqliteCourseRosterRepository';
import { SqlitePluginDataRepository } from '../../../src/infrastructure/persistence/SqlitePluginDataRepository';
import { CourseService } from '../../../src/application/CourseService';
import {
  PluginStorageService,
  MAX_VALUE_BYTES,
} from '../../../src/application/PluginStorageService';
import { PluginPermissionDeniedError, PluginCaller } from '../../../src/application/PluginCaller';
import { PluginManifest } from '../../../src/domain/plugin/PluginManifest';
import { Course } from '../../../src/domain/grade/Course';
import { SchoolClass } from '../../../src/domain/student/SchoolClass';
import { SchoolYear } from '../../../src/domain/student/SchoolYear';
import { NotFoundError, ValidationError } from '../../../src/shared/errors';
import type { Db } from '../../../src/infrastructure/persistence/db';
import type { Result } from '../../../src/domain/shared/Result';

const aCaller = (overrides: { id?: string; courseId?: string; permissions?: string[] } = {}): PluginCaller => {
  const manifest = PluginManifest.create({
    id: overrides.id ?? 'at.example.tool',
    name: 'Tool',
    version: '1.0.0',
    apiVersion: 1,
    entry: 'index.html',
    launch: ['course'],
    permissions: overrides.permissions ?? ['storage'],
    network: [],
  });
  if (!manifest.ok) throw manifest.error;
  return { manifest: manifest.value, courseId: overrides.courseId ?? 'course-1' };
};

function valueOf<T>(result: Result<T>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

describe('PluginStorageService', () => {
  let db: Db;
  let service: PluginStorageService;
  const NOW = new Date('2026-10-12T10:00:00.000Z');

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);

    const classRepo = new SqliteSchoolClassRepository(db);
    const courseRepo = new SqliteCourseRepository(db);
    const year = SchoolYear.create('2025/26');
    if (!year.ok) throw year.error;
    const schoolClass = new SchoolClass('class-1', '1A', year.value);
    classRepo.save(schoolClass);
    courseRepo.save(Course.create('course-1', 'Mathematik', schoolClass));
    courseRepo.save(Course.create('course-2', 'Physik', schoolClass));

    const courseService = new CourseService(courseRepo, classRepo, new SqliteCourseRosterRepository(db));
    service = new PluginStorageService(new SqlitePluginDataRepository(db), courseService, () => NOW);
  });

  afterEach(() => {
    db.close();
  });

  describe('permission', () => {
    const caller = aCaller({ permissions: ['course:read'] });

    it.each([
      ['get', () => service.get(caller, 'course', 'k')],
      ['set', () => service.set(caller, 'course', 'k', 1)],
      ['delete', () => service.delete(caller, 'course', 'k')],
      ['keys', () => service.keys(caller, 'course')],
    ])('denies %s without the storage permission', async (_name, call) => {
      const result = await call();

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(PluginPermissionDeniedError);
    });

    it('does not write anything when denied', async () => {
      await service.set(caller, 'global', 'k', 1);

      expect(db.prepare('SELECT COUNT(*) AS cnt FROM plugin_data').get()).toEqual({ cnt: 0 });
    });
  });

  describe('get and set', () => {
    it('returns null for a key that was never written', async () => {
      expect(valueOf(await service.get(aCaller(), 'course', 'missing'))).toBeNull();
    });

    it.each([
      ['an object', { 's-1': 2, 's-2': 0 }],
      ['an array', [1, 'two', null]],
      ['a string', 'hallo'],
      ['a number', 42.5],
      ['true', true],
      ['false', false],
      ['an empty string', ''],
      ['zero', 0],
    ])('round-trips %s', async (_label, value) => {
      await service.set(aCaller(), 'course', 'k', value);

      expect(valueOf(await service.get(aCaller(), 'course', 'k'))).toEqual(value);
    });

    it('overwrites an existing value', async () => {
      await service.set(aCaller(), 'course', 'k', 1);
      await service.set(aCaller(), 'course', 'k', 2);

      expect(valueOf(await service.get(aCaller(), 'course', 'k'))).toBe(2);
    });

    it('stamps the write with the current time', async () => {
      await service.set(aCaller(), 'course', 'k', 1);

      expect(db.prepare('SELECT updated_at FROM plugin_data').get()).toEqual({
        updated_at: NOW.toISOString(),
      });
    });

    it('fails with a ValidationError when the stored value is not valid JSON', async () => {
      db.prepare(
        "INSERT INTO plugin_data (plugin_id, course_id, key, value, updated_at) VALUES ('at.example.tool', 'course-1', 'k', '{oops', 'x')",
      ).run();

      const result = await service.get(aCaller(), 'course', 'k');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    });
  });

  describe('scopes', () => {
    it('keeps the same key of different plugins apart', async () => {
      await service.set(aCaller({ id: 'at.example.tool' }), 'course', 'k', 'tool');
      await service.set(aCaller({ id: 'at.example.other' }), 'course', 'k', 'other');

      expect(valueOf(await service.get(aCaller({ id: 'at.example.tool' }), 'course', 'k'))).toBe('tool');
      expect(valueOf(await service.get(aCaller({ id: 'at.example.other' }), 'course', 'k'))).toBe('other');
    });

    it('keeps the course scope of different courses apart', async () => {
      await service.set(aCaller({ courseId: 'course-1' }), 'course', 'k', 'one');
      await service.set(aCaller({ courseId: 'course-2' }), 'course', 'k', 'two');

      expect(valueOf(await service.get(aCaller({ courseId: 'course-1' }), 'course', 'k'))).toBe('one');
      expect(valueOf(await service.get(aCaller({ courseId: 'course-2' }), 'course', 'k'))).toBe('two');
    });

    it('shares the global scope between the courses of one plugin', async () => {
      await service.set(aCaller({ courseId: 'course-1' }), 'global', 'k', 'shared');

      expect(valueOf(await service.get(aCaller({ courseId: 'course-2' }), 'global', 'k'))).toBe('shared');
    });

    it('keeps the global scope of different plugins apart', async () => {
      await service.set(aCaller({ id: 'at.example.tool' }), 'global', 'k', 'tool');

      expect(valueOf(await service.get(aCaller({ id: 'at.example.other' }), 'global', 'k'))).toBeNull();
    });

    it('keeps the global scope apart from the course scope', async () => {
      await service.set(aCaller(), 'global', 'k', 'global');

      expect(valueOf(await service.get(aCaller(), 'course', 'k'))).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the key', async () => {
      await service.set(aCaller(), 'course', 'k', 1);

      await service.delete(aCaller(), 'course', 'k');

      expect(valueOf(await service.get(aCaller(), 'course', 'k'))).toBeNull();
    });

    it('succeeds for a key that does not exist', async () => {
      expect((await service.delete(aCaller(), 'course', 'missing')).ok).toBe(true);
    });
  });

  describe('keys', () => {
    it('lists the keys of the scope sorted, optionally by prefix', async () => {
      await service.set(aCaller(), 'course', 'pick:b', 1);
      await service.set(aCaller(), 'course', 'pick:a', 1);
      await service.set(aCaller(), 'course', 'specials', 1);
      await service.set(aCaller(), 'global', 'other', 1);

      expect(valueOf(await service.keys(aCaller(), 'course'))).toEqual(['pick:a', 'pick:b', 'specials']);
      expect(valueOf(await service.keys(aCaller(), 'course', 'pick:'))).toEqual(['pick:a', 'pick:b']);
      expect(valueOf(await service.keys(aCaller(), 'global'))).toEqual(['other']);
    });

    it('rejects a prefix with characters a key cannot have', async () => {
      const result = await service.keys(aCaller(), 'course', 'a b');

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    });
  });

  describe('key validation', () => {
    it.each(['', 'a b', 'a/b', 'ä', 'a'.repeat(129), 'k\n'])('rejects the key %p', async (key) => {
      for (const result of [
        await service.get(aCaller(), 'course', key),
        await service.set(aCaller(), 'course', key, 1),
        await service.delete(aCaller(), 'course', key),
      ]) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it.each(['a', 'pick:s-1', 'v1.counts_total', 'a'.repeat(128)])('accepts the key %p', async (key) => {
      expect((await service.set(aCaller(), 'course', key, 1)).ok).toBe(true);
    });
  });

  describe('value validation', () => {
    it.each([
      ['undefined', undefined],
      ['a function', () => 1],
      ['a symbol', Symbol('x')],
    ])('rejects %s', async (_label, value) => {
      const result = await service.set(aCaller(), 'course', 'k', value);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    });

    it('rejects a circular structure', async () => {
      const circular: Record<string, unknown> = {};
      circular['self'] = circular;

      const result = await service.set(aCaller(), 'course', 'k', circular);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    });

    it('rejects a BigInt', async () => {
      expect((await service.set(aCaller(), 'course', 'k', BigInt(1))).ok).toBe(false);
    });

    it('accepts a value of exactly the size limit', async () => {
      const value = 'a'.repeat(MAX_VALUE_BYTES - 2); // the two quotes of the JSON string count too

      expect((await service.set(aCaller(), 'course', 'k', value)).ok).toBe(true);
    });

    it('rejects a value one byte over the size limit', async () => {
      const value = 'a'.repeat(MAX_VALUE_BYTES - 1);

      const result = await service.set(aCaller(), 'course', 'k', value);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.message).toMatch(/256 KiB/);
    });

    it('counts bytes, not characters', async () => {
      const value = 'ä'.repeat(MAX_VALUE_BYTES / 2); // half as many characters, but 2 bytes each

      expect((await service.set(aCaller(), 'course', 'k', value)).ok).toBe(false);
    });

    it('does not store a rejected value', async () => {
      await service.set(aCaller(), 'course', 'k', 'ok');

      await service.set(aCaller(), 'course', 'k', undefined);

      expect(valueOf(await service.get(aCaller(), 'course', 'k'))).toBe('ok');
    });
  });

  describe('course that does not exist', () => {
    const gone = aCaller({ courseId: 'gone' });

    it.each([
      ['get', () => service.get(gone, 'course', 'k')],
      ['set', () => service.set(gone, 'course', 'k', 1)],
      ['delete', () => service.delete(gone, 'course', 'k')],
      ['keys', () => service.keys(gone, 'course')],
    ])('fails %s in the course scope with NotFoundError', async (_name, call) => {
      const result = await call();

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    });

    it('does not leave plugin data behind for it', async () => {
      await service.set(gone, 'course', 'k', 1);

      expect(db.prepare('SELECT COUNT(*) AS cnt FROM plugin_data').get()).toEqual({ cnt: 0 });
    });

    it('still serves the global scope', async () => {
      expect((await service.set(gone, 'global', 'k', 1)).ok).toBe(true);
      expect(valueOf(await service.get(gone, 'global', 'k'))).toBe(1);
    });
  });
});
