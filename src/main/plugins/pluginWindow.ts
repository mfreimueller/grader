import { BrowserWindow, session, type Session } from 'electron';
import path from 'node:path';
import type { CreatePluginWindowOptions, PluginWindowHandle } from './PluginLauncher';
import { installPluginProtocol } from './pluginProtocol';
import { isAllowedPluginRequest, isOwnPluginUrl, pluginUrl } from './pluginFiles';

/**
 * A plugin gets no device permissions, and reaches the network only at the origins the user granted (see
 * pluginCsp); every other request is cancelled here as well, whatever the page's policy says.
 */
function hardenPluginSession(pluginSession: Session, pluginId: string, grantedNetwork: readonly string[]): void {
  pluginSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  pluginSession.setPermissionCheckHandler(() => false);
  pluginSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedPluginRequest(details.url, pluginId, grantedNetwork) });
  });
}

/**
 * Opens a plugin in its own sandboxed window on its own session: same hardening as the main window, but with
 * the plugin preload (window.grader only) instead of the full app API.
 */
export function createPluginWindow(options: CreatePluginWindowOptions, parent: BrowserWindow): PluginWindowHandle {
  const pluginId = options.manifest.id.value;
  const partition = `persist:plugin-${pluginId}`;
  const pluginSession = session.fromPartition(partition);
  hardenPluginSession(pluginSession, pluginId, options.grantedNetwork);
  installPluginProtocol(pluginSession, pluginId, options.directory, options.grantedNetwork);

  const win = new BrowserWindow({
    width: options.manifest.window.width,
    height: options.manifest.window.height,
    title: options.title,
    parent,
    webPreferences: {
      partition,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // This file compiles to build/main/main/plugins/, the preloads to build/main/preload/.
      preload: path.join(__dirname, '../../preload/plugin-preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  // Read now: the web contents is gone once the window is closed.
  const webContentsId = win.webContents.id;

  win.webContents.on('will-navigate', (event, url) => {
    if (!isOwnPluginUrl(url, pluginId)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // The window is named after the plugin and the course, not after whatever the page calls itself.
  win.on('page-title-updated', (event) => event.preventDefault());

  void win.loadURL(pluginUrl(pluginId, options.manifest.entry));

  return {
    webContentsId,
    focus: () => {
      if (win.isMinimized()) win.restore();
      win.focus();
    },
    onClosed: (listener) => {
      win.on('closed', listener);
    },
  };
}
