import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';

function setup(lines = 300) {
  const clock = createFakeClock();
  const core = createCore({
    clock,
    script: { name: 't', lines: Array.from({ length: lines }, (_, i) => `line ${i}`) },
  });
  core.dispatch({ type: 'setViewport', lines: 10 });
  core.dispatch({ type: 'setSpeed', level: 4 }); // 2 lines per second
  return { clock, core };
}

describe('playing in reverse', () => {
  it('plays forward unless told otherwise, and says so', () => {
    const { clock, core } = setup();
    expect(core.getState().direction).toBe('forward');
    const before = core.getState().position;
    core.dispatch({ type: 'play' });
    clock.advance(1000);
    expect(core.getState().direction).toBe('forward');
    expect(core.getState().position).toBeCloseTo(before + 2);
  });

  it('plays back at the same speed, and says so', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'scrollBy', lines: 40 });
    const before = core.getState().position;
    core.dispatch({ type: 'play', direction: 'reverse' });
    expect(core.getState().playing).toBe(true);
    expect(core.getState().direction).toBe('reverse');
    clock.advance(1000);
    expect(core.getState().position).toBeCloseTo(before - 2);
    clock.advance(2000);
    expect(core.getState().position).toBeCloseTo(before - 6);
  });

  it('follows the speed while it plays back', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'scrollBy', lines: 100 });
    core.dispatch({ type: 'play', direction: 'reverse' });
    core.dispatch({ type: 'setSpeed', level: 10 }); // 5 lines per second
    const before = core.getState().position;
    clock.advance(1000);
    expect(core.getState().position).toBeCloseTo(before - 5);
  });

  it('stops at the start of the Script and is forward again', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'scrollBy', lines: 6 });
    core.dispatch({ type: 'play', direction: 'reverse' });
    clock.advance(60_000);
    const s = core.getState();
    expect(s.playing).toBe(false);
    expect(s.position).toBe(-s.leadIn);
    expect(s.direction).toBe('forward');
  });

  it('will not start playing back from the very start', () => {
    const { core } = setup();
    core.dispatch({ type: 'play', direction: 'reverse' });
    expect(core.getState().playing).toBe(false);
    expect(core.getState().direction).toBe('forward');
  });

  it('turns round when told to play the other way, without stopping', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'scrollBy', lines: 40 });
    core.dispatch({ type: 'play' });
    clock.advance(1000);
    const mid = core.getState().position;
    core.dispatch({ type: 'play', direction: 'reverse' });
    expect(core.getState().playing).toBe(true);
    expect(core.getState().direction).toBe('reverse');
    clock.advance(1000);
    expect(core.getState().position).toBeCloseTo(mid - 2);
    core.dispatch({ type: 'play' });
    expect(core.getState().direction).toBe('forward');
    clock.advance(1000);
    expect(core.getState().position).toBeCloseTo(mid);
  });

  it('sets the way a stopped Script will play, and says so before it starts', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'scrollBy', lines: 40 });
    const before = core.getState().position;
    core.dispatch({ type: 'setDirection', direction: 'reverse' });
    expect(core.getState()).toMatchObject({ playing: false, direction: 'reverse' });
    core.dispatch({ type: 'play', direction: 'reverse' });
    clock.advance(1000);
    expect(core.getState().position).toBeCloseTo(before - 2);
    core.dispatch({ type: 'pause' });
    core.dispatch({ type: 'setDirection', direction: 'reverse' });
    core.dispatch({ type: 'setDirection', direction: 'forward' });
    expect(core.getState().direction).toBe('forward');
  });

  it('turns a playing Script round with setDirection, but not past an end', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'scrollBy', lines: 40 });
    core.dispatch({ type: 'play' });
    core.dispatch({ type: 'setDirection', direction: 'reverse' });
    expect(core.getState()).toMatchObject({ playing: true, direction: 'reverse' });
    clock.advance(60_000);
    expect(core.getState()).toMatchObject({ playing: false, direction: 'forward' });
    core.dispatch({ type: 'play' });
    core.dispatch({ type: 'setDirection', direction: 'reverse' });
    // At the very start there is nowhere to go back to, so it stops and is forward.
    expect(core.getState()).toMatchObject({ playing: false, direction: 'forward' });
  });

  it('is forward again after a pause, so Space always means forward', () => {
    const { core } = setup();
    core.dispatch({ type: 'scrollBy', lines: 40 });
    core.dispatch({ type: 'play', direction: 'reverse' });
    core.dispatch({ type: 'pause' });
    expect(core.getState().playing).toBe(false);
    expect(core.getState().direction).toBe('forward');
  });

  it('keeps the ring working on top of reverse playback', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'scrollBy', lines: 100 });
    core.dispatch({ type: 'play', direction: 'reverse' });
    core.dispatch({ type: 'setRing', deflection: 0.5 }); // +10 lines per second
    const before = core.getState().position;
    clock.advance(1000);
    expect(core.getState().position).toBeCloseTo(before - 2 + 10);
  });

  it('never restores a Script playing, or in reverse, after a restart', () => {
    const { core } = setup();
    core.dispatch({ type: 'scrollBy', lines: 40 });
    core.dispatch({ type: 'play', direction: 'reverse' });
    const sessions: unknown[] = [];
    const again = createCore({
      clock: createFakeClock(),
      script: { name: 't', lines: ['a', 'b'] },
      sessionStore: {
        load: () => (sessions[0] as never) ?? null,
        save: (s) => void sessions.push(s),
      },
    });
    expect(again.getState().playing).toBe(false);
    expect(again.getState().direction).toBe('forward');
  });
});
