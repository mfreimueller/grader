import { app } from 'electron';
import { createMainWindow } from './window';

app.on('ready', () => {
  const win = createMainWindow();
  win.loadFile('build/renderer/index.html');
});

app.on('window-all-closed', () => {
  app.quit();
});
