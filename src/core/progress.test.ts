import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';

function setup() {
  const clock = createFakeClock();
  const script = { name: 't', lines: Array.from({ length: 10 }, (_, i) => `line ${i}`) };
  const core = createCore({ clock, script, speed: 1 });
  return { clock, core };
}

describe('core progress', () => {
  it('is 0 at the start of the Script', () => {
    expect(setup().core.getState().progress).toBe(0);
  });

  it('is the fraction of the Script read in the middle', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'play' });
    clock.advance(5000);
    expect(core.getState().progress).toBeCloseTo(0.5);
  });

  it('is 1 at the end and stays 1 past it', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'play' });
    clock.advance(10000);
    expect(core.getState().progress).toBe(1);
    clock.advance(5000);
    expect(core.getState().progress).toBe(1);
  });

  it('is 0 for an empty Script', () => {
    const core = createCore({ clock: createFakeClock(), script: { name: 'e', lines: [] } });
    expect(core.getState().progress).toBe(0);
  });
});
