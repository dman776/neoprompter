/** What Preferences shows: the Watched folder's path, or null while it is off. */
export interface WatchedFolderView {
  path: string | null;
}

/** Where the chosen folder is kept between runs. */
export interface WatchedFolderStore {
  load(): string | null;
  save(path: string | null): void;
}

export interface WatchedFolderSettings {
  getView(): WatchedFolderView;
  /** Asks the Operator for a folder. Cancelling keeps the current one. */
  choose(): Promise<WatchedFolderView>;
  /** Turns the Watched folder off. */
  clear(): WatchedFolderView;
}

/**
 * The Watched folder setting: off until the Operator picks a folder, saved as they pick or clear
 * it. `pickFolder` is the folder picker (null when cancelled); it is injected so this stays
 * headless.
 */
export function createWatchedFolderSettings(deps: {
  store: WatchedFolderStore;
  pickFolder: () => Promise<string | null>;
}): WatchedFolderSettings {
  let current = deps.store.load();
  const view = (): WatchedFolderView => ({ path: current });
  return {
    getView: view,
    async choose() {
      const picked = await deps.pickFolder();
      if (picked) {
        current = picked;
        deps.store.save(current);
      }
      return view();
    },
    clear() {
      current = null;
      deps.store.save(null);
      return view();
    },
  };
}

/** Turns what a store file held into a folder path, or null when it is not one. */
export function normalizeWatchedFolder(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null;
}
