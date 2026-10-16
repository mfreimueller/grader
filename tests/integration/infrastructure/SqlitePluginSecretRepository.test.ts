import { PluginId } from '../../../src/domain/plugin/PluginId';
import { createInMemoryDb, runMigrations } from '../../../src/infrastructure/persistence/db';
import type { Db } from '../../../src/infrastructure/persistence/db';
import { SqlitePluginSecretRepository } from '../../../src/infrastructure/persistence/SqlitePluginSecretRepository';

const aPluginId = (raw: string): PluginId => {
  const result = PluginId.create(raw);
  if (!result.ok) throw new Error('PluginId creation failed');
  return result.value;
};

const NOW = new Date('2026-10-14T10:00:00.000Z');
const LATER = new Date('2026-10-14T11:00:00.000Z');

describe('SqlitePluginSecretRepository', () => {
  let db: Db;
  let repo: SqlitePluginSecretRepository;
  const tool = aPluginId('at.example.tool');
  const other = aPluginId('at.example.other');
  const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);

  beforeEach(() => {
    db = createInMemoryDb();
    runMigrations(db);
    repo = new SqlitePluginSecretRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns null for a key that was never written', async () => {
    expect(await repo.get(tool, 'token')).toBeNull();
  });

  it('returns the stored bytes unchanged, including zero bytes', async () => {
    await repo.set(tool, 'token', bytes(0, 255, 1, 0, 128), NOW);

    expect([...((await repo.get(tool, 'token')) ?? [])]).toEqual([0, 255, 1, 0, 128]);
  });

  it('stores the value as a BLOB', async () => {
    await repo.set(tool, 'token', bytes(1, 2, 3), NOW);

    expect(db.prepare('SELECT typeof(value) AS t FROM plugin_secrets').get()).toEqual({ t: 'blob' });
  });

  it('replaces the value and the timestamp when a key is written again', async () => {
    await repo.set(tool, 'token', bytes(1), NOW);
    await repo.set(tool, 'token', bytes(2), LATER);

    expect([...((await repo.get(tool, 'token')) ?? [])]).toEqual([2]);
    expect(db.prepare('SELECT COUNT(*) AS cnt FROM plugin_secrets').get()).toEqual({ cnt: 1 });
    expect(db.prepare('SELECT updated_at FROM plugin_secrets').get()).toEqual({ updated_at: LATER.toISOString() });
  });

  it('keeps the secrets of different plugins and keys apart', async () => {
    await repo.set(tool, 'token', bytes(1), NOW);
    await repo.set(tool, 'other', bytes(2), NOW);
    await repo.set(other, 'token', bytes(3), NOW);

    expect([...((await repo.get(tool, 'token')) ?? [])]).toEqual([1]);
    expect([...((await repo.get(other, 'token')) ?? [])]).toEqual([3]);
  });

  it('deletes one secret', async () => {
    await repo.set(tool, 'token', bytes(1), NOW);
    await repo.set(tool, 'other', bytes(2), NOW);

    await repo.delete(tool, 'token');

    expect(await repo.get(tool, 'token')).toBeNull();
    expect(await repo.get(tool, 'other')).not.toBeNull();
  });

  it('deletes all secrets of one plugin and leaves the others', async () => {
    await repo.set(tool, 'token', bytes(1), NOW);
    await repo.set(tool, 'other', bytes(2), NOW);
    await repo.set(other, 'token', bytes(3), NOW);

    await repo.deleteAllOf(tool);

    expect(await repo.get(tool, 'token')).toBeNull();
    expect(await repo.get(tool, 'other')).toBeNull();
    expect(await repo.get(other, 'token')).not.toBeNull();
  });
});
