import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';

function setup() {
  const clock = createFakeClock();
  const core = createCore({ clock });
  return { clock, core };
}

describe('core play/pause', () => {
  it('starts paused at the top of the sample Script', () => {
    const { core } = setup();
    const state = core.getState();
    expect(state.playing).toBe(false);
    expect(state.position).toBe(0);
    expect(state.script.lines.length).toBeGreaterThan(0);
  });

  it('scrolls at the speed in lines per second while playing', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'play' });
    clock.advance(2000);
    const state = core.getState();
    expect(state.playing).toBe(true);
    expect(state.position).toBeCloseTo(2 * state.speed);
  });

  it('stops scrolling on pause', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'play' });
    clock.advance(1000);
    core.dispatch({ type: 'pause' });
    const paused = core.getState().position;
    clock.advance(5000);
    expect(core.getState().playing).toBe(false);
    expect(core.getState().position).toBe(paused);
  });

  it('resumes from where it paused', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'play' });
    clock.advance(1000);
    core.dispatch({ type: 'pause' });
    clock.advance(5000);
    core.dispatch({ type: 'play' });
    clock.advance(1000);
    expect(core.getState().position).toBeCloseTo(2 * core.getState().speed);
  });

  it('notifies subscribers when a command changes state', () => {
    const { core } = setup();
    const seen: boolean[] = [];
    core.subscribe((s) => seen.push(s.playing));
    core.dispatch({ type: 'play' });
    core.dispatch({ type: 'pause' });
    expect(seen).toEqual([true, false]);
  });
});
