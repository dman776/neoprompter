import { describe, expect, it } from 'vitest';
import { createCore, createFakeClock } from '../core';
import {
  BINDABLE_ACTIONS,
  chordFromEvent,
  chordLabel,
  createInputMapper,
  createInputService,
  createKeyBindings,
  defaultButtonMapping,
  defaultKeyBindings,
  normalizeKeyBindings,
  refusalReason,
  resolveKey,
  type KeyBindingTable,
  type KeyChord,
} from './index';

const key = (code: string, mods: Partial<Omit<KeyChord, 'code'>> = {}): KeyChord => ({
  code,
  shift: false,
  ctrl: false,
  alt: false,
  meta: false,
  ...mods,
});

describe('default Key bindings', () => {
  it("are today's keys, with Page Up and the Left arrow both on Back a Screen", () => {
    const kb = createKeyBindings();
    expect(kb.actionFor(key('Space'))).toBe('playPause');
    expect(kb.actionFor(key('Space', { shift: true }))).toBe('playBackward');
    expect(kb.actionFor(key('ArrowUp'))).toBe('speedUp');
    expect(kb.actionFor(key('ArrowDown'))).toBe('speedDown');
    expect(kb.actionFor(key('ArrowLeft'))).toBe('jumpBack');
    expect(kb.actionFor(key('PageUp'))).toBe('jumpBack');
    expect(kb.actionFor(key('ArrowRight'))).toBe('jumpForward');
    expect(kb.actionFor(key('PageDown'))).toBe('jumpForward');
    expect(kb.getTable().returnToPlayStart).toEqual([]);
    expect(kb.getTable().dismissNotification).toEqual([]);
  });

  it('list every bindable action', () => {
    expect(Object.keys(defaultKeyBindings())).toEqual([...BINDABLE_ACTIONS]);
  });
});

describe('adding, moving and removing keys', () => {
  it('lets one action have several keys and gives a key to one action only', () => {
    const kb = createKeyBindings();
    expect(kb.add('playPause', key('Numpad5'))).toEqual({ status: 'added' });
    expect(kb.getTable().playPause).toHaveLength(2);
    expect(kb.add('playPause', key('Numpad5'))).toEqual({ status: 'unchanged' });
    expect(kb.getTable().playPause).toHaveLength(2);
  });

  it('reports a conflict and changes nothing until the key is moved', () => {
    const kb = createKeyBindings();
    expect(kb.add('speedUp', key('Space'))).toEqual({ status: 'conflict', action: 'playPause' });
    expect(kb.actionFor(key('Space'))).toBe('playPause');
    expect(kb.move('speedUp', key('Space'))).toEqual({ status: 'added' });
    expect(kb.actionFor(key('Space'))).toBe('speedUp');
    expect(kb.getTable().playPause).toEqual([]);
  });

  it('treats the same key with different modifiers as a different key', () => {
    const kb = createKeyBindings();
    expect(kb.add('returnToPlayStart', key('Space', { alt: true }))).toEqual({ status: 'added' });
    expect(kb.actionFor(key('Space'))).toBe('playPause');
  });

  it('removes one key and leaves the rest', () => {
    const kb = createKeyBindings();
    expect(kb.remove('jumpBack', key('PageUp'))).toBe(true);
    expect(kb.getTable().jumpBack).toEqual([key('ArrowLeft')]);
    expect(kb.remove('jumpBack', key('PageUp'))).toBe(false);
  });

  it('refuses an action that cannot have keys', () => {
    const kb = createKeyBindings();
    expect(kb.add('none', key('KeyA')).status).toBe('refused');
    expect(kb.add('nonsense', key('KeyA')).status).toBe('refused');
  });

  it('reset restores exactly the defaults', () => {
    const kb = createKeyBindings();
    kb.move('speedUp', key('Space'));
    kb.add('returnToPlayStart', key('F5'));
    kb.remove('jumpBack', key('PageUp'));
    kb.reset();
    expect(kb.getTable()).toEqual(defaultKeyBindings());
  });

  it('getTable returns a copy', () => {
    const kb = createKeyBindings();
    kb.getTable().playPause.push(key('KeyZ'));
    expect(kb.getTable().playPause).toHaveLength(1);
  });
});

