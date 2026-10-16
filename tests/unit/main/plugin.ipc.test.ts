import type { PluginCatalogService } from '../../../src/application/PluginCatalogService';
import { Result } from '../../../src/domain/shared/Result';
import { registerPluginHandlers } from '../../../src/main/ipc/plugin.ipc';
import type { IpcMainLike } from '../../../src/main/ipc/pluginHost.ipc';
import type { PluginLauncher } from '../../../src/main/plugins/PluginLauncher';
import { PluginWindowRegistry } from '../../../src/main/plugins/PluginWindowRegistry';
import { PluginManifest } from '../../../src/domain/plugin/PluginManifest';
import { IPC } from '../../../src/shared/ipc-channels';
import type { PluginInfo } from '../../../src/shared/plugin-catalog';

const MAIN_WINDOW = 1;
const PLUGIN_WINDOW = 7;

const anInfo = (): PluginInfo => ({
  id: 'at.example.tool',
  directoryName: 'tool',
  name: 'Tool',
  version: '1.0.0',
  description: '',
  source: 'user',
  overrides: false,
  status: 'enabled',
  permissions: [],
  network: [],
  launch: ['course'],
  error: null,
});

class FakeIpcMain implements IpcMainLike {
  private readonly handlers = new Map<string, Parameters<IpcMainLike['handle']>[1]>();
  handle(channel: string, listener: Parameters<IpcMainLike['handle']>[1]): void {
    this.handlers.set(channel, listener);
  }
  channels(): string[] {
    return [...this.handlers.keys()];
  }
  invoke(channel: string, senderId: number, payload?: unknown): unknown {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`no handler for ${channel}`);
    return handler({ sender: { id: senderId } }, payload);
  }
}

describe('registerPluginHandlers', () => {
  let ipc: FakeIpcMain;
  let catalog: jest.Mocked<Pick<PluginCatalogService, 'list' | 'launchableFor' | 'setEnabled'>>;
  let launcher: jest.Mocked<Pick<PluginLauncher, 'launch'>>;
  let openedFolder: number;

  beforeEach(() => {
    ipc = new FakeIpcMain();
    catalog = { list: jest.fn(), launchableFor: jest.fn(), setEnabled: jest.fn() };
    launcher = { launch: jest.fn() };
    openedFolder = 0;

    const manifest = PluginManifest.create({
      id: 'at.example.tool',
      name: 'Tool',
      version: '1.0.0',
      apiVersion: 1,
      entry: 'index.html',
      launch: ['course'],
      permissions: [],
      network: [],
    });
    if (!manifest.ok) throw manifest.error;
    const registry = new PluginWindowRegistry<unknown>();
    registry.register(PLUGIN_WINDOW, { manifest: manifest.value, courseId: 'course-1' }, {});

    registerPluginHandlers(ipc, {
      catalog,
      launcher,
      registry,
      openUserPluginFolder: () => {
        openedFolder += 1;
        return Promise.resolve();
      },
    });
  });

  it('handles every management channel', () => {
    expect(ipc.channels().sort()).toEqual(
      [IPC.PLUGIN_LIST, IPC.PLUGIN_LAUNCHABLE, IPC.PLUGIN_SET_ENABLED, IPC.PLUGIN_LAUNCH, IPC.PLUGIN_OPEN_FOLDER].sort(),
    );
  });

  it('lists the installed plugins', async () => {
    catalog.list.mockResolvedValue([anInfo()]);

    expect(await ipc.invoke(IPC.PLUGIN_LIST, MAIN_WINDOW)).toEqual([anInfo()]);
  });

  it('lists the plugins that can be started from a course', async () => {
    catalog.launchableFor.mockResolvedValue([anInfo()]);

    expect(await ipc.invoke(IPC.PLUGIN_LAUNCHABLE, MAIN_WINDOW)).toEqual([anInfo()]);
    expect(catalog.launchableFor).toHaveBeenCalledWith('course');
  });

  it('switches a plugin on with the permissions the user accepted', async () => {
    catalog.setEnabled.mockResolvedValue(Result.ok(anInfo()));

    const result = await ipc.invoke(IPC.PLUGIN_SET_ENABLED, MAIN_WINDOW, {
      pluginId: 'at.example.tool',
      enabled: true,
      acceptedPermissions: ['storage'],
    });

    expect(catalog.setEnabled).toHaveBeenCalledWith('at.example.tool', true, ['storage'], []);
    expect(result).toEqual({ ok: true, value: anInfo() });
  });

  it('passes on the network origins the user accepted', async () => {
    catalog.setEnabled.mockResolvedValue(Result.ok(anInfo()));

    await ipc.invoke(IPC.PLUGIN_SET_ENABLED, MAIN_WINDOW, {
      pluginId: 'at.example.tool',
      enabled: true,
      acceptedPermissions: [],
      acceptedNetwork: ['https://api.github.com'],
    });

    expect(catalog.setEnabled).toHaveBeenCalledWith('at.example.tool', true, [], ['https://api.github.com']);
  });

  it('launches a plugin for a course', async () => {
    launcher.launch.mockResolvedValue(Result.ok(undefined as void));

    const result = await ipc.invoke(IPC.PLUGIN_LAUNCH, MAIN_WINDOW, { pluginId: 'at.example.tool', courseId: 'course-1' });

    expect(launcher.launch).toHaveBeenCalledWith('at.example.tool', 'course-1');
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it('opens the folder for user plugins', async () => {
    await ipc.invoke(IPC.PLUGIN_OPEN_FOLDER, MAIN_WINDOW);

    expect(openedFolder).toBe(1);
  });

  it.each([
    [IPC.PLUGIN_SET_ENABLED, { pluginId: '', enabled: true, acceptedPermissions: [] }],
    [IPC.PLUGIN_SET_ENABLED, { pluginId: 'x', enabled: 'yes', acceptedPermissions: [] }],
    [IPC.PLUGIN_SET_ENABLED, { pluginId: 'x', enabled: true }],
    [IPC.PLUGIN_LAUNCH, { pluginId: 'x' }],
    [IPC.PLUGIN_LAUNCH, undefined],
  ])('rejects the invalid payload for %s', async (channel, payload) => {
    await expect(Promise.resolve().then(() => ipc.invoke(channel, MAIN_WINDOW, payload))).rejects.toBeDefined();

    expect(catalog.setEnabled).not.toHaveBeenCalled();
    expect(launcher.launch).not.toHaveBeenCalled();
  });

  describe('a plugin window', () => {
    it.each([
      [IPC.PLUGIN_LIST, undefined],
      [IPC.PLUGIN_LAUNCHABLE, undefined],
      [IPC.PLUGIN_SET_ENABLED, { pluginId: 'at.example.tool', enabled: true, acceptedPermissions: [] }],
      [IPC.PLUGIN_LAUNCH, { pluginId: 'at.example.tool', courseId: 'course-1' }],
      [IPC.PLUGIN_OPEN_FOLDER, undefined],
    ])('cannot use %s', async (channel, payload) => {
      await expect(Promise.resolve().then(() => ipc.invoke(channel, PLUGIN_WINDOW, payload))).rejects.toThrow(
        'Not available to plugins',
      );

      expect(catalog.list).not.toHaveBeenCalled();
      expect(catalog.setEnabled).not.toHaveBeenCalled();
      expect(launcher.launch).not.toHaveBeenCalled();
      expect(openedFolder).toBe(0);
    });
  });
});
