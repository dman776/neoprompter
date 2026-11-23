import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemorySessionStore } from './session';

function env() {
  return { clock: createFakeClock(), sessionStore: createMemorySessionStore() };
}

describe('Edit mode and Run mode', () => {
  it('starts in Edit mode on a first launch', () => {
    expect(createCore(env()).getState().mode).toBe('edit');
  });

  it('switches between Edit mode and Run mode', () => {
    const core = createCore(env());
    core.dispatch({ type: 'setMode', mode: 'run' });
    expect(core.getState().mode).toBe('run');
    core.dispatch({ type: 'setMode', mode: 'edit' });
    expect(core.getState().mode).toBe('edit');
  });

  it('ignores a mode that does not exist', () => {
    const core = createCore(env());
    core.dispatch({ type: 'setMode', mode: 'run' });
    core.dispatch({ type: 'setMode', mode: 'live' as never });
    expect(core.getState().mode).toBe('run');
  });

  it('notifies subscribers when the mode changes', () => {
    const core = createCore(env());
    const seen: string[] = [];
    core.subscribe((s) => seen.push(s.mode));
    core.dispatch({ type: 'setMode', mode: 'run' });
    expect(seen).toEqual(['run']);
  });

  it('reopens in the mode last used', () => {
    const e = env();
    createCore(e).dispatch({ type: 'setMode', mode: 'run' });
    expect(createCore(e).getState().mode).toBe('run');
  });

  it('reopens in Edit mode from a session saved before modes existed', () => {
    const e = env();
    createCore(e).dispatch({ type: 'pause' });
    const old = e.sessionStore.load()!;
    delete old.mode;
    e.sessionStore.save(old);
    expect(createCore(e).getState().mode).toBe('edit');
  });
});
