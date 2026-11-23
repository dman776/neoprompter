import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemorySessionStore } from './session';

function env() {
  return { clock: createFakeClock(), sessionStore: createMemorySessionStore() };
}

describe('the theme', () => {
  it('starts dark', () => {
    expect(createCore(env()).getState().theme).toBe('dark');
  });

  it('switches to light and back', () => {
    const core = createCore(env());
    core.dispatch({ type: 'setTheme', theme: 'light' });
    expect(core.getState().theme).toBe('light');
    core.dispatch({ type: 'setTheme', theme: 'dark' });
    expect(core.getState().theme).toBe('dark');
  });

  it('ignores a theme that does not exist', () => {
    const core = createCore(env());
    core.dispatch({ type: 'setTheme', theme: 'light' });
    core.dispatch({ type: 'setTheme', theme: 'sepia' as never });
    expect(core.getState().theme).toBe('light');
  });

  it('reopens in the theme last used', () => {
    const e = env();
    createCore(e).dispatch({ type: 'setTheme', theme: 'light' });
    expect(createCore(e).getState().theme).toBe('light');
  });

  it('is dark for a session saved before themes existed', () => {
    const e = env();
    createCore(e).dispatch({ type: 'setMode', mode: 'run' });
    expect(createCore(e).getState().theme).toBe('dark');
  });
});

describe('the right-hand column', () => {
  it('starts expanded', () => {
    expect(createCore(env()).getState().rightColumnCollapsed).toBe(false);
  });

  it('collapses and expands', () => {
    const core = createCore(env());
    core.dispatch({ type: 'setRightColumnCollapsed', collapsed: true });
    expect(core.getState().rightColumnCollapsed).toBe(true);
    core.dispatch({ type: 'setRightColumnCollapsed', collapsed: false });
    expect(core.getState().rightColumnCollapsed).toBe(false);
  });

  it('keeps its state when the mode changes', () => {
    const core = createCore(env());
    core.dispatch({ type: 'setRightColumnCollapsed', collapsed: true });
    core.dispatch({ type: 'setMode', mode: 'run' });
    core.dispatch({ type: 'setMode', mode: 'edit' });
    expect(core.getState().rightColumnCollapsed).toBe(true);
  });

  it('reopens collapsed when it was left collapsed', () => {
    const e = env();
    createCore(e).dispatch({ type: 'setRightColumnCollapsed', collapsed: true });
    expect(createCore(e).getState().rightColumnCollapsed).toBe(true);
  });
});