describe('refused keys', () => {
  it('refuses Esc and Tab with a reason', () => {
    expect(refusalReason(key('Escape'))).toMatch(/Esc/);
    expect(refusalReason(key('Tab'))).toMatch(/Tab/);
    expect(refusalReason(key('Tab', { shift: true }))).toMatch(/Tab/);
    const kb = createKeyBindings();
    expect(kb.add('playPause', key('Escape'))).toMatchObject({ status: 'refused' });
  });

  it('refuses keys the menu uses, with Cmd or Ctrl', () => {
    expect(refusalReason(key('KeyN', { meta: true }))).toMatch(/menu/);
    expect(refusalReason(key('KeyN', { ctrl: true }))).toMatch(/menu/);
    expect(refusalReason(key('KeyI', { meta: true, shift: true }))).toMatch(/menu/);
    expect(refusalReason(key('KeyQ', { meta: true }))).toMatch(/menu/);
    expect(refusalReason(key('Comma', { meta: true }))).toMatch(/menu/);
    expect(refusalReason(key('Equal', { meta: true, shift: true }))).toMatch(/menu/);
  });

  it('allows the same letters without Cmd/Ctrl, or with a different Shift', () => {
    expect(refusalReason(key('KeyN'))).toBeNull();
    expect(refusalReason(key('KeyI', { meta: true }))).toBeNull();
    expect(refusalReason(key('KeyK', { meta: true }))).toBeNull();
    expect(refusalReason(key('KeyN', { meta: true, alt: true }))).toBeNull();
  });

  it('allows F-keys, numpad keys and modifier combinations', () => {
    expect(refusalReason(key('F5'))).toBeNull();
    expect(refusalReason(key('Numpad1'))).toBeNull();
    expect(refusalReason(key('Space', { ctrl: true }))).toBeNull();
  });
});

