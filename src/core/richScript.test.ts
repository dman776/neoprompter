import { describe, expect, it } from 'vitest';
import { createCore } from './core';
import { createFakeClock } from './clock';
import { createMemoryLibraryStorage } from './library';
import { lineHeading, lineRuns, lineText } from './richScript';
import type { ScriptLine } from './types';

describe('rich Script lines', () => {
  it('treats a plain string as one unstyled run', () => {
    expect(lineRuns('hello')).toEqual([{ text: 'hello' }]);
    expect(lineText('hello')).toBe('hello');
    expect(lineHeading('hello')).toBeUndefined();
  });

  it('reads text and heading from a styled line', () => {
    const line: ScriptLine = {
      heading: 2,
      runs: [{ text: 'Hi ', bold: true }, { text: 'there', color: '#ff0000' }],
    };
    expect(lineText(line)).toBe('Hi there');
    expect(lineHeading(line)).toBe(2);
  });
});

describe('rich Scripts in the library', () => {
  const lines: ScriptLine[] = [
    { heading: 1, runs: [{ text: 'Welcome' }] },
    { runs: [{ text: 'plain ' }, { text: 'bold', bold: true }, { text: 'red', color: '#c00000' }] },
  ];

  it('saves styled lines and loads them back unchanged', () => {
    const core = createCore({ clock: createFakeClock() });
    core.dispatch({ type: 'saveScript', name: 'Rich', text: 'Welcome\nplain boldred', lines });
    core.dispatch({ type: 'loadScript', id: core.getState().library[0].id });
    expect(core.getState().script).toEqual({ name: 'Rich', lines });
  });

  it('loads a plain-text stored Script saved before styled lines existed', () => {
    const storage = createMemoryLibraryStorage([{ id: '1', name: 'Old', text: 'a\nb' }]);
    const core = createCore({ clock: createFakeClock(), libraryStorage: storage });
    core.dispatch({ type: 'loadScript', id: '1' });
    expect(core.getState().script.lines).toEqual(['a', 'b']);
  });

  it('keeps styled lines when the library is re-read from storage', () => {
    const storage = createMemoryLibraryStorage();
    const first = createCore({ clock: createFakeClock(), libraryStorage: storage });
    first.dispatch({ type: 'saveScript', name: 'Rich', text: 'x', lines });
    const second = createCore({ clock: createFakeClock(), libraryStorage: storage });
    second.dispatch({ type: 'loadScript', id: second.getState().library[0].id });
    expect(second.getState().script.lines).toEqual(lines);
  });
});
