import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';

function setup() {
  const clock = createFakeClock();
  const core = createCore({
    clock,
    script: { name: 't', lines: Array.from({ length: 200 }, (_, i) => `l${i}`) },
  });
  return { clock, core };
}

describe('continuous speed', () => {
  it('keeps a fractional level and maps it linearly to lines per second', () => {
    const { core } = setup();
    core.dispatch({ type: 'setSpeed', level: 3.7 });
    expect(core.getState().speedLevel).toBe(3.7);
    expect(core.getState().speed).toBeCloseTo(1.85);
  });

  it('clamps a set level between stopped and the maximum', () => {
    const { core } = setup();
    core.dispatch({ type: 'setSpeed', level: 99 });
    expect(core.getState().speedLevel).toBe(10);
    core.dispatch({ type: 'setSpeed', level: -4 });
    expect(core.getState().speedLevel).toBe(0);
  });

  it('nudges by a small step, and by a larger step with big', () => {
    const { core } = setup();
    core.dispatch({ type: 'setSpeed', level: 2 });
    core.dispatch({ type: 'nudgeSpeed', direction: 1, big: false });
    expect(core.getState().speedLevel).toBe(2.1);
    core.dispatch({ type: 'nudgeSpeed', direction: 1, big: true });
    expect(core.getState().speedLevel).toBe(2.6);
    core.dispatch({ type: 'nudgeSpeed', direction: -1, big: false });
    expect(core.getState().speedLevel).toBe(2.5);
  });

  it('does not drift over repeated small nudges', () => {
    const { core } = setup();
    core.dispatch({ type: 'setSpeed', level: 0 });
    for (let i = 0; i < 7; i++) core.dispatch({ type: 'nudgeSpeed', direction: 1, big: false });
    expect(core.getState().speedLevel).toBe(0.7);
  });

  it('clamps nudges at both ends', () => {
    const { core } = setup();
    core.dispatch({ type: 'setSpeed', level: 9.8 });
    core.dispatch({ type: 'nudgeSpeed', direction: 1, big: true });
    expect(core.getState().speedLevel).toBe(10);
    core.dispatch({ type: 'setSpeed', level: 0.2 });
    core.dispatch({ type: 'nudgeSpeed', direction: -1, big: true });
    expect(core.getState().speedLevel).toBe(0);
  });

  it('a nudge while playing changes the pace without pausing', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'setSpeed', level: 2 });
    core.dispatch({ type: 'play' });
    core.dispatch({ type: 'nudgeSpeed', direction: 1, big: true });
    expect(core.getState().playing).toBe(true);
    const p = core.getState().position;
    clock.advance(1000);
    expect(core.getState().position - p).toBeCloseTo(1.25);
  });
});