describe('key presses and labels', () => {
  it('turns a key press into a chord, and a lone modifier into nothing', () => {
    const base = { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
    expect(chordFromEvent({ ...base, code: 'F5' })).toEqual(key('F5'));
    expect(chordFromEvent({ ...base, code: 'Space', shiftKey: true })).toEqual(
      key('Space', { shift: true }),
    );
    expect(chordFromEvent({ ...base, code: 'ShiftLeft', shiftKey: true })).toBeNull();
    expect(chordFromEvent({ ...base, code: 'MetaRight', metaKey: true })).toBeNull();
    expect(chordFromEvent({ ...base, code: '' })).toBeNull();
    expect(chordFromEvent({ ...base, code: 'Unidentified' })).toBeNull();
  });

  it('labels keys the way the Operator reads them', () => {
    expect(chordLabel(key('Numpad1'))).toBe('Numpad 1');
    expect(chordLabel(key('F5'))).toBe('F5');
    expect(chordLabel(key('Space', { shift: true }))).toBe('Shift + Space');
    expect(chordLabel(key('KeyK', { meta: true }))).toBe('Cmd + K');
    expect(chordLabel(key('Digit3'))).toBe('3');
    expect(chordLabel(key('PageUp'))).toBe('Page Up');
    expect(chordLabel(key('ArrowLeft', { ctrl: true, alt: true, shift: true, meta: true }))).toBe(
      'Ctrl + Alt + Shift + Cmd + Left arrow',
    );
  });
});

describe('what a key press means', () => {
  const table = defaultKeyBindings();
  it('is the bound action, not big', () => {
    expect(resolveKey(table, key('Space'))).toEqual({ action: 'playPause', big: false });
  });
  it('is a bigger Speed step when Shift is added to a Speed key', () => {
    expect(resolveKey(table, key('ArrowUp', { shift: true }))).toEqual({
      action: 'speedUp',
      big: true,
    });
    expect(resolveKey(table, key('ArrowDown', { shift: true }))).toEqual({
      action: 'speedDown',
      big: true,
    });
  });
  it('does not make Shift a bigger step for other actions, or for a key with its own binding', () => {
    expect(resolveKey(table, key('ArrowLeft', { shift: true }))).toBeNull();
    const own = createKeyBindings();
    own.add('returnToPlayStart', key('ArrowUp', { shift: true }));
    expect(resolveKey(own.getTable(), key('ArrowUp', { shift: true }))).toEqual({
      action: 'returnToPlayStart',
      big: false,
    });
  });
  it('is null for a key that is not bound', () => {
    expect(resolveKey(table, key('KeyQ'))).toBeNull();
  });
});

describe('reading a saved table', () => {
  it('gives the defaults for a missing or non-object file', () => {
    expect(normalizeKeyBindings(null)).toBeNull();
    expect(normalizeKeyBindings('x')).toBeNull();
    expect(normalizeKeyBindings([])).toBeNull();
    expect(createKeyBindings(null).getTable()).toEqual(defaultKeyBindings());
    expect(createKeyBindings({ nope: 1 }).getTable()).toEqual(defaultKeyBindings());
  });

  it('drops unknown actions, malformed keys, refused keys and a key given twice', () => {
    const saved = {
      playPause: [key('F5'), { code: 3 }, key('Escape'), key('F5'), 'x'],
      bogus: [key('F6')],
      speedUp: [key('F5'), key('F7')],
    };
    const table = normalizeKeyBindings(saved) as KeyBindingTable;
    expect(table.playPause).toEqual([key('F5')]);
    expect(table.speedUp).toEqual([key('F7')]);
    expect(table.bogus).toBeUndefined();
  });

  it('keeps the default keys of an action missing from the file, unless another took them', () => {
    const table = normalizeKeyBindings({ playPause: [key('ArrowLeft')] }) as KeyBindingTable;
    expect(table.playPause).toEqual([key('ArrowLeft')]);
    expect(table.jumpBack).toEqual([key('PageUp')]);
    expect(table.speedUp).toEqual([key('ArrowUp')]);
  });

  it('keeps an action saved with no keys empty', () => {
    const table = normalizeKeyBindings({ playPause: [] }) as KeyBindingTable;
    expect(table.playPause).toEqual([]);
  });
});

function setup(saved: unknown = null) {
  const clock = createFakeClock();
  const core = createCore({
    clock,
    script: { name: 't', lines: Array.from({ length: 500 }, (_, i) => `l${i}`) },
  });
  core.dispatch({ type: 'setViewport', lines: 10 });
  core.dispatch({ type: 'setSpeed', level: 3 });
  // Reverse stops at the start, so begin part way down the Script.
  core.dispatch({ type: 'scrollBy', lines: 100 });
  const saves: KeyBindingTable[] = [];
  const service = createInputService(
    core,
    { load: () => null, save: () => {} },
    { load: () => saved, save: (t) => saves.push(t) },
  );
  return { core, clock, service, saves };
}

describe('the input service and the Key bindings', () => {
  it('starts from the saved table, or the defaults', () => {
    expect(setup().service.getKeyView().table).toEqual(defaultKeyBindings());
    const { service } = setup({ playPause: [key('F5')] });
    expect(service.getKeyView().table.playPause).toEqual([key('F5')]);
    expect(service.getKeyView().actions).toEqual([...BINDABLE_ACTIONS]);
  });

  it('saves and announces every change, and nothing when nothing changed', () => {
    const { service, saves } = setup();
    const seen: KeyBindingTable[] = [];
    service.subscribeKeys((v) => seen.push(v.table));
    expect(service.addKey('returnToPlayStart', key('F6'))).toEqual({ status: 'added' });
    expect(saves).toHaveLength(1);
    expect(seen).toHaveLength(1);
    expect(seen[0].returnToPlayStart).toEqual([key('F6')]);
    expect(service.addKey('returnToPlayStart', key('F6'))).toEqual({ status: 'unchanged' });
    expect(service.addKey('speedUp', key('Space'))).toEqual({
      status: 'conflict',
      action: 'playPause',
    });
    expect(service.addKey('speedUp', key('Escape')).status).toBe('refused');
    expect(saves).toHaveLength(1);
    expect(service.moveKey('speedUp', key('Space'))).toEqual({ status: 'added' });
    expect(service.removeKey('speedUp', key('Space'))).toBe(true);
    expect(service.removeKey('speedUp', key('Space'))).toBe(false);
    service.resetKeys();
    expect(saves).toHaveLength(4);
    expect(saves[3]).toEqual(defaultKeyBindings());
    expect(service.getKeyView().table).toEqual(defaultKeyBindings());
  });

  it('works without a Key bindings store', () => {
    const core = createCore({ clock: createFakeClock() });
    const service = createInputService(core, { load: () => null, save: () => {} });
    expect(service.addKey('returnToPlayStart', key('F6'))).toEqual({ status: 'added' });
  });
});

describe('Play backward and Play / Pause', () => {
  it('Play backward plays in reverse, and pauses when already playing in reverse', () => {
    const { core, service } = setup();
    const runner = createInputMapper(core);
    runner.runAction('playBackward');
    expect(core.getState()).toMatchObject({ playing: true, direction: 'reverse' });
    runner.runAction('playBackward');
    expect(core.getState().playing).toBe(false);
    expect(service.getKeyView().actions).toContain('playBackward');
  });

  it('Play backward turns a forward play round', () => {
    const { core } = setup();
    const runner = createInputMapper(core);
    runner.runAction('playPause');
    expect(core.getState()).toMatchObject({ playing: true, direction: 'forward' });
    runner.runAction('playBackward');
    expect(core.getState()).toMatchObject({ playing: true, direction: 'reverse' });
  });

  it('Play / Pause pauses in either direction and otherwise plays forward', () => {
    const { core } = setup();
    const runner = createInputMapper(core);
    runner.runAction('playBackward');
    runner.runAction('playPause');
    expect(core.getState().playing).toBe(false);
    runner.runAction('playPause');
    expect(core.getState()).toMatchObject({ playing: true, direction: 'forward' });
    runner.runAction('playPause');
    expect(core.getState().playing).toBe(false);
  });

  it('is a choice for a button on the Virtual shuttle too, without changing the defaults', () => {
    const { core } = setup();
    const runner = createInputMapper(core);
    expect(runner.availableActions()).toContain('playBackward');
    expect(defaultButtonMapping[1]).toBe('playPause');
  });
});
