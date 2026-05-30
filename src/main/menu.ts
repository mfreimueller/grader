import { app, Menu, BrowserWindow, dialog, type MenuItemConstructorOptions } from 'electron';
import { IPC } from '../shared/ipc-channels';

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
