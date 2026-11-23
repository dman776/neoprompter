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
import { createFileWatchedFolderStore } from './fileWatchedFolderStore';
import { createWatchedFolderSettings, importWatchedFolder } from '../watched-folder';
import { watchedFolderFs } from './watchedFolderFs';
import { createFileApiSettingsStore } from './fileApiSettingsStore';
import { createFileButtonMappingStore } from './fileButtonMappingStore';
import { createInputService, type ActionId, type ButtonId, type DeviceEvent } from '../input';
import {
  buildMenuTemplate,
  createWindowHost,
  type MenuAction,
  type MenuItemSpec,
} from '../window-host';
import { createOutputWindowManager, type OutputSettings } from '../output-window';
import { chooseWorkArea, windowBounds, type BoundsKind } from '../window-host/bounds';
import { createFileWindowStateStore } from './fileWindowStateStore';

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
  if (page === 'output') {
    // Esc is also caught here, before the page sees it, so it works even if the page's own key
    // handler cannot (the page is still loading, or something else has the keyboard).
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape' && win === outputWin) {
        leaveOutputFullscreen();
      }
    });
  }
  windows.add(win);
  win.on('closed', () => windows.delete(win));
  return win;
}

// Windows open sized for their content and the screen, and come back where the Operator left them.
const windowState = createFileWindowStateStore(
  path.join(app.getPath('userData'), 'window-state.json'),
);

function openPlaced(
  kind: BoundsKind,
  page: 'operator' | 'output' | 'preferences' | 'shuttle',
  title: string,
): BrowserWindow {
  const saved = windowState.load()[kind] ?? null;
  const displays = [screen.getPrimaryDisplay(), ...screen.getAllDisplays()].filter(
    (d, i, all) => all.findIndex((o) => o.id === d.id) === i,
  );
  const { bounds, minWidth, minHeight } = windowBounds(
    kind,
    chooseWorkArea(
      displays.map((d) => d.workArea),
      saved,
    ),
    saved,
  );
  const win = openWindow(page, title, bounds.x, { ...bounds, minWidth, minHeight });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const remember = () => {
    clearTimeout(timer);
    if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return;
    windowState.save({ ...windowState.load(), [kind]: win.getNormalBounds() });
  };
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(remember, 500);
  };
  win.on('resize', later);
  win.on('move', later);
  win.on('close', remember);
  return win;
}

/**
 * Resolves when every Output window that was retired has finished closing. On macOS a full screen
 * window leaves its Space in steps, and a window created in the meantime is pulled into that
 * Space (it comes up full screen at the display's size), so a new Output waits for this.
 */
let outputGone: Promise<void> = Promise.resolve();

/** Set once the Output manager exists: Esc on the Output asks it to leave full screen. */
let exitOutputFullscreen: () => void = () => {};

/**
 * Esc on the Output. A full screen Output (the monitor placement) becomes an ordinary window; and
 * an Output window the Operator made full screen themselves (the green button, a shortcut) goes
 * back to its window. Either way it is still the one Output, still on.
 */
function leaveOutputFullscreen(): void {
  exitOutputFullscreen();
  // The first case retires the window; whatever is left and full screen is the second case.
  if (outputWin && !outputWin.isDestroyed() && outputWin.isFullScreen()) {
    outputWin.setFullScreen(false);
  }
}

/** Counts show/hide requests, so a late finish never opens a window nobody wants any more. */
let showSequence = 0;

/** Closes the Output window: out of full screen first, and only then closed. */
function retireOutput(): void {
  const win = outputWin;
  outputWin = null;
  if (!win || win.isDestroyed()) return;
  const closed = new Promise<void>((resolve) => win.once('closed', () => resolve()));
  outputGone = Promise.all([outputGone, closed]).then(() => undefined);
  if (win.isFullScreen()) {
    win.once('leave-full-screen', () => win.close());
    win.setFullScreen(false);
    // If the system never says it has left full screen, do not wait for ever.
    const giveUp = setTimeout(() => !win.isDestroyed() && win.close(), 3000);
    win.once('closed', () => clearTimeout(giveUp));
  } else {
    win.close();
  }
}

