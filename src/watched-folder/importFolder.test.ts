import { describe, expect, it } from 'vitest';
import { createCore, createFakeClock, createMemoryLibraryStorage } from '../core';
import type { ImportResult } from '../import';
import { importWatchedFolder, uniqueName, type WatchedFolderFs } from './index';

/** A fake disk: a map from full path to bytes, folders implied by the paths. */
function fakeFs(files: Record<string, string>) {
  const disk = new Map(Object.entries(files));
  const moves: Array<[string, string]> = [];
  const fs: WatchedFolderFs & { disk: Map<string, string>; moves: Array<[string, string]> } = {
    disk,
    moves,
    join: (...parts) => parts.join('/'),
    listFiles(dir) {
      const prefix = `${dir}/`;
      const names = [...disk.keys()]
        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .map((p) => p.slice(prefix.length));
      const known = names.length > 0 || [...disk.keys()].some((p) => p.startsWith(prefix));
      return known || dir === '/Drop' ? names : null;
    },
    readFile: (p) => new TextEncoder().encode(disk.get(p) ?? ''),
    exists: (p) => disk.has(p),
    moveFile(from, to) {
      disk.set(to, disk.get(from)!);
      disk.delete(from);
      moves.push([from, to]);
    },
  };
  return fs;
}

/** Stands in for importDocument: the file's text is its single line; "BAD" fails. */
const fakeImport = (bytes: Uint8Array, fileName: string): ImportResult => {
  const text = new TextDecoder().decode(bytes);
  if (text === 'BAD') return { ok: false, message: `"${fileName}" is not readable.` };
  return {
    ok: true,
    script: { name: fileName.replace(/\.docx?$/i, ''), lines: [text] },
  };
};

function setup(files: Record<string, string>) {
  const core = createCore({
    clock: createFakeClock(),
    libraryStorage: createMemoryLibraryStorage(),
  });
  const fs = fakeFs(files);
  const run = () => importWatchedFolder('/Drop', { fs, core, importDocument: fakeImport });
  return { core, fs, run };
}

const names = (core: ReturnType<typeof setup>['core']) =>
  core.getState().library.map((s) => s.name);

describe('importWatchedFolder', () => {
  it('Imports the Word files and ignores everything else', () => {
    const { core, fs, run } = setup({
      '/Drop/Sunday.docx': 'sunday',
      '/Drop/Old.doc': 'old',
      '/Drop/notes.txt': 'text',
      '/Drop/~$Sunday.docx': 'lock',
      '/Drop/.hidden.docx': 'hidden',
      '/Drop/imported/Done.docx': 'done',
    });
    const result = run();
    expect(result.imported).toEqual(['Old', 'Sunday']);
    expect(names(core).sort()).toEqual(['Old', 'Sunday']);
    expect(fs.disk.has('/Drop/notes.txt')).toBe(true);
    expect(fs.disk.has('/Drop/~$Sunday.docx')).toBe(true);
    expect(fs.disk.has('/Drop/.hidden.docx')).toBe(true);
  });

  it('moves an Imported file into imported/', () => {
    const { fs, run } = setup({ '/Drop/Sunday.docx': 'sunday' });
    run();
    expect(fs.disk.has('/Drop/Sunday.docx')).toBe(false);
    expect(fs.disk.has('/Drop/imported/Sunday.docx')).toBe(true);
  });

  it('leaves a file that fails to Import in place, with a plain message', () => {
    const { core, fs, run } = setup({ '/Drop/Broken.doc': 'BAD', '/Drop/Good.docx': 'good' });
    const result = run();
    expect(result.failed).toEqual([
      { file: 'Broken.doc', message: '"Broken.doc" is not readable.' },
    ]);
    expect(result.imported).toEqual(['Good']);
    expect(names(core)).toEqual(['Good']);
    expect(fs.disk.has('/Drop/Broken.doc')).toBe(true);
  });

  it('adds a numbered Script when the name is already in the library', () => {
    const { core, run } = setup({ '/Drop/Sermon.docx': 'new' });
    core.dispatch({ type: 'saveScript', name: 'Sermon', text: 'old' });
    core.dispatch({ type: 'saveScript', name: 'Sermon 2', text: 'older' });
    const result = run();
    expect(result.imported).toEqual(['Sermon 3']);
    expect(names(core)).toEqual(['Sermon', 'Sermon 2', 'Sermon 3']);
  });

  it('numbers two files that produce the same Script name in one pass', () => {
    const { core, run } = setup({ '/Drop/Sermon.docx': 'a', '/Drop/Sermon.doc': 'b' });
    run();
    expect(names(core).sort()).toEqual(['Sermon', 'Sermon 2']);
  });

  it('numbers the moved file when imported/ already has that name', () => {
    const { fs, run } = setup({
      '/Drop/Sunday.docx': 'sunday',
      '/Drop/imported/Sunday.docx': 'earlier',
    });
    run();
    expect(fs.disk.get('/Drop/imported/Sunday.docx')).toBe('earlier');
    expect(fs.disk.get('/Drop/imported/Sunday 2.docx')).toBe('sunday');
  });

  it('does nothing in Run mode', () => {
    const { core, fs, run } = setup({ '/Drop/Sunday.docx': 'sunday' });
    core.dispatch({ type: 'setMode', mode: 'run' });
    expect(run()).toEqual({ imported: [], failed: [] });
    expect(names(core)).toEqual([]);
    expect(fs.disk.has('/Drop/Sunday.docx')).toBe(true);
  });

  it('does nothing when the folder is missing', () => {
    const { core } = setup({});
    const fs = fakeFs({});
    const result = importWatchedFolder('/Nowhere', {
      fs,
      core,
      importDocument: fakeImport,
    });
    expect(result).toEqual({ imported: [], failed: [] });
  });

  it('Imports a file only once across two passes', () => {
    const { core, run } = setup({ '/Drop/Sunday.docx': 'sunday' });
    run();
    run();
    expect(names(core)).toEqual(['Sunday']);
  });
});

describe('uniqueName', () => {
  it('keeps a free name and numbers a taken one from 2', () => {
    expect(uniqueName('A', new Set())).toBe('A');
    expect(uniqueName('A', new Set(['A']))).toBe('A 2');
    expect(uniqueName('A', new Set(['A', 'A 2']))).toBe('A 3');
  });
});
