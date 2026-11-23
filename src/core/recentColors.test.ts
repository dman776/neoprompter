import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemorySessionStore } from './session';
import { lineRuns } from './richScript';

function env() {
  return { clock: createFakeClock(), sessionStore: createMemorySessionStore() };
}

const SEED = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ffffff'];

describe('recent colors', () => {
  it('starts as red, green, blue, yellow and white', () => {
    expect(createCore(env()).getState().recentColors).toEqual(SEED);
  });

  it('moves a used color to the front, pushing the others back', () => {
    const core = createCore(env());
    core.dispatch({ type: 'pickColor', color: '#123456' });
    expect(core.getState().recentColors).toEqual(['#123456', ...SEED]);
  });

  it('keeps no duplicates', () => {
    const core = createCore(env());
    core.dispatch({ type: 'pickColor', color: '#0000ff' });
    expect(core.getState().recentColors).toEqual([
      '#0000ff',
      '#ff0000',
      '#00ff00',
      '#ffff00',
      '#ffffff',
    ]);
  });

  it('treats upper and lower case as the same color', () => {
    const core = createCore(env());
    core.dispatch({ type: 'pickColor', color: '#AABBCC' });
    core.dispatch({ type: 'pickColor', color: '#aabbcc' });
    expect(core.getState().recentColors.filter((c) => c === '#aabbcc')).toHaveLength(1);
    expect(core.getState().recentColors).toHaveLength(6);
  });

  it('holds at most ten, dropping the oldest', () => {
    const core = createCore(env());
    for (let i = 1; i <= 7; i++) {
      core.dispatch({ type: 'pickColor', color: `#00000${i}` });
    }
    const colors = core.getState().recentColors;
    expect(colors).toHaveLength(10);
    expect(colors[0]).toBe('#000007');
    expect(colors).not.toContain('#ffffff');
  });

  it('ignores anything that is not #rrggbb', () => {
    const core = createCore(env());
    core.dispatch({ type: 'pickColor', color: 'red' });
    core.dispatch({ type: 'pickColor', color: '#fff' });
    expect(core.getState().recentColors).toEqual(SEED);
  });

  it('is remembered between launches', () => {
    const e = env();
    createCore(e).dispatch({ type: 'pickColor', color: '#123456' });
    expect(createCore(e).getState().recentColors[0]).toBe('#123456');
  });

  it('seeds a session saved before recent colors existed', () => {
    const e = env();
    createCore(e).dispatch({ type: 'pause' });
    const old = e.sessionStore.load()!;
    delete old.recentColors;
    e.sessionStore.save(old);
    expect(createCore(e).getState().recentColors).toEqual(SEED);
  });
});

describe('any color', () => {
  it('colors a range with any #rrggbb color, stored as-is', () => {
    const core = createCore(env());
    core.dispatch({ type: 'saveScript', name: 's', text: 'hello' });
    core.dispatch({ type: 'loadScript', id: '1' });
    core.dispatch({ type: 'colorRange', line: 0, start: 0, end: 5, color: '#123456' });
    expect(lineRuns(core.getState().script.lines[0])).toEqual([
      { text: 'hello', color: '#123456' },
    ]);
  });
});
