import { PluginId } from './PluginId';

/**
 * Secrets of one plugin, shared by all its courses. The values are already encrypted opaque bytes: the
 * repository never sees plain text.
 */
export interface PluginSecretRepository {
  get(pluginId: PluginId, key: string): Promise<Uint8Array | null>;
  set(pluginId: PluginId, key: string, value: Uint8Array, updatedAt: Date): Promise<void>;
  delete(pluginId: PluginId, key: string): Promise<void>;
  /** Everything of one plugin, for when the plugin's data is purged. */
  deleteAllOf(pluginId: PluginId): Promise<void>;
}