function createOutputManager() {
  const file = path.join(app.getPath('userData'), 'output-settings.json');
  return createOutputWindowManager({
    displays: {
      list: () => {
        const real = screen.getAllDisplays().map((d) => ({ id: String(d.id), bounds: d.bounds }));
        // Tests (e2e/) pretend a second display exists, on top of the real one, so a genuine full
        // screen Output can be opened on a machine with a single display.
        return process.env.NEOPROMPTER_FAKE_SECOND_DISPLAY
          ? [...real, { id: 'fake-second', bounds: { ...real[0]!.bounds } }]
          : real;
      },
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
      // Only ever one Output window: the old one goes first, then the new one opens.
      show: (placement) => {
        const mine = ++showSequence;
        retireOutput();
        void outputGone.then(() => {
          if (mine !== showSequence) return; // a newer show, or a hide, took over
          if (placement.mode === 'fullscreen') {
            outputWin = openWindow('output', 'Neoprompter - Output', placement.bounds.x, {
              ...placement.bounds,
              frame: false,
              fullscreen: true,
            });
          } else {
            outputWin = openPlaced('output-windowed', 'output', 'Neoprompter - Output (windowed)');
          }
        });
      },
      hide: () => {
        showSequence++;
        retireOutput();
      },
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
    // Run mode freezes the library (the core would reject the save), so say so plainly.
    if (core.getState().mode !== 'edit') {
      return { ok: false, message: 'Import is only available in Edit mode.' };
    }
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

  // The Watched folder setting (Preferences). Nothing watches the folder yet.
  const watchedFolder = createWatchedFolderSettings({
    store: createFileWatchedFolderStore(path.join(app.getPath('userData'), 'watched-folder.json')),
    pickFolder: async () => {
      const picked = await dialog.showOpenDialog({
        title: 'Choose the Watched folder',
        properties: ['openDirectory', 'createDirectory'],
      });
      return picked.canceled || picked.filePaths.length === 0 ? null : picked.filePaths[0];
    },
  });
  ipcMain.handle(IPC.watchedFolderGet, () => watchedFolder.getView());
  ipcMain.handle(IPC.watchedFolderChoose, () => watchedFolder.choose());
  ipcMain.handle(IPC.watchedFolderClear, () => watchedFolder.clear());
  // Files that arrived while the app was closed. (Live watching and messages come later.)
  const startupFolder = watchedFolder.getView().path;
  if (startupFolder) {
    importWatchedFolder(startupFolder, { fs: watchedFolderFs, core, importDocument });
  }

  // Input: every device (the Virtual shuttle now, the real ShuttleXPress later) sends DeviceEvents
  // here; one mapper and one saved button mapping serve them all.
  const input = createInputService(
    core,
    createFileButtonMappingStore(path.join(app.getPath('userData'), 'button-mapping.json')),
  );
  ipcMain.on(IPC.deviceEvent, (_e, event: DeviceEvent) => input.handle(event));
  ipcMain.handle(IPC.inputGetMapping, () => input.getView());
  ipcMain.handle(IPC.inputSetButton, (_e, button: ButtonId, action: ActionId) => {
    input.setButton(button, action);
    return input.getView();
  });
  input.subscribe((view) => windows.forEach((w) => w.webContents.send(IPC.inputMapping, view)));

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
  ipcMain.handle(IPC.quickMessagesGet, () => api.getQuickMessages());
  ipcMain.handle(IPC.quickMessagesSet, (_e, messages) => api.setQuickMessages(messages));
  void api.startup();
  app.on('will-quit', () => void api.stop());

  // Run mode (meter, Live view, transport, status column) needs room: see WINDOW_SIZES.
  operatorWin = openPlaced('operator', 'operator', 'Neoprompter - Operator view');

  // Preferences and the Virtual shuttle: one window each, and none open at launch.
  const windowHost = createWindowHost({
    create: (kind) => {
      const win =
        kind === 'preferences'
          ? openPlaced('preferences', 'preferences', 'Neoprompter - Preferences')
          : openPlaced('shuttle', 'shuttle', 'Neoprompter - Virtual shuttle');
      return { focus: () => win.focus(), onClosed: (l) => win.on('closed', l) };
    },
  });
  const perform = (action: MenuAction) => {
    if (action.type === 'dispatch') core.dispatch(action.command);
    else if (action.type === 'open-window') windowHost.open(action.window);
    else if (action.type === 'toggle-output') {
      core.dispatch({ type: 'setOutput', on: !core.getState().outputOn });
    } else if (
      (action.action === 'undo' || action.action === 'redo') &&
      BrowserWindow.getFocusedWindow() &&
      ![operatorWin, outputWin].includes(BrowserWindow.getFocusedWindow())
    ) {
      // Preferences and the Virtual shuttle have no editor: undo in their own text fields.
      const focused = BrowserWindow.getFocusedWindow()!;
      if (action.action === 'undo') focused.webContents.undo();
      else focused.webContents.redo();
    } else if (operatorWin && !operatorWin.isDestroyed()) {
      operatorWin.webContents.send(IPC.menuAction, action.action);
    }
  };
  const toElectron = (item: MenuItemSpec): Electron.MenuItemConstructorOptions => ({
    id: item.id,
    label: item.label,
    accelerator: item.accelerator,
    role: item.role as Electron.MenuItemConstructorOptions['role'],
    type: item.type,
    submenu: item.submenu?.map(toElectron),
    click: item.action ? () => perform(item.action!) : undefined,
  });
  const menu = Menu.buildFromTemplate(
    buildMenuTemplate(
      process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux',
    ).map(toElectron),
  );
  Menu.setApplicationMenu(menu);
  // Import and New Script belong to Edit mode (Run mode locks the library); the Output item
  // shows whether the Output is on.
  const syncMenu = (state: CoreState) => {
    const set = (id: string, change: (item: Electron.MenuItem) => void) => {
      const item = menu.getMenuItemById(id);
      if (item) change(item);
    };
    set('import', (i) => (i.enabled = state.mode === 'edit'));
    set('new', (i) => (i.enabled = state.mode === 'edit'));
    set('output', (i) => (i.checked = state.outputOn));
  };
  core.subscribe(syncMenu);
  syncMenu(core.getState());

  // The Output opens full screen on the chosen monitor; with it missing it stays closed.
  const output = createOutputManager();
  exitOutputFullscreen = () => output.exitFullscreen();
  ipcMain.handle(IPC.outputGetView, () => output.getView());
  ipcMain.handle(IPC.outputChooseMonitor, (_e, id: string) => {
    output.chooseMonitor(id);
    return output.getView();
  });
  ipcMain.handle(IPC.outputSetWindowed, (_e, windowed: boolean) => {
    output.setWindowed(windowed);
    return output.getView();
  });
  // Esc on the Output takes it out of full screen. Only the Output window's own page may ask.
  ipcMain.on(IPC.outputExitFullscreen, (e) => {
    if (outputWin && !outputWin.isDestroyed() && e.sender === outputWin.webContents) {
      leaveOutputFullscreen();
    }
  });
  // The Output window follows the core's Output switch, which is Off at every launch.
  core.subscribe((state) => output.setOutputOn(state.outputOn));
  screen.on('display-added', () => output.refresh());
  screen.on('display-removed', () => output.refresh());
  screen.on('display-metrics-changed', () => output.refresh());
  output.refresh();
});

app.on('window-all-closed', () => app.quit());
