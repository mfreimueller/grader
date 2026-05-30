import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { saveSettings } from '../settings';
import { resolveDbPath } from '../config';

export function registerSettingsHandlers(win: BrowserWindow): void {
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
}
