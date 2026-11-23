import { lineText, type Core } from '../core';
import type { ImportResult } from '../import';

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

/** The slice of the file system the Watched folder needs, so tests can fake it. */
export interface WatchedFolderFs {
  /** Joins path parts the way the platform does. */
  join(...parts: string[]): string;
  /** The names of the files (not folders) directly inside `dir`; null when `dir` is not there. */
  listFiles(dir: string): string[] | null;
  readFile(path: string): Uint8Array;
  exists(path: string): boolean;
  /** Size and modified time of a file, or null when it is not there. */
  stat(path: string): { size: number; modifiedMs: number } | null;
  /** Moves a file, creating the destination's folder. */
  moveFile(from: string, to: string): void;
}

/** What one pass over the Watched folder did. */
export interface WatchedFolderResult {
  /** The Script names that were added to the library. */
  imported: string[];
  /** Files left where they were, each with a plain reason. */
  failed: Array<{ file: string; message: string }>;
  /** Files not touched yet because they may still be being copied in. */
  waiting: string[];
}

/** The name of the subfolder that Imported files move into. */
export const IMPORTED_FOLDER = 'imported';

const WORD_FILE = /\.docx?$/i;

/** Word's own lock files (`~$name.docx`) and hidden files are never Scripts. */
function isCandidate(name: string): boolean {
  return WORD_FILE.test(name) && !name.startsWith('~$') && !name.startsWith('.');
}

/** `name`, or the first free "<name> 2", "<name> 3"... when the library already has it. */
export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** `file`, or the same name with a number before the extension when `exists` says it is taken. */
function freeFileName(file: string, exists: (name: string) => boolean): string {
  if (!exists(file)) return file;
  const dot = file.lastIndexOf('.');
  const stem = dot > 0 ? file.slice(0, dot) : file;
  const ext = dot > 0 ? file.slice(dot) : '';
  for (let n = 2; ; n++) {
    const candidate = `${stem} ${n}${ext}`;
    if (!exists(candidate)) return candidate;
  }
}

export interface WatchedFolderDeps {
  fs: WatchedFolderFs;
  core: Pick<Core, 'dispatch' | 'getState'>;
  importDocument: (bytes: Uint8Array, fileName: string) => ImportResult;
  /** Says whether a file is finished arriving; a file that is not is skipped and reported as waiting. Omitted, every file is ready. */
  isReady?: (file: string) => boolean;
}

/**
 * One pass over the Watched folder: each Word file in it is Imported as a Script and moved into
 * its `imported` subfolder. A file that cannot be Imported, or whose Script the core does not
 * keep, stays where it is. Nothing happens outside Edit mode, where the core would refuse the
 * save anyway.
 */
export function importWatchedFolder(folder: string, deps: WatchedFolderDeps): WatchedFolderResult {
  const { fs, core } = deps;
  const result: WatchedFolderResult = { imported: [], failed: [], waiting: [] };
  if (core.getState().mode !== 'edit') return result;
  const files = fs.listFiles(folder);
  if (!files) return result;

  for (const file of files.filter(isCandidate).sort()) {
    const from = fs.join(folder, file);
    if (deps.isReady && !deps.isReady(file)) {
      result.waiting.push(file);
      continue;
    }
    let imported: ImportResult;
    try {
      imported = deps.importDocument(fs.readFile(from), file);
    } catch {
      result.failed.push({ file, message: `"${file}" could not be read.` });
      continue;
    }
    if (!imported.ok) {
      result.failed.push({ file, message: imported.message });
      continue;
    }

    const { script } = imported;
    const before = core.getState().library;
    const name = uniqueName(script.name, new Set(before.map((s) => s.name)));
    core.dispatch({
      type: 'saveScript',
      name,
      text: script.lines.map(lineText).join('\n'),
      lines: script.lines,
    });
    if (core.getState().library.length === before.length) {
      result.failed.push({ file, message: `"${file}" could not be added to the library.` });
      continue;
    }

    const kept = freeFileName(file, (n) => fs.exists(fs.join(folder, IMPORTED_FOLDER, n)));
    try {
      fs.moveFile(from, fs.join(folder, IMPORTED_FOLDER, kept));
    } catch {
      // The Script is in the library; the file stays, so it would be Imported again. Say so.
      result.failed.push({
        file,
        message: `"${file}" was imported but could not be moved into "${IMPORTED_FOLDER}".`,
      });
      result.imported.push(name);
      continue;
    }
    result.imported.push(name);
  }
  return result;
}

/** Tells the watcher when something in a folder changed. Returns a function that stops watching. */
export interface FolderChangeSource {
  watch(dir: string, onChange: () => void): () => void;
}

/** Runs `fn` after `ms`. Returns a function that cancels it. */
export interface Scheduler {
  after(ms: number, fn: () => void): () => void;
}

/** How long a file's size and modified time must stay the same before it counts as arrived. */
export const SETTLE_MS = 1000;

export interface FolderWatcherDeps extends Omit<WatchedFolderDeps, 'isReady'> {
  changes: FolderChangeSource;
  scheduler: Scheduler;
  /** Called after each pass that did something. */
  onResult?: (result: WatchedFolderResult) => void;
}

export interface FolderWatcher {
  /** Watches this folder (stopping any earlier one) and Imports what is already in it; null stops. */
  setFolder(folder: string | null): void;
}

/**
 * Keeps the Watched folder Imported while the app runs. A change starts a check after
 * SETTLE_MS; a file whose size or modified time moved since the last look is left for the next
 * check, so a file still being copied in is never Imported half-written.
 */
export function createFolderWatcher(deps: FolderWatcherDeps): FolderWatcher {
  let stopWatching: (() => void) | null = null;
  let cancelCheck: (() => void) | null = null;
  let looked = new Map<string, string>();

  const pass = (folder: string, settled: boolean) => {
    const result = importWatchedFolder(folder, {
      ...deps,
      isReady: settled
        ? (file) => {
            const path = deps.fs.join(folder, file);
            const now = deps.fs.stat(path);
            const key = now ? `${now.size}:${now.modifiedMs}` : '';
            const same = looked.get(path) === key && key !== '';
            looked.set(path, key);
            return same;
          }
        : undefined,
    });
    if (result.imported.length || result.failed.length) deps.onResult?.(result);
    return result;
  };

  const schedule = (folder: string) => {
    if (cancelCheck) return;
    cancelCheck = deps.scheduler.after(SETTLE_MS, () => {
      cancelCheck = null;
      const result = pass(folder, true);
      if (result.waiting.length > 0) schedule(folder);
    });
  };

  return {
    setFolder(folder) {
      stopWatching?.();
      stopWatching = null;
      cancelCheck?.();
      cancelCheck = null;
      looked = new Map();
      if (!folder) return;
      stopWatching = deps.changes.watch(folder, () => schedule(folder));
      pass(folder, false);
    },
  };
}
