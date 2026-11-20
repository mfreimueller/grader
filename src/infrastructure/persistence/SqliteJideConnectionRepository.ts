import type { JideConnectionRepository, StoredJideConnection } from '../../domain/jide/JideConnectionRepository';
import type { Db } from './db';

export class SqliteJideConnectionRepository implements JideConnectionRepository {
  constructor(private readonly db: Db) {}

  async get(): Promise<StoredJideConnection | null> {
    const row = this.db.prepare('SELECT base_url, api_key FROM jide_connection WHERE id = 1').get() as
      | { base_url: string; api_key: Buffer }
      | undefined;
    return row ? { baseUrl: row.base_url, encryptedKey: new Uint8Array(row.api_key) } : null;
  }

  async save(baseUrl: string, encryptedKey: Uint8Array | null, updatedAt: Date): Promise<void> {
    if (encryptedKey === null) {
      this.db
        .prepare('UPDATE jide_connection SET base_url = ?, updated_at = ? WHERE id = 1')
        .run(baseUrl, updatedAt.toISOString());
      return;
    }
    this.db
      .prepare(
        `INSERT INTO jide_connection (id, base_url, api_key, updated_at) VALUES (1, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET base_url = excluded.base_url, api_key = excluded.api_key, updated_at = excluded.updated_at`,
      )
      .run(baseUrl, Buffer.from(encryptedKey), updatedAt.toISOString());
  }

  async clear(): Promise<void> {
    this.db.prepare('DELETE FROM jide_connection').run();
  }
}
