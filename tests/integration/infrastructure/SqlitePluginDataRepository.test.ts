import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import { SqlitePluginDataRepository } from '../../../src/infrastructure/persistence/SqlitePluginDataRepository';
import { PluginId } from '../../../src/domain/plugin/PluginId';
import type { Db } from '../../../src/infrastructure/persistence/db';

const aPluginId = (raw = 'at.example.tool'): PluginId => {
  const result = PluginId.create(raw);
  if (!result.ok) throw new Error('PluginId creation failed');
  return result.value;
};

const NOW = new Date('2026-10-12T10:00:00.000Z');
const LATER = new Date('2026-10-12T11:30:00.000Z');

describe('SqlitePluginDataRepository', () => {
  let db: Db;
  let repo: SqlitePluginDataRepository;
  const tool = aPluginId('at.example.tool');
  const other = aPluginId('at.example.other');

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqlitePluginDataRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('get and set', () => {
    it('returns null for a key that was never written', async () => {
      expect(await repo.get(tool, 'course-1', 'counts')).toBeNull();
    });

    it('returns the stored value', async () => {
      await repo.set(tool, 'course-1', 'counts', '{"s-1":2}', NOW);

      expect(await repo.get(tool, 'course-1', 'counts')).toBe('{"s-1":2}');
    });

    it('replaces the value and the timestamp when a key is written again', async () => {
      await repo.set(tool, 'course-1', 'counts', '1', NOW);
      await repo.set(tool, 'course-1', 'counts', '2', LATER);

      expect(await repo.get(tool, 'course-1', 'counts')).toBe('2');
      const row = db.prepare('SELECT updated_at FROM plugin_data').get() as { updated_at: string };
      expect(row.updated_at).toBe(LATER.toISOString());
      expect(db.prepare('SELECT COUNT(*) AS cnt FROM plugin_data').get()).toEqual({ cnt: 1 });
    });
  });

  describe('isolation', () => {
    it('keeps the same key of different plugins apart', async () => {
      await repo.set(tool, 'course-1', 'counts', 'tool', NOW);
      await repo.set(other, 'course-1', 'counts', 'other', NOW);

      expect(await repo.get(tool, 'course-1', 'counts')).toBe('tool');
      expect(await repo.get(other, 'course-1', 'counts')).toBe('other');
    });

    it('keeps the same key of different courses apart', async () => {
      await repo.set(tool, 'course-1', 'counts', 'one', NOW);
      await repo.set(tool, 'course-2', 'counts', 'two', NOW);

      expect(await repo.get(tool, 'course-1', 'counts')).toBe('one');
      expect(await repo.get(tool, 'course-2', 'counts')).toBe('two');
    });

    it('keeps the plugin-global scope apart from course scopes', async () => {
      await repo.set(tool, '', 'settings', 'global', NOW);
      await repo.set(tool, 'course-1', 'settings', 'course', NOW);

      expect(await repo.get(tool, '', 'settings')).toBe('global');
      expect(await repo.get(tool, 'course-1', 'settings')).toBe('course');
    });
  });

  describe('delete', () => {
    it('removes only the given key', async () => {
      await repo.set(tool, 'course-1', 'a', '1', NOW);
      await repo.set(tool, 'course-1', 'b', '2', NOW);

      await repo.delete(tool, 'course-1', 'a');

      expect(await repo.get(tool, 'course-1', 'a')).toBeNull();
      expect(await repo.get(tool, 'course-1', 'b')).toBe('2');
    });

    it('does nothing for a key that does not exist', async () => {
      await expect(repo.delete(tool, 'course-1', 'missing')).resolves.toBeUndefined();
    });

    it('does not remove the key of another plugin', async () => {
      await repo.set(other, 'course-1', 'a', '1', NOW);

      await repo.delete(tool, 'course-1', 'a');

      expect(await repo.get(other, 'course-1', 'a')).toBe('1');
    });
  });

  describe('keys', () => {
    beforeEach(async () => {
      await repo.set(tool, 'course-1', 'pick:b', '1', NOW);
      await repo.set(tool, 'course-1', 'pick:a', '1', NOW);
      await repo.set(tool, 'course-1', 'settings', '1', NOW);
      await repo.set(tool, 'course-2', 'pick:z', '1', NOW);
      await repo.set(other, 'course-1', 'pick:x', '1', NOW);
    });

    it('lists the keys of one plugin and course in alphabetical order', async () => {
      expect(await repo.keys(tool, 'course-1')).toEqual(['pick:a', 'pick:b', 'settings']);
    });

    it('lists only keys starting with the prefix', async () => {
      expect(await repo.keys(tool, 'course-1', 'pick:')).toEqual(['pick:a', 'pick:b']);
    });

    it('treats LIKE wildcards in the prefix literally', async () => {
      await repo.set(tool, 'course-1', 'a%b', '1', NOW);
      await repo.set(tool, 'course-1', 'a_b', '1', NOW);
      await repo.set(tool, 'course-1', 'axb', '1', NOW);

      expect(await repo.keys(tool, 'course-1', 'a%')).toEqual(['a%b']);
      expect(await repo.keys(tool, 'course-1', 'a_')).toEqual(['a_b']);
    });

    it('returns an empty list when nothing matches', async () => {
      expect(await repo.keys(tool, 'course-1', 'nope')).toEqual([]);
    });
  });
});
