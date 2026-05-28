import { BrowserWindow, session } from 'electron';
import path from 'node:path';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/preload.js'),
      webSecurity: true,
    },
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
        ],
      },
    });
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('grdr://')) {
      event.preventDefault();
    }
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  return win;
}
