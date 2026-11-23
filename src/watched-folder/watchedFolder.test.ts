import { describe, expect, it } from 'vitest';
import {
  createWatchedFolderSettings,
  describeResult,
  normalizeWatchedFolder,
  type WatchedFolderStore,
} from './index';

function memoryStore(
  initial: string | null = null,
): WatchedFolderStore & { saved: Array<string | null> } {
  let value = initial;
  const saved: Array<string | null> = [];
  return {
    saved,
    load: () => value,
    save: (p) => {
      value = p;
      saved.push(p);
    },
  };
}

describe('Watched folder setting', () => {
  it('is off until a folder is chosen', () => {
    const settings = createWatchedFolderSettings({
      store: memoryStore(),
      pickFolder: async () => null,
    });
    expect(settings.getView()).toEqual({ path: null, missing: false, lastResult: null });
  });

  it('saves the chosen folder', async () => {
    const store = memoryStore();
    const settings = createWatchedFolderSettings({
      store,
      pickFolder: async () => '/Scripts/Drop',
    });
    expect(await settings.choose()).toEqual({
      path: '/Scripts/Drop',
      missing: false,
      lastResult: null,
    });
    expect(store.saved).toEqual(['/Scripts/Drop']);
  });

  it('keeps the current folder when the picker is cancelled', async () => {
    const store = memoryStore('/Scripts/Drop');
    const settings = createWatchedFolderSettings({ store, pickFolder: async () => null });
    expect(await settings.choose()).toEqual({
      path: '/Scripts/Drop',
      missing: false,
      lastResult: null,
    });
    expect(store.saved).toEqual([]);
  });

  it('is restored from the store, as after a restart', () => {
    const settings = createWatchedFolderSettings({
      store: memoryStore('/Scripts/Drop'),
      pickFolder: async () => null,
    });
    expect(settings.getView()).toEqual({ path: '/Scripts/Drop', missing: false, lastResult: null });
  });

  it('turns off when cleared, and stays off after a restart', () => {
    const store = memoryStore('/Scripts/Drop');
    const settings = createWatchedFolderSettings({ store, pickFolder: async () => null });
    expect(settings.clear()).toEqual({ path: null, missing: false, lastResult: null });
    expect(createWatchedFolderSettings({ store, pickFolder: async () => null }).getView()).toEqual({
      path: null,
      missing: false,
      lastResult: null,
    });
  });

  it('reads only a non-empty string from a saved file', () => {
    expect(normalizeWatchedFolder('/a')).toBe('/a');
    expect(normalizeWatchedFolder('  ')).toBeNull();
    expect(normalizeWatchedFolder(42)).toBeNull();
    expect(normalizeWatchedFolder(null)).toBeNull();
  });
});

describe('Watched folder status', () => {
  const make = (exists = true) =>
    createWatchedFolderSettings({
      store: memoryStore('/Scripts/Drop'),
      pickFolder: async () => '/Other',
      folderExists: () => exists,
    });

  it('remembers the last result for Preferences', () => {
    const settings = make();
    settings.report('Imported "Sunday" from the Watched folder.');
    expect(settings.getView().lastResult).toBe('Imported "Sunday" from the Watched folder.');
  });

  it('forgets the last result when another folder is chosen or the folder is cleared', async () => {
    const settings = make();
    settings.report('something');
    await settings.choose();
    expect(settings.getView().lastResult).toBeNull();
    settings.report('again');
    expect(settings.clear().lastResult).toBeNull();
  });

  it('says when the chosen folder is gone', () => {
    expect(make(false).getView().missing).toBe(true);
    expect(make(true).getView().missing).toBe(false);
  });

  it('is not missing while it is off', () => {
    const settings = createWatchedFolderSettings({
      store: memoryStore(),
      pickFolder: async () => null,
      folderExists: () => false,
    });
    expect(settings.getView().missing).toBe(false);
  });
});

describe('describeResult', () => {
  it('names one Imported Script', () => {
    expect(describeResult({ imported: ['Sunday'], failed: [], waiting: [] })).toEqual({
      ok: true,
      message: 'Imported "Sunday" from the Watched folder.',
    });
  });

  it('counts and names several', () => {
    expect(describeResult({ imported: ['A', 'B'], failed: [], waiting: [] }).message).toBe(
      'Imported 2 Scripts from the Watched folder: "A", "B".',
    );
  });

  it('says which file failed and why, and is not ok', () => {
    const r = describeResult({
      imported: ['Good'],
      failed: [{ file: 'Bad.doc', message: '"Bad.doc" is password-protected.' }],
      waiting: [],
    });
    expect(r.ok).toBe(false);
    expect(r.message).toBe(
      'Imported "Good" from the Watched folder. "Bad.doc" is password-protected.',
    );
  });
});
