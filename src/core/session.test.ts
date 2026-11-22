import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemorySessionStore } from './session';
import { createMemoryLibraryStorage } from './library';
import { createMemoryPresetStore } from './presets';

function env() {
  return {
    clock: createFakeClock(),
    sessionStore: createMemorySessionStore(),
    libraryStorage: createMemoryLibraryStorage(),
    presetStore: createMemoryPresetStore(),
  };
}

const longText = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');

describe('restore on launch', () => {
  it('a first launch has nothing to restore and shows the Output', () => {
    const core = createCore(env());
    expect(core.getState().outputBlank).toBe(false);
  });

  it('autosaves after every command and restores Script, position and Preset', () => {
    const e = env();
    const a = createCore(e);
    a.dispatch({ type: 'saveScript', name: 'Show', text: longText });
    a.dispatch({ type: 'loadScript', id: '1' });
    a.dispatch({ type: 'setAppearance', changes: { fontSize: 72 } });
    a.dispatch({ type: 'savePreset', name: 'Stage' });
    a.dispatch({ type: 'jumpForward' });
    const before = a.getState();

    const b = createCore(e).getState();
    expect(b.script.name).toBe('Show');
    expect(b.loadedScriptId).toBe('1');
    expect(b.position).toBe(before.position);
    expect(b.activePreset).toBe('Stage');
    expect(b.appearance.fontSize).toBe(72);
  });

  it('always restores paused, and never scrolls afterwards', () => {
    const e = env();
    const a = createCore(e);
    a.dispatch({ type: 'play' });
    e.clock.advance(3000);
    a.dispatch({ type: 'setSpeed', level: 4 });
    const b = createCore(e);
    expect(b.getState().playing).toBe(false);
    const p = b.getState().position;
    e.clock.advance(10000);
    expect(b.getState().position).toBe(p);
    expect(b.getState().speedLevel).toBe(4);
  });

  it('keeps the Output blank until the Operator confirms', () => {
    const e = env();
    createCore(e).dispatch({ type: 'pause' });
    const b = createCore(e);
    expect(b.getState().outputBlank).toBe(true);
    b.dispatch({ type: 'jumpForward' });
    expect(b.getState().outputBlank).toBe(true);
    b.dispatch({ type: 'confirmOutput' });
    expect(b.getState().outputBlank).toBe(false);
  });

  it('survives a crash mid-play: saved state is at most about a second stale', () => {
    const e = env();
    const a = createCore(e);
    a.dispatch({ type: 'play' });
    for (let i = 0; i < 10; i++) {
      e.clock.advance(1000);
      a.getState(); // the app polls state while playing
    }
    const crashed = a.getState().position;
    const b = createCore(e).getState();
    expect(b.playing).toBe(false);
    expect(crashed - b.position).toBeLessThanOrEqual(1.5);
    expect(b.position).toBeGreaterThan(-b.leadIn + 1);
  });

  it('falls back to defaults when the saved Script was deleted from the library', () => {
    const e = env();
    const a = createCore(e);
    a.dispatch({ type: 'saveScript', name: 'Show', text: longText });
    a.dispatch({ type: 'loadScript', id: '1' });
    a.dispatch({ type: 'deleteScript', id: '1' });
    const b = createCore(e).getState();
    expect(b.loadedScriptId).toBeNull();
    expect(b.script.lines.length).toBeGreaterThan(0);
  });
});
