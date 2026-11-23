import { describe, expect, it } from 'vitest';
import {
  createWatchedFolderSettings,
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
    expect(settings.getView()).toEqual({ path: null });
  });

  it('saves the chosen folder', async () => {
    const store = memoryStore();
    const settings = createWatchedFolderSettings({
      store,
      pickFolder: async () => '/Scripts/Drop',
    });
    expect(await settings.choose()).toEqual({ path: '/Scripts/Drop' });
    expect(store.saved).toEqual(['/Scripts/Drop']);
  });

  it('keeps the current folder when the picker is cancelled', async () => {
    const store = memoryStore('/Scripts/Drop');
    const settings = createWatchedFolderSettings({ store, pickFolder: async () => null });
    expect(await settings.choose()).toEqual({ path: '/Scripts/Drop' });
    expect(store.saved).toEqual([]);
  });

  it('is restored from the store, as after a restart', () => {
    const settings = createWatchedFolderSettings({
      store: memoryStore('/Scripts/Drop'),
      pickFolder: async () => null,
    });
    expect(settings.getView()).toEqual({ path: '/Scripts/Drop' });
  });

  it('turns off when cleared, and stays off after a restart', () => {
    const store = memoryStore('/Scripts/Drop');
    const settings = createWatchedFolderSettings({ store, pickFolder: async () => null });
    expect(settings.clear()).toEqual({ path: null });
    expect(createWatchedFolderSettings({ store, pickFolder: async () => null }).getView()).toEqual({
      path: null,
    });
  });

  it('reads only a non-empty string from a saved file', () => {
    expect(normalizeWatchedFolder('/a')).toBe('/a');
    expect(normalizeWatchedFolder('  ')).toBeNull();
    expect(normalizeWatchedFolder(42)).toBeNull();
    expect(normalizeWatchedFolder(null)).toBeNull();
  });
});
