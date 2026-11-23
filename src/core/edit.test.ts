import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemoryLibraryStorage } from './library';
import { lineRuns, lineText } from './richScript';
import type { ScriptLine } from './types';

function setup(lines: ScriptLine[] = Array.from({ length: 10 }, (_, i) => `line ${i}`)) {
  const clock = createFakeClock();
  const libraryStorage = createMemoryLibraryStorage();
  const core = createCore({ clock, script: { name: 't', lines }, speed: 1, libraryStorage });
  core.dispatch({ type: 'setViewport', lines: 2 });
  return { clock, core, libraryStorage };
}
const texts = (core: ReturnType<typeof setup>['core']) =>
  core.getState().script.lines.map(lineText);

describe('minimal editor', () => {
  it('fixes a typo in a line', () => {
    const { core } = setup();
    core.dispatch({ type: 'editLine', line: 2, text: 'lyne 2' });
    expect(texts(core)[2]).toBe('lyne 2');
  });

  it('keeps styling on untouched text when editing a styled line', () => {
    const { core } = setup([
      {
        runs: [
          { text: 'hello ', bold: true },
          { text: 'wrld', color: '#ff0000' },
        ],
      },
    ]);
    core.dispatch({ type: 'editLine', line: 0, text: 'hello world' });
    expect(lineRuns(core.getState().script.lines[0])).toEqual([
      { text: 'hello ', bold: true },
      { text: 'world', color: '#ff0000' },
    ]);
  });

  it('cuts lines', () => {
    const { core } = setup();
    core.dispatch({ type: 'cutLines', from: 1, count: 2 });
    expect(texts(core).slice(0, 3)).toEqual(['line 0', 'line 3', 'line 4']);
  });

  it('colors a range', () => {
    const { core } = setup();
    const color = '#00ff00';
    core.dispatch({ type: 'colorRange', line: 0, start: 0, end: 4, color });
    expect(lineRuns(core.getState().script.lines[0])).toEqual([
      { text: 'line', color },
      { text: ' 0' },
    ]);
  });

  it('clears color with null', () => {
    const { core } = setup();
    core.dispatch({ type: 'colorRange', line: 0, start: 0, end: 4, color: '#00ff00' });
    core.dispatch({ type: 'colorRange', line: 0, start: 0, end: 4, color: null });
    expect(lineRuns(core.getState().script.lines[0]).map((r) => r.color)).toEqual([undefined]);
  });

  it('rejects colors that are not #rrggbb', () => {
    const { core } = setup();
    core.dispatch({ type: 'colorRange', line: 0, start: 0, end: 4, color: 'red' });
    expect(core.getState().script.lines[0]).toBe('line 0');
  });

  it('updates the library copy of a loaded Script', () => {
    const { core, libraryStorage } = setup();
    core.dispatch({ type: 'saveScript', name: 's', text: 'a\nb\nc' });
    core.dispatch({ type: 'loadScript', id: '1' });
    core.dispatch({ type: 'editLine', line: 1, text: 'B' });
    core.dispatch({ type: 'cutLines', from: 2, count: 1 });
    expect(libraryStorage.readAll()[0].text).toBe('a\nB');
  });

  it('notifies subscribers (Output) immediately on edit', () => {
    const { core } = setup();
    let seen = '';
    core.subscribe((s) => (seen = lineText(s.script.lines[0])));
    core.dispatch({ type: 'editLine', line: 0, text: 'fixed' });
    expect(seen).toBe('fixed');
  });

  describe('reading position', () => {
    function reading() {
      const s = setup();
      s.core.dispatch({ type: 'play' });
      s.clock.advance(7500); // position = -4 + 7.5 = 3.5, on "line 3"
      s.core.dispatch({ type: 'pause' });
      return s;
    }
    it('stays put when editing text without changing line count', () => {
      const { core } = reading();
      core.dispatch({ type: 'editLine', line: 0, text: 'x' });
      expect(core.getState().position).toBeCloseTo(3.5);
    });
    it('keeps the same text when lines above are cut', () => {
      const { core } = reading();
      core.dispatch({ type: 'cutLines', from: 0, count: 2 });
      expect(core.getState().position).toBeCloseTo(1.5);
      expect(texts(core)[1]).toBe('line 3');
    });
    it('keeps the same text when a line above is split in two', () => {
      const { core } = reading();
      core.dispatch({ type: 'editLine', line: 1, text: 'a\nb' });
      expect(core.getState().position).toBeCloseTo(4.5);
      expect(texts(core)[4]).toBe('line 3');
    });
    it('ignores edits below the reading position', () => {
      const { core } = reading();
      core.dispatch({ type: 'cutLines', from: 6, count: 2 });
      expect(core.getState().position).toBeCloseTo(3.5);
    });
    it('moves to the cut point when the current line is cut', () => {
      const { core } = reading();
      core.dispatch({ type: 'cutLines', from: 2, count: 3 });
      expect(core.getState().position).toBeCloseTo(2);
    });
  });
});
