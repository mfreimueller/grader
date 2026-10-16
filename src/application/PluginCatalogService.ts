import path from 'node:path';
import { PluginConsentStore } from '../domain/plugin/PluginConsentStore';
import { PluginLaunchTarget, PluginManifest } from '../domain/plugin/PluginManifest';
import type { PluginScanner, ScannedPlugin } from '../domain/plugin/PluginScanner';
import { Result } from '../domain/shared/Result';
import { NotFoundError, ValidationError } from '../shared/errors';
import type { PluginInfo, PluginStatus } from '../shared/plugin-catalog';

type OkPlugin = Extract<ScannedPlugin, { status: 'ok' }>;

export interface ResolvedPlugin {
  manifest: PluginManifest;
  /** Absolute path of the plugin folder. */
  directory: string;
  /** The network origins the plugin may actually connect to: what its manifest asks for and the user accepted. */
  grantedNetwork: string[];
}

/**
 * Which plugins are installed and which of them the user allows to run.
 * Bundled plugins are first-party and run unless switched off. A user plugin runs only after the user accepted
 * exactly the permissions it asks for, and again whenever an update asks for more.
 */
export class PluginCatalogService {
  constructor(
    private readonly scanner: PluginScanner,
    private readonly consent: PluginConsentStore,
  ) {}

  async list(): Promise<PluginInfo[]> {
    const infos = (await this.scanner.scan()).map((plugin) => this.toInfo(plugin));
    return infos.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
  }

  /**
   * Switches a plugin on or off. Enabling a user plugin needs the permissions the user was shown
   * (`acceptedPermissions`) and network origins (`acceptedNetwork`) to match its manifest exactly, in case the
   * plugin changed since.
   */
  async setEnabled(
    pluginId: string,
    enabled: boolean,
    acceptedPermissions: string[],
    acceptedNetwork: string[] = [],
  ): Promise<Result<PluginInfo>> {
    const plugin = await this.find(pluginId);
    if (!plugin) return Result.fail(new NotFoundError('Plugin', pluginId));

    const permissions = [...plugin.manifest.permissions];
    const network = [...plugin.manifest.network];
    if (
      enabled &&
      plugin.source === 'user' &&
      !(sameSet(acceptedPermissions, permissions) && sameSet(acceptedNetwork, network))
    ) {
      return Result.fail(new ValidationError('The permissions of the plugin changed; please review them again'));
    }

    const previous = this.consent.get(pluginId);
    this.consent.set(pluginId, {
      enabled,
      grantedPermissions: enabled ? permissions : (previous?.grantedPermissions ?? []),
      grantedNetwork: enabled ? network : (previous?.grantedNetwork ?? []),
    });
    return Result.ok(this.toInfo(plugin));
  }

  async launchableFor(target: PluginLaunchTarget): Promise<PluginInfo[]> {
    return (await this.list()).filter((info) => info.status === 'enabled' && info.launch.includes(target));
  }

  /** The plugin to run, only when it is enabled. */
  async resolve(pluginId: string): Promise<Result<ResolvedPlugin>> {
    const plugin = await this.find(pluginId);
    if (!plugin) return Result.fail(new NotFoundError('Plugin', pluginId));
    if (this.statusOf(plugin) !== 'enabled') {
      return Result.fail(new ValidationError(`Plugin ${pluginId} is not enabled`));
    }
    return Result.ok({
      manifest: plugin.manifest,
      directory: plugin.directory,
      grantedNetwork: this.grantedNetworkOf(plugin),
    });
  }

  private async find(pluginId: string): Promise<OkPlugin | undefined> {
    const plugins = await this.scanner.scan();
    return plugins.find((p): p is OkPlugin => p.status === 'ok' && p.manifest.id.value === pluginId);
  }

  private statusOf(plugin: OkPlugin): PluginStatus {
    const decision = this.consent.get(plugin.manifest.id.value);
    if (plugin.source === 'bundled') return decision?.enabled === false ? 'disabled' : 'enabled';
    if (!decision?.enabled) return 'disabled';
    const accepted =
      plugin.manifest.permissions.every((p) => decision.grantedPermissions.includes(p)) &&
      plugin.manifest.network.every((origin) => decision.grantedNetwork.includes(origin));
    return accepted ? 'enabled' : 'needs-consent';
  }

  /** Manifest and consent must both name an origin; a bundled plugin is first-party and gets what it asks for. */
  private grantedNetworkOf(plugin: OkPlugin): string[] {
    if (plugin.source === 'bundled') return [...plugin.manifest.network];
    const granted = this.consent.get(plugin.manifest.id.value)?.grantedNetwork ?? [];
    return plugin.manifest.network.filter((origin) => granted.includes(origin));
  }

  private toInfo(plugin: ScannedPlugin): PluginInfo {
    const directoryName = path.basename(plugin.directory);
    if (plugin.status === 'faulty') {
      return {
        id: null,
        directoryName,
        name: plugin.name,
        version: '',
        description: '',
        source: plugin.source,
        overrides: false,
        status: 'faulty',
        permissions: [],
        network: [],
        launch: [],
        error: plugin.error,
      };
    }
    const { manifest } = plugin;
    return {
      id: manifest.id.value,
      directoryName,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      source: plugin.source,
      overrides: plugin.overrides,
      status: this.statusOf(plugin),
      permissions: [...manifest.permissions],
      network: [...manifest.network],
      launch: [...manifest.launch],
      error: null,
    };
  }
}

function sameSet(accepted: string[], required: string[]): boolean {
  const set = new Set(accepted);
  return set.size === required.length && required.every((p) => set.has(p));
}
