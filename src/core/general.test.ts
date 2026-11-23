import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemorySessionStore } from './session';

function env() {
  return { clock: createFakeClock(), sessionStore: createMemorySessionStore() };
}

describe('General settings: theme', () => {
  it('starts dark', () => {
    expect(createCore(env()).getState().theme).toBe('dark');
  });

  it('switches to light, ignores anything else, and is remembered', () => {
    const e = env();
    const core = createCore(e);
    core.dispatch({ type: 'setTheme', theme: 'light' });
    core.dispatch({ type: 'setTheme', theme: 'pink' as never });
    expect(core.getState().theme).toBe('light');
    expect(createCore(e).getState().theme).toBe('light');
  });

  it('is dark when restoring a session saved before themes existed', () => {
    const e = env();
    createCore(e).dispatch({ type: 'pause' });
    const old = e.sessionStore.load()!;
    delete old.theme;
    e.sessionStore.save(old);
    expect(createCore(e).getState().theme).toBe('dark');
  });
});

describe('General settings: the mode the app opens in', () => {
  it('opens in the mode last used by default', () => {
    const e = env();
    expect(createCore(e).getState().openInMode).toBe('last');
    createCore(e).dispatch({ type: 'setMode', mode: 'run' });
    expect(createCore(e).getState().mode).toBe('run');
  });

  it('opens in Edit mode every time when set to Edit', () => {
    const e = env();
    const core = createCore(e);
    core.dispatch({ type: 'setOpenInMode', openIn: 'edit' });
    core.dispatch({ type: 'setMode', mode: 'run' });
    expect(createCore(e).getState().mode).toBe('edit');
    expect(createCore(e).getState().openInMode).toBe('edit');
  });

  it('opens in Run mode every time when set to Run', () => {
    const e = env();
    createCore(e).dispatch({ type: 'setOpenInMode', openIn: 'run' });
    expect(createCore(e).getState().mode).toBe('run');
  });

  it('ignores a value that does not exist', () => {
    const core = createCore(env());
    core.dispatch({ type: 'setOpenInMode', openIn: 'live' as never });
    expect(core.getState().openInMode).toBe('last');
  });
});
