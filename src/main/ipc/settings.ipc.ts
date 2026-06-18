import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { loadSettings, saveSettings } from '../settings';
import { resolveDbPath } from '../config';
import type { GraderMcpServer } from '../../mcp/mcpServer';

export function registerSettingsHandlers(win: BrowserWindow, mcpServer?: GraderMcpServer): void {
  ipcMain.handle(IPC.SETTINGS_GET_DB_PATH, () => {
    return resolveDbPath();
  });

  ipcMain.handle(IPC.SETTINGS_PICK_DB_PATH, async () => {
    const result = await dialog.showSaveDialog(win, {
      defaultPath: 'grdr.db',
      filters: [{ name: 'Datenbank', extensions: ['db'] }],
      properties: ['createDirectory'],
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  ipcMain.handle(IPC.SETTINGS_SAVE_DB_PATH, async (_event, path: string) => {
    saveSettings({ dbPath: path });
  });

  ipcMain.handle(IPC.SETTINGS_RESTART_APP, () => {
    app.relaunch();
    app.quit();
  });

  ipcMain.handle(IPC.MCP_GET_URL, () => {
    return mcpServer?.url ?? null;
  });

  ipcMain.handle(IPC.MCP_GET_SETTINGS, () => {
    const settings = loadSettings();
    return {
      enabled: settings.mcpEnabled ?? false,
      port: settings.mcpPort ?? 43882,
    };
  });

  ipcMain.handle(IPC.MCP_SET_ENABLED, async (_event, enabled: boolean) => {
    if (!mcpServer) return;
    if (enabled) {
      if (!mcpServer.running) {
        await mcpServer.start();
        win.webContents.send(IPC.MCP_STATUS_CHANGE, {
          running: true,
          url: mcpServer.url,
        });
      }
    } else {
      if (mcpServer.running) {
        await mcpServer.stop();
        win.webContents.send(IPC.MCP_STATUS_CHANGE, {
          running: false,
          url: null,
        });
      }
    }
    const settings = loadSettings();
    saveSettings({ ...settings, mcpEnabled: enabled });
  });
}
