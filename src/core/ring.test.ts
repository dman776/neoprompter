import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { RING_MAX_LINES_PER_SECOND } from './types';

function setup(n = 500) {
  const clock = createFakeClock();
  const core = createCore({
    clock,
    script: { name: 't', lines: Array.from({ length: n }, (_, i) => `l${i}`) },
  });
  core.dispatch({ type: 'setViewport', lines: 10 });
  return { clock, core };
}

describe('ring deflection', () => {
  it('scrolls forward in proportion to deflection while paused, and stays paused on release', () => {
    const { clock, core } = setup();
    const p0 = core.getState().position;
    core.dispatch({ type: 'setRing', deflection: 0.5 });
    clock.advance(1000);
    expect(core.getState().position - p0).toBeCloseTo(0.5 * RING_MAX_LINES_PER_SECOND);
    core.dispatch({ type: 'setRing', deflection: 0 });
    const p1 = core.getState().position;
    clock.advance(1000);
    expect(core.getState().position).toBe(p1);
    expect(core.getState().playing).toBe(false);
  });

  it('scrolls back with negative deflection, never past the start', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'setRing', deflection: -1 });
    clock.advance(5000);
    expect(core.getState().position).toBe(-core.getState().leadIn);
  });

  it('keeps playing after release when it was playing, and resumes normal speed', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'setSpeed', level: 4 });
    core.dispatch({ type: 'play' });
    core.dispatch({ type: 'setRing', deflection: 1 });
    clock.advance(1000);
    expect(core.getState().playing).toBe(true);
    core.dispatch({ type: 'setRing', deflection: 0 });
    const p = core.getState().position;
    clock.advance(1000);
    expect(core.getState().position - p).toBeCloseTo(core.getState().speed);
  });

  it('clamps deflection to the range -1 to 1', () => {
    const { clock, core } = setup();
    const p0 = core.getState().position;
    core.dispatch({ type: 'setRing', deflection: 5 });
    clock.advance(1000);
    expect(core.getState().position - p0).toBeCloseTo(RING_MAX_LINES_PER_SECOND);
  });

  it('does not move the play-start position, so a ring flick can be undone', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'play' });
    clock.advance(2000);
    core.dispatch({ type: 'pause' });
    const start = -core.getState().leadIn;
    core.dispatch({ type: 'setRing', deflection: 1 });
    clock.advance(1000);
    core.dispatch({ type: 'setRing', deflection: 0 });
    core.dispatch({ type: 'returnToPlayStart' });
    expect(core.getState().position).toBe(start);
  });
});

describe('scrollBy', () => {
  it('repositions by lines, clamped to the Script', () => {
    const { core } = setup(100);
    core.dispatch({ type: 'scrollBy', lines: 7 });
    expect(core.getState().position).toBe(-core.getState().leadIn + 7);
    core.dispatch({ type: 'scrollBy', lines: -1000 });
    expect(core.getState().position).toBe(-core.getState().leadIn);
    core.dispatch({ type: 'scrollBy', lines: 1000 });
    expect(core.getState().position).toBe(90);
  });
});
