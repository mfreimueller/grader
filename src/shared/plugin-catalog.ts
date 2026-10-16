/** What the Grader UI (renderer) knows about an installed plugin. Plain data for IPC. */

export type PluginStatus =
  /** Can be launched. */
  | 'enabled'
  /** Valid, but switched off (user plugins start here). */
  | 'disabled'
  /** Enabled earlier, but the plugin now asks for permissions the user has not accepted. */
  | 'needs-consent'
  /** The manifest or the files are broken; see `error`. */
  | 'faulty';

export interface PluginInfo {
  /** Null for a faulty plugin whose manifest could not be read. */
  id: string | null;
  /** The folder name, which names a faulty plugin. */
  directoryName: string;
  name: string;
  version: string;
  description: string;
  source: 'bundled' | 'user';
  /** True when this user plugin replaced a bundled one with the same id. */
  overrides: boolean;
  status: PluginStatus;
  permissions: string[];
  /** The https origins the plugin wants to connect to, e.g. `https://api.github.com`. */
  network: string[];
  /** Where the plugin can be launched from. */
  launch: string[];
  error: string | null;
}
