import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { FONT_SIZE_STEP, MAX_FONT_SIZE, MIN_FONT_SIZE } from './types';

const setup = () =>
  createCore({ clock: createFakeClock(), script: { name: 't', lines: ['one', 'two'] } });

describe('nudging the font size', () => {
  it('steps the Output font size up and down', () => {
    const core = setup();
    const start = core.getState().appearance.fontSize;
    core.dispatch({ type: 'nudgeFontSize', direction: 1 });
    expect(core.getState().appearance.fontSize).toBe(start + FONT_SIZE_STEP);
    core.dispatch({ type: 'nudgeFontSize', direction: -1 });
    core.dispatch({ type: 'nudgeFontSize', direction: -1 });
    expect(core.getState().appearance.fontSize).toBe(start - FONT_SIZE_STEP);
  });

  it('never goes below the smallest or above the largest size', () => {
    const core = setup();
    core.dispatch({ type: 'setAppearance', changes: { fontSize: MIN_FONT_SIZE } });
    core.dispatch({ type: 'nudgeFontSize', direction: -1 });
    expect(core.getState().appearance.fontSize).toBe(MIN_FONT_SIZE);
    core.dispatch({ type: 'setAppearance', changes: { fontSize: MAX_FONT_SIZE } });
    core.dispatch({ type: 'nudgeFontSize', direction: 1 });
    expect(core.getState().appearance.fontSize).toBe(MAX_FONT_SIZE);
  });

  it('leaves the other appearance settings alone', () => {
    const core = setup();
    const before = core.getState().appearance;
    core.dispatch({ type: 'nudgeFontSize', direction: 1 });
    expect({ ...core.getState().appearance, fontSize: before.fontSize }).toEqual(before);
  });
});
