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
export type UiAction =
  | 'new'
  | 'import'
  | 'toggle-theme'
  | 'toggle-right-column'
  | 'find'
  | 'undo'
  | 'redo'
  /** Mode switches go through the Operator view so it can send unsaved typing first. */
  | 'mode-edit'
  | 'mode-run';

export type MenuAction =
  | { type: 'dispatch'; command: Command }
  | { type: 'open-window'; window: WindowKind }
  | { type: 'ui'; action: UiAction }
  /** Flip the Output switch; the app reads the current state and sends `setOutput`. */
  | { type: 'toggle-output' }
  /** Show the About panel (name and version). */
  | { type: 'about' };

export type Platform = 'darwin' | 'win32' | 'linux';

export interface MenuItemSpec {
  /** Lets the app find an item later to enable it or tick it (Import, Output on). */
  id?: string;
  label?: string;
  /** Electron accelerator, already resolved for the platform (Command or Control). */
  accelerator?: string;
  /** An Electron role, for standard items the platform handles itself. */
  role?: string;
  type?: 'separator' | 'checkbox';
  action?: MenuAction;
  submenu?: MenuItemSpec[];
}

const SEPARATOR: MenuItemSpec = { type: 'separator' };

export function buildMenuTemplate(platform: Platform): MenuItemSpec[] {
  const mod = platform === 'darwin' ? 'Command' : 'Control';
  const key = (k: string) => `${mod}+${k}`;
  const ui = (action: UiAction): MenuAction => ({ type: 'ui', action });

  const appMenu: MenuItemSpec[] =
    platform === 'darwin'
      ? [
          {
            label: 'NeoPrompter',
            submenu: [
              { label: 'About NeoPrompter', action: { type: 'about' } },
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
        { id: 'new', label: 'New Script', accelerator: key('N'), action: ui('new') },
        { id: 'import', label: 'Import', accelerator: key('Shift+I'), action: ui('import') },
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
        // Not native roles: the editor's own history lives in the Operator view.
        { label: 'Undo', accelerator: key('Z'), action: ui('undo') },
        { label: 'Redo', accelerator: key('Shift+Z'), action: ui('redo') },
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
          action: ui('mode-edit'),
        },
        {
          label: 'Run mode',
          accelerator: key('2'),
          action: ui('mode-run'),
        },
        SEPARATOR,
        { label: 'Toggle theme', accelerator: key('Shift+L'), action: ui('toggle-theme') },
        SEPARATOR,
        {
          label: 'Larger text',
          accelerator: key('Plus'),
          action: { type: 'dispatch', command: { type: 'nudgeFontSize', direction: 1 } },
        },
        {
          label: 'Smaller text',
          accelerator: key('-'),
          action: { type: 'dispatch', command: { type: 'nudgeFontSize', direction: -1 } },
        },
        SEPARATOR,
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
          id: 'output',
          label: 'Output on',
          type: 'checkbox',
          accelerator: key('Shift+O'),
          action: { type: 'toggle-output' },
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Virtual shuttle',
          accelerator: key('Shift+K'),
          action: { type: 'open-window', window: 'shuttle' },
        },
        SEPARATOR,
        { role: 'minimize' },
      ],
    },
    ...(platform === 'darwin'
      ? []
      : [
          {
            label: 'Help',
            submenu: [{ label: 'About NeoPrompter', action: { type: 'about' } as MenuAction }],
          },
        ]),
  ];
}
