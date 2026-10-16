import type { PluginConsent, PluginConsentStore } from '../../domain/plugin/PluginConsentStore';
import { parseNetworkOrigin } from '../../domain/plugin/PluginNetworkOrigin';
import { PluginPermission, parsePluginPermission } from '../../domain/plugin/PluginPermission';
import type { Settings } from '../settings';

/** Keeps the plugin decisions in settings.json. The file is hand-editable, so everything read from it is checked. */
export class SettingsPluginConsentStore implements PluginConsentStore {
  constructor(
    private readonly load: () => Settings,
    private readonly save: (settings: Settings) => void,
  ) {}

  get(pluginId: string): PluginConsent | undefined {
    const plugins = this.load().plugins;
    if (!plugins || !Object.hasOwn(plugins, pluginId)) return undefined;

    const entry: unknown = plugins[pluginId];
    if (typeof entry !== 'object' || entry === null) return undefined;
    const { enabled, grantedPermissions, grantedNetwork } = entry as {
      enabled?: unknown;
      grantedPermissions?: unknown;
      grantedNetwork?: unknown;
    };
    if (typeof enabled !== 'boolean' || !Array.isArray(grantedPermissions)) return undefined;

    const granted: PluginPermission[] = [];
    for (const raw of grantedPermissions as unknown[]) {
      const permission = typeof raw === 'string' ? parsePluginPermission(raw) : undefined;
      if (permission?.ok) granted.push(permission.value);
    }
    return { enabled, grantedPermissions: granted, grantedNetwork: readOrigins(grantedNetwork) };
  }

  set(pluginId: string, consent: PluginConsent): void {
    const settings = this.load();
    this.save({
      ...settings,
      plugins: {
        ...settings.plugins,
        [pluginId]: {
          ...consent,
          grantedPermissions: [...consent.grantedPermissions],
          grantedNetwork: [...consent.grantedNetwork],
        },
      },
    });
  }
}

/** Settings from before network access existed have no list: nothing was granted. */
function readOrigins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const origins: string[] = [];
  for (const entry of raw as unknown[]) {
    const origin = typeof entry === 'string' ? parseNetworkOrigin(entry) : undefined;
    if (origin?.ok && !origins.includes(origin.value)) origins.push(origin.value);
  }
  return origins;
}
