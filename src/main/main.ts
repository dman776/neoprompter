import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { createCore, type Command } from '../core';
import { IPC } from '../shared/ipc';

const core = createCore();
const windows = new Set<BrowserWindow>();

function openWindow(page: 'operator' | 'output', title: string, x: number): void {
  const win = new BrowserWindow({
    title,
    x,
    y: 60,
    width: 640,
    height: 480,
    backgroundColor: page === 'output' ? '#000000' : '#202020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', page, 'index.html'));
  windows.add(win);
  win.on('closed', () => windows.delete(win));
}

app.whenReady().then(() => {
  ipcMain.handle(IPC.getState, () => core.getState());
  ipcMain.on(IPC.command, (_e, command: Command) => core.dispatch(command));

  // Broadcast on command changes, plus a steady tick so scrolling is visible.
  const broadcast = () => {
    const state = core.getState();
    windows.forEach((w) => w.webContents.send(IPC.state, state));
  };
  core.subscribe(broadcast);
  setInterval(() => {
    if (core.getState().playing) broadcast();
  }, 16);

  // Windowed Output: both windows are ordinary windows (the full-screen Output comes later).
  openWindow('operator', 'Neoprompter - Operator view', 40);
  openWindow('output', 'Neoprompter - Output (windowed)', 720);
});

app.on('window-all-closed', () => app.quit());
