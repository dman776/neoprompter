import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemoryPresetStore, type PresetStore } from './presets';
import { contrastRatio, MIN_CONTRAST } from './readableColor';
import {
  defaultAppearance,
  READING_LINE_HEIGHT,
  READING_LINE_MAX_Y,
  READING_LINE_MIN_Y,
} from './types';

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

describe('reading line position', () => {
  it('defaults to a quarter of the way down the stage', () => {
    expect(setup().core.getState().appearance.readingLineY).toBe(0.25);
  });

  it('moves, and stays whole inside the stage', () => {
    const { core } = setup();
    core.dispatch({ type: 'setAppearance', changes: { readingLineY: 0.6 } });
    expect(core.getState().appearance.readingLineY).toBe(0.6);
    core.dispatch({ type: 'setAppearance', changes: { readingLineY: -3 } });
    expect(core.getState().appearance.readingLineY).toBe(READING_LINE_MIN_Y);
    core.dispatch({ type: 'setAppearance', changes: { readingLineY: 9 } });
    expect(core.getState().appearance.readingLineY).toBe(READING_LINE_MAX_Y);
    // The triangle centered on the limits stays inside the 1080px stage.
    expect(READING_LINE_MIN_Y * 1080).toBeGreaterThanOrEqual(READING_LINE_HEIGHT / 2);
    expect(READING_LINE_MAX_Y * 1080).toBeLessThanOrEqual(1080 - READING_LINE_HEIGHT / 2);
    core.dispatch({ type: 'setAppearance', changes: { readingLineY: Number.NaN } });
    expect(core.getState().appearance.readingLineY).toBe(defaultAppearance.readingLineY);
  });

  it('is saved in a Preset and comes back with it', () => {
    const { core, store } = setup();
    core.dispatch({ type: 'setAppearance', changes: { readingLineY: 0.7 } });
    core.dispatch({ type: 'savePreset', name: 'Tall' });
    core.dispatch({ type: 'setAppearance', changes: { readingLineY: 0.1 } });
    core.dispatch({ type: 'loadPreset', name: 'Tall' });
    expect(core.getState().appearance.readingLineY).toBe(0.7);
    const core2 = setup(store).core;
    core2.dispatch({ type: 'loadPreset', name: 'Tall' });
    expect(core2.getState().appearance.readingLineY).toBe(0.7);
  });

  it('loads a Preset saved before the position existed with the default', () => {
    const { readingLineY: _drop, ...old } = defaultAppearance;
    const store = createMemoryPresetStore();
    store.save({ Old: old as typeof defaultAppearance });
    const { core } = setup(store);
    core.dispatch({ type: 'loadPreset', name: 'Old' });
    expect(core.getState().appearance.readingLineY).toBe(0.25);
  });
});

describe('the Reading line and Progress bar colors', () => {
  it('are red unless the Operator chooses otherwise', () => {
    const a = setup().core.getState().appearance;
    expect(a.readingLineColor).toBe('#ff0000');
    expect(a.progressColor).toBe('#ff0000');
  });

  it('can be changed, and a bad value falls back to red', () => {
    const { core } = setup();
    core.dispatch({
      type: 'setAppearance',
      changes: { readingLineColor: '#00ff00', progressColor: '#0000ff' },
    });
    expect(core.getState().appearance.readingLineColor).toBe('#00ff00');
    expect(core.getState().appearance.progressColor).toBe('#0000ff');
    core.dispatch({
      type: 'setAppearance',
      changes: { readingLineColor: 'not a color', progressColor: '' },
    });
    expect(core.getState().appearance.readingLineColor).toBe('#ff0000');
    expect(core.getState().appearance.progressColor).toBe('#ff0000');
  });

  it('are saved in a Preset, and an old Preset without them loads with red', () => {
    const { core } = setup();
    core.dispatch({ type: 'setAppearance', changes: { readingLineColor: '#ffee00' } });
    core.dispatch({ type: 'savePreset', name: 'Yellow' });
    core.dispatch({ type: 'setAppearance', changes: { readingLineColor: '#112233' } });
    core.dispatch({ type: 'loadPreset', name: 'Yellow' });
    expect(core.getState().appearance.readingLineColor).toBe('#ffee00');
    const { readingLineColor: _a, progressColor: _b, ...old } = defaultAppearance;
    const oldStore = createMemoryPresetStore();
    oldStore.save({ Old: old as typeof defaultAppearance });
    const { core: older } = setup(oldStore);
    older.dispatch({ type: 'loadPreset', name: 'Old' });
    expect(older.getState().appearance.readingLineColor).toBe('#ff0000');
    expect(older.getState().appearance.progressColor).toBe('#ff0000');
  });
});
