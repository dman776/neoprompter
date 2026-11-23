import { describe, expect, it } from 'vitest';
import { buildMenuTemplate, type MenuItemSpec, type Platform } from './index';

const find = (items: MenuItemSpec[], label: string): MenuItemSpec => {
  const hit = flatten(items).find((i) => i.label === label);
  if (!hit) throw new Error(`No menu item "${label}"`);
  return hit;
};
const top = (platform: Platform) => buildMenuTemplate(platform);
const names = (items: MenuItemSpec[]) => items.map((i) => i.label).filter(Boolean);

function flatten(items: MenuItemSpec[]): MenuItemSpec[] {
  return items.flatMap((i) => [i, ...(i.submenu ? flatten(i.submenu) : [])]);
}

describe('native menu', () => {
  it('has File, Edit, View, Output and Window on Windows', () => {
    expect(names(top('win32'))).toEqual(['File', 'Edit', 'View', 'Output', 'Window', 'Help']);
  });

  it('puts the app menu first on macOS', () => {
    expect(names(top('darwin'))).toEqual([
      'NeoPrompter',
      'File',
      'Edit',
      'View',
      'Output',
      'Window',
    ]);
  });

  it('uses Command on macOS and Control on Windows', () => {
    expect(find(top('darwin'), 'Preferences').accelerator).toBe('Command+,');
    expect(find(top('win32'), 'Preferences').accelerator).toBe('Control+,');
  });

  it('File holds New, Import and Preferences with their actions', () => {
    const t = top('win32');
    expect(find(t, 'New Script').action).toEqual({ type: 'ui', action: 'new' });
    expect(find(t, 'Import').action).toEqual({ type: 'ui', action: 'import' });
    expect(find(t, 'Preferences').action).toEqual({ type: 'open-window', window: 'preferences' });
  });

  it('Edit has Find, Undo and Redo, all sent to the Operator view', () => {
    const t = top('win32');
    expect(find(t, 'Find').action).toEqual({ type: 'ui', action: 'find' });
    // The Operator view owns the editor's history, so these are not native roles.
    expect(find(t, 'Undo')).toMatchObject({
      accelerator: 'Control+Z',
      action: { type: 'ui', action: 'undo' },
    });
    expect(find(t, 'Redo')).toMatchObject({
      accelerator: 'Control+Shift+Z',
      action: { type: 'ui', action: 'redo' },
    });
  });

  it('View switches mode through the Operator view, so typing is saved first', () => {
    const t = top('win32');
    expect(find(t, 'Edit mode')).toMatchObject({
      accelerator: 'Control+1',
      action: { type: 'ui', action: 'mode-edit' },
    });
    expect(find(t, 'Run mode')).toMatchObject({
      accelerator: 'Control+2',
      action: { type: 'ui', action: 'mode-run' },
    });
    expect(find(t, 'Toggle theme').action).toEqual({ type: 'ui', action: 'toggle-theme' });
    expect(find(t, 'Collapse right column').action).toEqual({
      type: 'ui',
      action: 'toggle-right-column',
    });
  });

  it('Output is one checkbox item with one shortcut', () => {
    const t = top('darwin');
    const output = flatten(t).filter((i) => i.action?.type === 'toggle-output');
    expect(output).toHaveLength(1);
    expect(output[0]).toMatchObject({
      id: 'output',
      type: 'checkbox',
      accelerator: 'Command+Shift+O',
    });
  });

  it('Import has an id, so the app can disable it in Run mode', () => {
    expect(find(top('darwin'), 'Import').id).toBe('import');
  });

  it('no shortcut collides with the editor (bold, italic, undo keys) or macOS paste styles', () => {
    for (const platform of ['darwin', 'win32'] as const) {
      const mod = platform === 'darwin' ? 'Command' : 'Control';
      const editorKeys = ['B', 'I', 'U', 'E', 'L', 'R', 'J', 'Y'].map((k) => `${mod}+${k}`);
      const accels = flatten(top(platform)).map((i) => i.accelerator);
      for (const k of editorKeys) expect(accels).not.toContain(k);
      expect(accels).not.toContain(`${mod}+Shift+V`);
      expect(accels.some((a) => a?.startsWith(`${mod}+Alt+`))).toBe(false);
    }
  });

  it('Window opens the Virtual shuttle', () => {
    expect(find(top('win32'), 'Virtual shuttle')).toMatchObject({
      accelerator: 'Control+Shift+K',
      action: { type: 'open-window', window: 'shuttle' },
    });
  });

  it('has an About item on every platform', () => {
    expect(find(top('darwin'), 'About NeoPrompter').action).toEqual({ type: 'about' });
    expect(find(top('win32'), 'About NeoPrompter').action).toEqual({ type: 'about' });
  });

  it('every action item has a shortcut and no two share one', () => {
    for (const platform of ['darwin', 'win32'] as const) {
      const all = flatten(top(platform));
      expect(
        all.filter((i) => i.action && i.action.type !== 'about').every((i) => i.accelerator),
      ).toBe(true);
      const accels = all.map((i) => i.accelerator).filter(Boolean);
      expect(new Set(accels).size).toBe(accels.length);
    }
  });
});
