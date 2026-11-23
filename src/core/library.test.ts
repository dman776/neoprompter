import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemoryLibraryStorage } from './library';

function setup(storage = createMemoryLibraryStorage()) {
  const clock = createFakeClock();
  const core = createCore({ clock, libraryStorage: storage });
  return { clock, core, storage };
}

describe('script library', () => {
  it('starts empty', () => {
    expect(setup().core.getState().library).toEqual([]);
  });

  it('saves a pasted Script and lists it without loading it', () => {
    const { core } = setup();
    const before = core.getState().script;
    core.dispatch({ type: 'saveScript', name: 'Sunday', text: 'Hello\nWorld' });
    const state = core.getState();
    expect(state.library.map((s) => s.name)).toEqual(['Sunday']);
    expect(state.script).toEqual(before);
    expect(state.loadedScriptId).toBeNull();
  });

  it('loads a saved Script, replacing the previous one and resetting position', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'saveScript', name: 'A', text: 'a1\na2' });
    core.dispatch({ type: 'saveScript', name: 'B', text: 'b1\nb2\nb3' });
    const [a, b] = core.getState().library;
    core.dispatch({ type: 'loadScript', id: a.id });
    core.dispatch({ type: 'play' });
    clock.advance(1000);
    core.dispatch({ type: 'loadScript', id: b.id });
    const state = core.getState();
    expect(state.script).toEqual({ name: 'B', lines: ['b1', 'b2', 'b3'] });
    expect(state.loadedScriptId).toBe(b.id);
    expect(state.position).toBe(-state.leadIn);
    expect(state.playing).toBe(false);
  });

  it('ignores loading an unknown id', () => {
    const { core } = setup();
    const before = core.getState();
    core.dispatch({ type: 'loadScript', id: 'nope' });
    expect(core.getState()).toEqual(before);
  });

  it('renames a Script, updating the Output if it is loaded', () => {
    const { core } = setup();
    core.dispatch({ type: 'saveScript', name: 'Old', text: 'x' });
    const id = core.getState().library[0].id;
    core.dispatch({ type: 'loadScript', id });
    core.dispatch({ type: 'renameScript', id, name: 'New' });
    const state = core.getState();
    expect(state.library[0].name).toBe('New');
    expect(state.script.name).toBe('New');
  });

  it('deletes a Script; a loaded one stays on the Output but is no longer loaded from the library', () => {
    const { core } = setup();
    core.dispatch({ type: 'saveScript', name: 'A', text: 'a' });
    core.dispatch({ type: 'saveScript', name: 'B', text: 'b' });
    const [a, b] = core.getState().library;
    core.dispatch({ type: 'loadScript', id: a.id });
    core.dispatch({ type: 'deleteScript', id: b.id });
    expect(core.getState().library.map((s) => s.name)).toEqual(['A']);
    core.dispatch({ type: 'deleteScript', id: a.id });
    const state = core.getState();
    expect(state.library).toEqual([]);
    expect(state.loadedScriptId).toBeNull();
    expect(state.script.name).toBe('A');
  });

  it('persists through storage and gives new Scripts unique ids after reload', () => {
    const storage = createMemoryLibraryStorage();
    const first = setup(storage).core;
    first.dispatch({ type: 'saveScript', name: 'A', text: 'a' });
    const second = setup(storage).core;
    expect(second.getState().library.map((s) => s.name)).toEqual(['A']);
    second.dispatch({ type: 'saveScript', name: 'B', text: 'b' });
    const ids = second.getState().library.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('notifies subscribers when the library changes', () => {
    const { core } = setup();
    let seen = 0;
    core.subscribe(() => seen++);
    core.dispatch({ type: 'saveScript', name: 'A', text: 'a' });
    expect(seen).toBe(1);
  });

  it('lists when each Script was last edited', () => {
    const { clock, core } = setup();
    clock.advance(1000);
    core.dispatch({ type: 'saveScript', name: 'A', text: 'a' });
    expect(core.getState().library[0].editedAt).toBe(1000);
    const id = core.getState().library[0].id;
    core.dispatch({ type: 'loadScript', id });
    clock.advance(5000);
    core.dispatch({ type: 'setScriptLines', lines: ['changed'] });
    expect(core.getState().library[0].editedAt).toBe(6000);
    clock.advance(1000);
    core.dispatch({ type: 'renameScript', id, name: 'A2' });
    expect(core.getState().library[0].editedAt).toBe(7000);
  });

  it('creates a new empty Script and loads it', () => {
    const { core } = setup();
    core.dispatch({ type: 'newScript' });
    const state = core.getState();
    expect(state.library).toHaveLength(1);
    expect(state.loadedScriptId).toBe(state.library[0].id);
    expect(state.script).toEqual({ name: state.library[0].name, lines: [''] });
    expect(state.library[0].name).toBe('New Script');
  });

  it('duplicates a Script under a new name without loading the copy', () => {
    const { clock, core } = setup();
    core.dispatch({ type: 'saveScript', name: 'Sunday', text: 'a\nb', lines: ['a', 'b'] });
    const id = core.getState().library[0].id;
    clock.advance(10);
    core.dispatch({ type: 'duplicateScript', id });
    const state = core.getState();
    expect(state.library.map((s) => s.name)).toEqual(['Sunday', 'Sunday copy']);
    expect(state.library[1].editedAt).toBe(10);
    expect(state.loadedScriptId).toBeNull();
    core.dispatch({ type: 'loadScript', id: state.library[1].id });
    expect(core.getState().script.lines).toEqual(['a', 'b']);
  });

  it('ignores duplicating an unknown id', () => {
    const { core } = setup();
    core.dispatch({ type: 'duplicateScript', id: 'nope' });
    expect(core.getState().library).toEqual([]);
  });
});
