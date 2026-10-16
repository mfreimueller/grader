import type { Db } from './db';
import type { PluginId } from '../../domain/plugin/PluginId';
import type { PluginSecretRepository } from '../../domain/plugin/PluginSecretRepository';

export class SqlitePluginSecretRepository implements PluginSecretRepository {
  constructor(private readonly db: Db) {}

  async get(pluginId: PluginId, key: string): Promise<Uint8Array | null> {
    const row = this.db
      .prepare('SELECT value FROM plugin_secrets WHERE plugin_id = ? AND key = ?')
      .get(pluginId.value, key) as { value: Buffer } | undefined;
    return row ? new Uint8Array(row.value) : null;
  }

  async set(pluginId: PluginId, key: string, value: Uint8Array, updatedAt: Date): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO plugin_secrets (plugin_id, key, value, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (plugin_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(pluginId.value, key, Buffer.from(value), updatedAt.toISOString());
  }

  async delete(pluginId: PluginId, key: string): Promise<void> {
    this.db.prepare('DELETE FROM plugin_secrets WHERE plugin_id = ? AND key = ?').run(pluginId.value, key);
  }

  async deleteAllOf(pluginId: PluginId): Promise<void> {
    this.db.prepare('DELETE FROM plugin_secrets WHERE plugin_id = ?').run(pluginId.value);
  }
}
