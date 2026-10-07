import { app, Menu, BrowserWindow, dialog, type MenuItemConstructorOptions } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { openDatabaseViaDialog } from './ipc/settings.ipc';

async function openDatabaseFromMenu(win: BrowserWindow): Promise<void> {
  const result = await openDatabaseViaDialog(win);
  if (!result) return;
  if (!result.ok) {
    dialog.showErrorBox('Datenbank konnte nicht geöffnet werden', result.error.message);
    return;
  }
  if (!result.value.changed) return;
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    message: 'Die Anwendung muss neu gestartet werden, um die Datenbank zu verwenden.',
    buttons: ['Jetzt neu starten', 'Später'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) {
    app.relaunch();
    app.quit();
  }
}

export function createAppMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Datenbank öffnen…',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            void openDatabaseFromMenu(win);
          },
        },
        {
          label: 'Einstellungen…',
          click: () => win.webContents.send(IPC.SHOW_SETTINGS),
        },
        { type: 'separator' as const },
        {
          label: 'Beenden',
          accelerator: isMac ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { type: 'separator' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        {
          label: 'Entwicklerwerkzeuge',
          accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => win.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Fenster',
      submenu: [
        { role: 'minimize' as const },
        { role: 'close' as const },
      ],
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Über Grader',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'Über Grader',
              message: 'Grader',
              detail: 'Benotungsanwendung nach LBVO\nVersion ' + app.getVersion(),
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
