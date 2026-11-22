import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemoryPresetStore, type PresetStore } from './presets';
import { contrastRatio, MIN_CONTRAST } from './readableColor';
import { defaultAppearance } from './types';

function setup(store: PresetStore = createMemoryPresetStore()) {
  const core = createCore({ clock: createFakeClock(), presetStore: store });
  return { core, store };
}

describe('appearance', () => {
  it('has defaults and updates settings live, notifying subscribers', () => {
    const { core } = setup();
    const seen: number[] = [];
    core.subscribe((s) => seen.push(s.appearance.fontSize));
    core.dispatch({ type: 'setAppearance', changes: { fontSize: 72, textColor: '#ff0' } });
    const a = core.getState().appearance;
    expect(a.fontSize).toBe(72);
    expect(a.textColor).toBe('#ff0');
    expect(a.lineSpacing).toBeGreaterThan(0);
    expect(seen).toEqual([72]);
  });

  it('toggles mirror', () => {
    const { core } = setup();
    expect(core.getState().appearance.mirror).toBe(false);
    core.dispatch({ type: 'toggleMirror' });
    expect(core.getState().appearance.mirror).toBe(true);
    core.dispatch({ type: 'toggleMirror' });
    expect(core.getState().appearance.mirror).toBe(false);
  });

  it('toggles the reading line', () => {
    const { core } = setup();
    const before = core.getState().appearance.readingLine;
    core.dispatch({ type: 'setAppearance', changes: { readingLine: !before } });
    expect(core.getState().appearance.readingLine).toBe(!before);
  });
});

describe('presets', () => {
  it('saves a named Preset and switches back to it', () => {
    const { core } = setup();
    core.dispatch({ type: 'setAppearance', changes: { fontSize: 90, mirror: true } });
    core.dispatch({ type: 'savePreset', name: 'Alice' });
    core.dispatch({ type: 'setAppearance', changes: { fontSize: 30, mirror: false } });
    core.dispatch({ type: 'savePreset', name: 'Bob' });
    expect(core.getState().presets).toEqual(['Alice', 'Bob']);
    core.dispatch({ type: 'loadPreset', name: 'Alice' });
    const s = core.getState();
    expect(s.appearance.fontSize).toBe(90);
    expect(s.appearance.mirror).toBe(true);
    expect(s.activePreset).toBe('Alice');
  });

  it('overwrites a Preset saved under the same name', () => {
    const { core } = setup();
    core.dispatch({ type: 'savePreset', name: 'A' });
    core.dispatch({ type: 'setAppearance', changes: { fontSize: 11 } });
    core.dispatch({ type: 'savePreset', name: 'A' });
    core.dispatch({ type: 'setAppearance', changes: { fontSize: 99 } });
    core.dispatch({ type: 'loadPreset', name: 'A' });
    expect(core.getState().presets).toEqual(['A']);
    expect(core.getState().appearance.fontSize).toBe(11);
  });

  it('ignores loading an unknown Preset and blank names', () => {
    const { core } = setup();
    core.dispatch({ type: 'loadPreset', name: 'nope' });
    core.dispatch({ type: 'savePreset', name: '  ' });
    expect(core.getState().presets).toEqual([]);
    expect(core.getState().activePreset).toBeNull();
  });

  it('deletes a Preset and clears it as active', () => {
    const { core } = setup();
    core.dispatch({ type: 'savePreset', name: 'A' });
    core.dispatch({ type: 'deletePreset', name: 'A' });
    expect(core.getState().presets).toEqual([]);
    expect(core.getState().activePreset).toBeNull();
  });

  it('persists through the store and restores on a new core', () => {
    const { core, store } = setup();
    core.dispatch({ type: 'setAppearance', changes: { fontSize: 55 } });
    core.dispatch({ type: 'savePreset', name: 'Talent' });
    const core2 = setup(store).core;
    expect(core2.getState().presets).toEqual(['Talent']);
    core2.dispatch({ type: 'loadPreset', name: 'Talent' });
    expect(core2.getState().appearance.fontSize).toBe(55);
  });
});

describe('readable appearance', () => {
  it('corrects a text color that matches the background', () => {
    const { core } = setup();
    core.dispatch({ type: 'setAppearance', changes: { textColor: '#000000' } });
    const a = core.getState().appearance;
    expect(a.backgroundColor).toBe('#000000');
    expect(contrastRatio(a.textColor, a.backgroundColor)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it('keeps the text readable when the background moves onto it', () => {
    const { core } = setup();
    core.dispatch({ type: 'setAppearance', changes: { backgroundColor: '#ffffff' } });
    const a = core.getState().appearance;
    expect(contrastRatio(a.textColor, a.backgroundColor)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it('keeps a readable pair as chosen', () => {
    const { core } = setup();
    core.dispatch({
      type: 'setAppearance',
      changes: { textColor: '#ffff00', backgroundColor: '#000080' },
    });
    expect(core.getState().appearance.textColor).toBe('#ffff00');
  });

  it('does not load a low-contrast Preset as-is', () => {
    const store = createMemoryPresetStore();
    store.save({ bad: { ...defaultAppearance, textColor: '#111111' } });
    const core = createCore({ clock: createFakeClock(), presetStore: store });
    core.dispatch({ type: 'loadPreset', name: 'bad' });
    const a = core.getState().appearance;
    expect(contrastRatio(a.textColor, a.backgroundColor)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});
