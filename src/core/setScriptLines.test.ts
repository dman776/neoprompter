import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemoryLibraryStorage } from './library';
import type { ScriptLine } from './types';

function setup(lines: ScriptLine[] = ['a', 'b', 'c', 'd']) {
  const libraryStorage = createMemoryLibraryStorage();
  const core = createCore({
    clock: createFakeClock(),
    script: { name: 't', lines },
    libraryStorage,
  });
  core.dispatch({ type: 'saveScript', name: 't', text: lines.join('\n') });
  core.dispatch({ type: 'loadScript', id: core.getState().library[0].id });
  return { core, libraryStorage };
}

describe('setScriptLines (the editor saving)', () => {
  it('replaces the loaded Script and saves it to the library', () => {
    const { core, libraryStorage } = setup();
    const revision = core.getState().scriptRevision;
    const lines: ScriptLine[] = ['a', { runs: [{ text: 'B', bold: true }] }, 'c', 'd'];
    core.dispatch({ type: 'setScriptLines', lines });
    expect(core.getState().script.lines).toEqual(lines);
    expect(core.getState().scriptRevision).toBe(revision + 1);
    expect(libraryStorage.readAll()[0].lines).toEqual(lines);
  });

  it('does nothing when the lines are unchanged', () => {
    const { core } = setup();
    const revision = core.getState().scriptRevision;
    core.dispatch({ type: 'setScriptLines', lines: ['a', 'b', 'c', 'd'] });
    expect(core.getState().scriptRevision).toBe(revision);
  });

  it('keeps the reading position on the same text when lines are added above it', () => {
    const { core } = setup();
    core.dispatch({ type: 'setViewport', lines: 2 });
    core.dispatch({ type: 'scrollBy', lines: 6 });
    const before = core.getState().position;
    core.dispatch({ type: 'setScriptLines', lines: ['new', 'a', 'b', 'c', 'd'] });
    expect(core.getState().position).toBe(before + 1);
  });

  it('accepts any #rrggbb color as-is and refuses other color text', () => {
    const { core } = setup();
    core.dispatch({
      type: 'setScriptLines',
      lines: [{ runs: [{ text: 'x', color: '#123456' }] }, { runs: [{ text: 'y', color: 'red' }] }],
    });
    expect(core.getState().script.lines).toEqual([
      { runs: [{ text: 'x', color: '#123456' }] },
      'y',
    ]);
  });

  it('never stores fonts or sizes', () => {
    const { core } = setup();
    core.dispatch({
      type: 'setScriptLines',
      lines: [{ runs: [{ text: 'x', fontSize: 40, fontFamily: 'Comic Sans' } as never] }],
    });
    expect(JSON.stringify(core.getState().script.lines)).not.toMatch(/font|size/i);
  });

  it('keeps at least one line', () => {
    const { core } = setup();
    core.dispatch({ type: 'setScriptLines', lines: [] });
    expect(core.getState().script.lines).toEqual(['']);
  });
});
