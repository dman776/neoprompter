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
    expect(names(top('win32'))).toEqual(['File', 'Edit', 'View', 'Output', 'Window']);
  });

  it('puts the app menu first on macOS', () => {
    expect(names(top('darwin'))).toEqual([
      'Neoprompter',
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

  it('Edit has Find, sent to the Operator view', () => {
    expect(find(top('win32'), 'Find').action).toEqual({ type: 'ui', action: 'find' });
  });

  it('View switches mode, theme and the right column', () => {
    const t = top('win32');
    expect(find(t, 'Edit mode')).toMatchObject({
      accelerator: 'Control+1',
      action: { type: 'dispatch', command: { type: 'setMode', mode: 'edit' } },
    });
    expect(find(t, 'Run mode')).toMatchObject({
      accelerator: 'Control+2',
      action: { type: 'dispatch', command: { type: 'setMode', mode: 'run' } },
    });
    expect(find(t, 'Toggle theme').action).toEqual({ type: 'ui', action: 'toggle-theme' });
    expect(find(t, 'Collapse right column').action).toEqual({
      type: 'ui',
      action: 'toggle-right-column',
    });
  });

  it('Output switches on and off, each with a shortcut', () => {
    const t = top('darwin');
    expect(find(t, 'Output On')).toMatchObject({
      accelerator: 'Command+Shift+O',
      action: { type: 'dispatch', command: { type: 'setOutput', on: true } },
    });
    expect(find(t, 'Output Off')).toMatchObject({
      accelerator: 'Command+Shift+X',
      action: { type: 'dispatch', command: { type: 'setOutput', on: false } },
    });
  });

  it('Window opens the Virtual shuttle', () => {
    expect(find(top('win32'), 'Virtual shuttle')).toMatchObject({
      accelerator: 'Control+Shift+V',
      action: { type: 'open-window', window: 'shuttle' },
    });
  });

  it('every action item has a shortcut and no two share one', () => {
    for (const platform of ['darwin', 'win32'] as const) {
      const all = flatten(top(platform));
      expect(all.filter((i) => i.action).every((i) => i.accelerator)).toBe(true);
      const accels = all.map((i) => i.accelerator).filter(Boolean);
      expect(new Set(accels).size).toBe(accels.length);
    }
  });
});
