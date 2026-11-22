import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';

const script = (n: number) => ({
  name: 't',
  lines: Array.from({ length: n }, (_, i) => `line ${i}`),
});

function setupWith(n: number, viewport = 10) {
  const clock = createFakeClock();
  const core = createCore({ clock, script: script(n) });
  core.dispatch({ type: 'setViewport', lines: viewport });
  return { clock, core };
}

describe('core playback behavior', () => {
  it('starts with blank lead-in lines before the first line', () => {
    const { core } = setupWith(50);
    const s = core.getState();
    expect(s.leadIn).toBeGreaterThan(0);
    expect(s.position).toBe(-s.leadIn);
  });

  it('speed is in lines per second and unchanged by font size (viewport lines)', () => {
    const { clock, core } = setupWith(500);
    core.dispatch({ type: 'setSpeed', level: 4 });
    const before = core.getState().position;
    core.dispatch({ type: 'play' });
    clock.advance(1000);
    const a = core.getState().position - before;
    core.dispatch({ type: 'setViewport', lines: 5 }); // bigger font => fewer lines visible
    const mid = core.getState().position;
    clock.advance(1000);
    const b = core.getState().position - mid;
    expect(a).toBeCloseTo(b);
    expect(a).toBeCloseTo(core.getState().speed);
  });

  it('speed level zero stops the scroll, and pause then play keeps the last speed', () => {
    const { clock, core } = setupWith(500);
    core.dispatch({ type: 'setSpeed', level: 5 });
    const speed = core.getState().speed;
    expect(speed).toBeGreaterThan(0);
    core.dispatch({ type: 'play' });
    core.dispatch({ type: 'pause' });
    core.dispatch({ type: 'play' });
    expect(core.getState().speed).toBe(speed);
    core.dispatch({ type: 'setSpeed', level: 0 });
    const p = core.getState().position;
    clock.advance(3000);
    expect(core.getState().speed).toBe(0);
    expect(core.getState().position).toBe(p);
  });

  it('jumps one Screen (Output height minus one line) back and forward', () => {
    const { core } = setupWith(100, 10);
    core.dispatch({ type: 'jumpForward' });
    core.dispatch({ type: 'jumpForward' });
    const start = core.getState().position;
    expect(start).toBe(-core.getState().leadIn + 18);
    core.dispatch({ type: 'jumpBack' });
    expect(core.getState().position).toBe(start - 9);
  });

  it('jumping back stops at the top of the lead-in', () => {
    const { core } = setupWith(100, 10);
    core.dispatch({ type: 'jumpBack' });
    expect(core.getState().position).toBe(-core.getState().leadIn);
  });

  it('returns to the last play-start position', () => {
    const { clock, core } = setupWith(200, 10);
    core.dispatch({ type: 'jumpForward' });
    const startPos = core.getState().position;
    core.dispatch({ type: 'play' });
    clock.advance(4000);
    core.dispatch({ type: 'jumpForward' });
    core.dispatch({ type: 'returnToPlayStart' });
    expect(core.getState().position).toBe(startPos);
  });

  it('stops at the end with the last lines visible and never loops', () => {
    const { clock, core } = setupWith(30, 10);
    core.dispatch({ type: 'play' });
    clock.advance(600_000);
    const s = core.getState();
    expect(s.position).toBe(30 - 10);
    expect(s.playing).toBe(false);
    clock.advance(600_000);
    expect(core.getState().position).toBe(20);
    core.dispatch({ type: 'jumpForward' });
    expect(core.getState().position).toBe(20);
  });
});
