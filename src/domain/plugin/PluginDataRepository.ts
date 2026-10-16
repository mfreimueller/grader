import { PluginId } from './PluginId';

/**
 * Key-value store of one plugin. `courseId` scopes a value to a course; the empty string
 * is the plugin-global scope. Values are opaque JSON strings.
 */
export interface PluginDataRepository {
  get(pluginId: PluginId, courseId: string, key: string): Promise<string | null>;
  set(pluginId: PluginId, courseId: string, key: string, value: string, updatedAt: Date): Promise<void>;
  delete(pluginId: PluginId, courseId: string, key: string): Promise<void>;
  keys(pluginId: PluginId, courseId: string, prefix?: string): Promise<string[]>;
}
