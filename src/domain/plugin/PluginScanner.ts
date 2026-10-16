import { PluginManifest } from './PluginManifest';

export type PluginSource = 'bundled' | 'user';

export type ScannedPlugin =
  | {
      status: 'ok';
      source: PluginSource;
      /** Absolute path of the plugin folder. */
      directory: string;
      manifest: PluginManifest;
      /** True when this user plugin replaced a bundled plugin with the same id. */
      overrides: boolean;
    }
  | {
      status: 'faulty';
      source: PluginSource;
      directory: string;
      /** Folder name; the manifest may be unreadable, so there is no reliable id. */
      name: string;
      error: string;
    };

export interface PluginScanner {
  scan(): Promise<ScannedPlugin[]>;
}
