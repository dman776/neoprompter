import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron';
import { importDocx } from '../import';
import fs from 'node:fs';
import path from 'node:path';
import { createCore, lineText, type Command } from '../core';
import { createFileLibraryStorage } from '../library';
import { IPC } from '../shared/ipc';
import { createFilePresetStore } from './filePresetStore';
import { createFileSessionStore } from './fileSessionStore';
import { createOutputWindowManager, type OutputSettings } from '../output-window';

function createLibraryStorage() {
  const file = path.join(app.getPath('userData'), 'library.json');
  return createFileLibraryStorage(file, {
    readFile: (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null),
    writeFile: (p, d) => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, d);
    },
  });
}

const core = createCore({
  libraryStorage: createLibraryStorage(),
  presetStore: createFilePresetStore(path.join(app.getPath('userData'), 'presets.json')),
  sessionStore: createFileSessionStore(path.join(app.getPath('userData'), 'session.json')),
});
const windows = new Set<BrowserWindow>();
let operatorWin: BrowserWindow | null = null;
let outputWin: BrowserWindow | null = null;

function openWindow(
  page: 'operator' | 'output',
  title: string,
  x: number,
  extra: Electron.BrowserWindowConstructorOptions = {},
): BrowserWindow {
  const win = new BrowserWindow({
    title,
    x,
    y: 60,
    width: 640,
    height: 480,
    ...extra,
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
  return win;
}

function closeOutput(): void {
  outputWin?.close();
  outputWin = null;
}

function createOutputManager() {
  const file = path.join(app.getPath('userData'), 'output-settings.json');
  return createOutputWindowManager({
    displays: {
      list: () =>
        screen.getAllDisplays().map((d) => ({ id: String(d.id), bounds: d.bounds })),
      operatorDisplayId: () =>
        String(
          operatorWin && !operatorWin.isDestroyed()
            ? screen.getDisplayMatching(operatorWin.getBounds()).id
            : screen.getPrimaryDisplay().id,
        ),
    },
    store: {
      load: (): OutputSettings => {
        try {
          return JSON.parse(fs.readFileSync(file, 'utf8')) as OutputSettings;
        } catch {
          return { windowed: false, monitorBySetup: {} };
        }
      },
      save: (s) => fs.writeFileSync(file, JSON.stringify(s)),
    },
    host: {
      // Only ever one Output window: reuse it, otherwise create it.
      show: (placement) => {
        closeOutput();
        if (placement.mode === 'fullscreen') {
          outputWin = openWindow('output', 'Neoprompter - Output', placement.bounds.x, {
            ...placement.bounds,
            frame: false,
            fullscreen: true,
          });
        } else {
          outputWin = openWindow('output', 'Neoprompter - Output (windowed)', 720);
        }
      },
      hide: closeOutput,
    },
  });
}

app.whenReady().then(() => {
  ipcMain.handle(IPC.getState, () => core.getState());
  ipcMain.on(IPC.command, (_e, command: Command) => core.dispatch(command));
  ipcMain.handle(IPC.importScript, async () => {
    const picked = await dialog.showOpenDialog({
      title: 'Import Script',
      properties: ['openFile'],
      filters: [{ name: 'Word document', extensions: ['docx'] }],
    });
    if (picked.canceled || picked.filePaths.length === 0) return null;
    const file = picked.filePaths[0];
    const name = path.basename(file);
    let bytes: Uint8Array;
    try {
      bytes = fs.readFileSync(file);
    } catch {
      return { ok: false, message: `"${name}" could not be read.` };
    }
    const result = importDocx(bytes, name);
    if (!result.ok) return result;
    const { script } = result;
    core.dispatch({
      type: 'saveScript',
      name: script.name,
      text: script.lines.map(lineText).join('\n'),
      lines: script.lines,
    });
    return { ok: true, message: `Imported "${script.name}" into the library.` };
  });

  // Broadcast on command changes, plus a steady tick so scrolling is visible.
  const broadcast = () => {
    const state = core.getState();
    windows.forEach((w) => w.webContents.send(IPC.state, state));
  };
  core.subscribe(broadcast);
  setInterval(() => {
    if (core.getState().playing) broadcast();
  }, 16);

  operatorWin = openWindow('operator', 'Neoprompter - Operator view', 40);

  // The Output opens full screen on the chosen monitor; with it missing it stays closed.
  const output = createOutputManager();
  ipcMain.handle(IPC.outputGetView, () => output.getView());
  ipcMain.handle(IPC.outputChooseMonitor, (_e, id: string) => {
    output.chooseMonitor(id);
    return output.getView();
  });
  ipcMain.handle(IPC.outputSetWindowed, (_e, windowed: boolean) => {
    output.setWindowed(windowed);
    return output.getView();
  });
  screen.on('display-added', () => output.refresh());
  screen.on('display-removed', () => output.refresh());
  screen.on('display-metrics-changed', () => output.refresh());
  output.refresh();
});

app.on('window-all-closed', () => app.quit());
