import type { PluginCatalogService } from '../../application/PluginCatalogService';
import { IPC } from '../../shared/ipc-channels';
import type { PluginLauncher } from '../plugins/PluginLauncher';
import type { PluginWindowRegistry } from '../plugins/PluginWindowRegistry';
import type { IpcMainLike } from './pluginHost.ipc';
import { launchPluginSchema, setPluginEnabledSchema } from './pluginSchemas';

export interface PluginIpcDeps {
  catalog: Pick<PluginCatalogService, 'list' | 'launchableFor' | 'setEnabled'>;
  launcher: Pick<PluginLauncher, 'launch'>;
  registry: Pick<PluginWindowRegistry<unknown>, 'callerFor'>;
  openUserPluginFolder(): Promise<void>;
}

/**
 * What the Grader UI does with plugins: list, switch on and off, launch. Plugin windows have no access to this;
 * they only get the bridge in pluginHost.ipc.ts, and a window that somehow reached these channels is refused.
 */
export function registerPluginHandlers(ipc: IpcMainLike, deps: PluginIpcDeps): void {
  const { catalog, launcher, registry } = deps;

  function forGrader(channel: string, run: (payload: unknown) => unknown): void {
    ipc.handle(channel, (event, payload) => {
      if (registry.callerFor(event.sender.id)) throw new Error('Not available to plugins');
      return run(payload);
    });
  }

  forGrader(IPC.PLUGIN_LIST, () => catalog.list());
  forGrader(IPC.PLUGIN_LAUNCHABLE, () => catalog.launchableFor('course'));
  forGrader(IPC.PLUGIN_SET_ENABLED, (payload) => {
    const { pluginId, enabled, acceptedPermissions, acceptedNetwork } = setPluginEnabledSchema.parse(payload);
    return catalog.setEnabled(pluginId, enabled, acceptedPermissions, acceptedNetwork);
  });
  forGrader(IPC.PLUGIN_LAUNCH, (payload) => {
    const { pluginId, courseId } = launchPluginSchema.parse(payload);
    return launcher.launch(pluginId, courseId);
  });
  forGrader(IPC.PLUGIN_OPEN_FOLDER, () => deps.openUserPluginFolder());
}
