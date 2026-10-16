import { PluginPermission } from './PluginPermission';

/** What the user decided about a plugin on this machine. Not part of the database: it follows the machine, not the data. */
export interface PluginConsent {
  enabled: boolean;
  /** The permissions the user accepted when enabling. A plugin that now asks for more needs consent again. */
  grantedPermissions: PluginPermission[];
  /** The network origins (`https://host[:port]`, normalised) the user accepted. Same rule as the permissions. */
  grantedNetwork: string[];
}

export interface PluginConsentStore {
  get(pluginId: string): PluginConsent | undefined;
  set(pluginId: string, consent: PluginConsent): void;
}
