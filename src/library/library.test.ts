import { describe, expect, it } from 'vitest';
import { createCore, createFakeClock } from '../core';
import { createFileLibraryStorage, type LibraryFs } from './index';

function fakeFs(initial: Record<string, string> = {}): LibraryFs & { files: Record<string, string> } {
  const files = { ...initial };
  return {
    files,
    readFile: (p) => (p in files ? files[p] : null),
    writeFile: (p, d) => {
      files[p] = d;
    },
  };
}

describe('file-backed library', () => {
  it('survives an app restart', () => {
    const fs = fakeFs();
    const first = createCore({ clock: createFakeClock(), libraryStorage: createFileLibraryStorage('lib.json', fs) });
    first.dispatch({ type: 'saveScript', name: 'Sunday', text: 'a\nb' });
    const second = createCore({ clock: createFakeClock(), libraryStorage: createFileLibraryStorage('lib.json', fs) });
    expect(second.getState().library.map((s) => s.name)).toEqual(['Sunday']);
  });

  it('starts empty when the file is corrupt', () => {
    const fs = fakeFs({ 'lib.json': '{not json' });
    const core = createCore({ clock: createFakeClock(), libraryStorage: createFileLibraryStorage('lib.json', fs) });
    expect(core.getState().library).toEqual([]);
  });
});
