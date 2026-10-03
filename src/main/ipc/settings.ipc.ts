import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { loadSettings, saveSettings } from '../settings';
import { resolveDbPath } from '../config';
import { withDbPath } from '../settings-update';
import { validateDbFile } from '../../infrastructure/persistence/dbFileValidation';
import type { ResultDto } from '../../shared/types';
import type { GraderMcpServer } from '../../mcp/mcpServer';

/** Lets the user pick an existing database, validates it and stores its path. null = dialog cancelled. */
export async function openDatabaseViaDialog(
  win: BrowserWindow,
): Promise<ResultDto<{ path: string; changed: boolean }> | null> {
  const picked = await dialog.showOpenDialog(win, {
    filters: [{ name: 'Datenbank', extensions: ['db'] }],
    properties: ['openFile'],
  });
  const path = picked.filePaths[0];
  if (picked.canceled || !path) return null;

  const validation = validateDbFile(path);
  if (!validation.ok) {
    return { ok: false, error: { name: validation.error.name, message: validation.error.message } };
  }

  const update = withDbPath(loadSettings(), path);
  if (update.changed) saveSettings(update.settings);
  return { ok: true, value: { path, changed: update.changed } };
}

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

  ipcMain.handle(IPC.SETTINGS_SAVE_DB_PATH, async (_event, path: string): Promise<boolean> => {
    const update = withDbPath(loadSettings(), path);
    if (update.changed) saveSettings(update.settings);
    return update.changed;
  });

  ipcMain.handle(IPC.SETTINGS_OPEN_DB, () => openDatabaseViaDialog(win));

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
