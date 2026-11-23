import { app, BrowserWindow, dialog, ipcMain, Menu, screen } from 'electron';
import { importDocument } from '../import';
import fs from 'node:fs';
import path from 'node:path';
import { createCore, lineText, outputState, type Command, type CoreState } from '../core';
import { createFileLibraryStorage } from '../library';
import { IPC } from '../shared/ipc';
import { createFilePresetStore } from './filePresetStore';
import { createFileSessionStore } from './fileSessionStore';
import { createJsonFile, libraryFileIo } from './jsonFile';
import { createApiController } from './apiController';
import { createFileQuickMessageStore } from './fileQuickMessageStore';
import { createFileApiSettingsStore } from './fileApiSettingsStore';
import {
  buildMenuTemplate,
  createWindowHost,
  type MenuAction,
  type MenuItemSpec,
} from '../window-host';
import { createOutputWindowManager, type OutputSettings } from '../output-window';

// Tests (e2e/) point the app at a throwaway data directory so they never touch the real library.
if (process.env.NEOPROMPTER_USER_DATA) {
  app.setPath('userData', process.env.NEOPROMPTER_USER_DATA);
}

function createLibraryStorage() {
  const file = path.join(app.getPath('userData'), 'library.json');
  return createFileLibraryStorage(file, libraryFileIo);
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
  page: 'operator' | 'output' | 'preferences' | 'shuttle',
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
    backgroundColor: page === 'output' ? '#000000' : '#0a0d11',
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
      list: () => screen.getAllDisplays().map((d) => ({ id: String(d.id), bounds: d.bounds })),
      operatorDisplayId: () =>
        String(
          operatorWin && !operatorWin.isDestroyed()
            ? screen.getDisplayMatching(operatorWin.getBounds()).id
            : screen.getPrimaryDisplay().id,
        ),
    },
    store: (() => {
      const json = createJsonFile<OutputSettings>(file, {
        fallback: () => ({ windowed: false, monitorBySetup: {} }),
      });
      return { load: json.read, save: json.write };
    })(),
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
  // Notifications are Operator-only: the Output window only ever receives `outputState`.
  const stateFor = (contents: Electron.WebContents, state: CoreState) =>
    outputWin && contents === outputWin.webContents ? outputState(state) : state;
  ipcMain.handle(IPC.getState, (e) => stateFor(e.sender, core.getState()));
  ipcMain.on(IPC.command, (_e, command: Command) => core.dispatch(command));
  ipcMain.handle(IPC.importScript, async () => {
    const picked = await dialog.showOpenDialog({
      title: 'Import Script',
      properties: ['openFile'],
      filters: [{ name: 'Word document', extensions: ['docx', 'doc'] }],
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
    const result = importDocument(bytes, name);
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
    windows.forEach((w) => w.webContents.send(IPC.state, stateFor(w.webContents, state)));
  };
  let hadNotifications = false;
  core.subscribe(broadcast);
  setInterval(() => {
    const s = core.getState();
    // Notifications expire with the clock, so keep broadcasting until the last one is gone.
    const has = s.notifications.length > 0;
    if (s.playing || s.ringDeflection !== 0 || has || hadNotifications) broadcast();
    hadNotifications = has;
  }, 16);

  const api = createApiController(
    core,
    createFileApiSettingsStore(path.join(app.getPath('userData'), 'api-settings.json')),
    createFileQuickMessageStore(path.join(app.getPath('userData'), 'quick-messages.json')),
  );
  ipcMain.handle(IPC.apiGet, () => api.getView());
  ipcMain.handle(IPC.apiSet, (_e, settings) => api.apply(settings));
  void api.startup();
  app.on('will-quit', () => void api.stop());

  operatorWin = openWindow('operator', 'Neoprompter - Operator view', 40);

  // Preferences and the Virtual shuttle: one window each, and none open at launch.
  const windowHost = createWindowHost({
    create: (kind) => {
      const win =
        kind === 'preferences'
          ? openWindow('preferences', 'Neoprompter - Preferences', 120, { width: 720, height: 520 })
          : openWindow('shuttle', 'Neoprompter - Virtual shuttle', 200, {
              width: 360,
              height: 420,
            });
      return { focus: () => win.focus(), onClosed: (l) => win.on('closed', l) };
    },
  });
  const perform = (action: MenuAction) => {
    if (action.type === 'dispatch') core.dispatch(action.command);
    else if (action.type === 'open-window') windowHost.open(action.window);
    else if (operatorWin && !operatorWin.isDestroyed()) {
      operatorWin.webContents.send(IPC.menuAction, action.action);
    }
  };
  const toElectron = (item: MenuItemSpec): Electron.MenuItemConstructorOptions => ({
    label: item.label,
    accelerator: item.accelerator,
    role: item.role as Electron.MenuItemConstructorOptions['role'],
    type: item.type,
    submenu: item.submenu?.map(toElectron),
    click: item.action ? () => perform(item.action!) : undefined,
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildMenuTemplate(
        process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux',
      ).map(toElectron),
    ),
  );

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
  // The Output window follows the core's Output switch, which is Off at every launch.
  core.subscribe((state) => output.setOutputOn(state.outputOn));
  screen.on('display-added', () => output.refresh());
  screen.on('display-removed', () => output.refresh());
  screen.on('display-metrics-changed', () => output.refresh());
  output.refresh();
});

app.on('window-all-closed', () => app.quit());
