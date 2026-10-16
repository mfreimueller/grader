import type { Db } from './db';
import type { PluginDataRepository } from '../../domain/plugin/PluginDataRepository';
import type { PluginId } from '../../domain/plugin/PluginId';

export class SqlitePluginDataRepository implements PluginDataRepository {
  constructor(private readonly db: Db) {}

  async get(pluginId: PluginId, courseId: string, key: string): Promise<string | null> {
    const row = this.db
      .prepare('SELECT value FROM plugin_data WHERE plugin_id = ? AND course_id = ? AND key = ?')
      .get(pluginId.value, courseId, key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  async set(pluginId: PluginId, courseId: string, key: string, value: string, updatedAt: Date): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO plugin_data (plugin_id, course_id, key, value, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (plugin_id, course_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(pluginId.value, courseId, key, value, updatedAt.toISOString());
  }

  async delete(pluginId: PluginId, courseId: string, key: string): Promise<void> {
    this.db
      .prepare('DELETE FROM plugin_data WHERE plugin_id = ? AND course_id = ? AND key = ?')
      .run(pluginId.value, courseId, key);
  }

  async keys(pluginId: PluginId, courseId: string, prefix = ''): Promise<string[]> {
    // substr instead of LIKE: a prefix such as "a%" or "a_" must match literally.
    const rows = this.db
      .prepare(
        `SELECT key FROM plugin_data
         WHERE plugin_id = ? AND course_id = ? AND substr(key, 1, ?) = ?
         ORDER BY key`,
      )
      .all(pluginId.value, courseId, [...prefix].length, prefix) as { key: string }[];
    return rows.map((row) => row.key);
  }
}
