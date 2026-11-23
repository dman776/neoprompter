// Headless: owns the single-instance Preferences and Virtual shuttle windows, and describes the
// native menu. No Electron imports; the real windows are injected, and src/main turns the menu
// template into an Electron Menu.
import type { Command } from '../core';

export type WindowKind = 'preferences' | 'shuttle';

export interface HostWindow {
  focus(): void;
  /** Called once when the window has been closed. */
  onClosed(listener: () => void): void;
}

export interface WindowFactory {
  create(kind: WindowKind): HostWindow;
}

export interface WindowHost {
  /** Opens the window, or focuses it when it is already open: there is never a second one. */
  open(kind: WindowKind): void;
  isOpen(kind: WindowKind): boolean;
}

/** Nothing is open at creation, so the Virtual shuttle is closed on every launch. */
export function createWindowHost(factory: WindowFactory): WindowHost {
  const open = new Map<WindowKind, HostWindow>();
  return {
    open(kind) {
      const existing = open.get(kind);
      if (existing) {
        existing.focus();
        return;
      }
      const win = factory.create(kind);
      open.set(kind, win);
      win.onClosed(() => open.delete(kind));
    },
    isOpen: (kind) => open.has(kind),
  };
}

/** Things only the Operator view can do; sent to it over IPC (`window.neoprompter.onMenuAction`). */
export type UiAction = 'new' | 'import' | 'toggle-theme' | 'toggle-right-column' | 'find';

export type MenuAction =
  | { type: 'dispatch'; command: Command }
  | { type: 'open-window'; window: WindowKind }
  | { type: 'ui'; action: UiAction };

export type Platform = 'darwin' | 'win32' | 'linux';

export interface MenuItemSpec {
  label?: string;
  /** Electron accelerator, already resolved for the platform (Command or Control). */
  accelerator?: string;
  /** An Electron role, for standard items the platform handles itself. */
  role?: string;
  type?: 'separator';
  action?: MenuAction;
  submenu?: MenuItemSpec[];
}

const SEPARATOR: MenuItemSpec = { type: 'separator' };

export function buildMenuTemplate(platform: Platform): MenuItemSpec[] {
  const mod = platform === 'darwin' ? 'Command' : 'Control';
  const key = (k: string) => `${mod}+${k}`;
  const ui = (action: UiAction): MenuAction => ({ type: 'ui', action });
  const run = (command: Command): MenuAction => ({ type: 'dispatch', command });

  const appMenu: MenuItemSpec[] =
    platform === 'darwin'
      ? [
          {
            label: 'Neoprompter',
            submenu: [
              { role: 'about' },
              SEPARATOR,
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              SEPARATOR,
              { role: 'quit' },
            ],
          },
        ]
      : [];

  return [
    ...appMenu,
    {
      label: 'File',
      submenu: [
        { label: 'New Script', accelerator: key('N'), action: ui('new') },
        { label: 'Import', accelerator: key('I'), action: ui('import') },
        SEPARATOR,
        {
          label: 'Preferences',
          accelerator: key(','),
          action: { type: 'open-window', window: 'preferences' },
        },
        ...(platform === 'darwin' ? [] : [SEPARATOR, { role: 'quit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        SEPARATOR,
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        SEPARATOR,
        { label: 'Find', accelerator: key('F'), action: ui('find') },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Edit mode',
          accelerator: key('1'),
          action: run({ type: 'setMode', mode: 'edit' }),
        },
        {
          label: 'Run mode',
          accelerator: key('2'),
          action: run({ type: 'setMode', mode: 'run' }),
        },
        SEPARATOR,
        { label: 'Toggle theme', accelerator: key('Shift+L'), action: ui('toggle-theme') },
        {
          label: 'Collapse right column',
          accelerator: key('\\'),
          action: ui('toggle-right-column'),
        },
      ],
    },
    {
      label: 'Output',
      submenu: [
        {
          label: 'Output On',
          accelerator: key('Shift+O'),
          action: run({ type: 'setOutput', on: true }),
        },
        {
          label: 'Output Off',
          accelerator: key('Shift+X'),
          action: run({ type: 'setOutput', on: false }),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Virtual shuttle',
          accelerator: key('Shift+V'),
          action: { type: 'open-window', window: 'shuttle' },
        },
        SEPARATOR,
        { role: 'minimize' },
      ],
    },
  ];
}
