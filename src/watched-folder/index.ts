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
  /** Moves a file, creating the destination's folder. */
  moveFile(from: string, to: string): void;
}

/** What one pass over the Watched folder did. */
export interface WatchedFolderResult {
  /** The Script names that were added to the library. */
  imported: string[];
  /** Files left where they were, each with a plain reason. */
  failed: Array<{ file: string; message: string }>;
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
}

/**
 * One pass over the Watched folder: each Word file in it is Imported as a Script and moved into
 * its `imported` subfolder. A file that cannot be Imported, or whose Script the core does not
 * keep, stays where it is. Nothing happens outside Edit mode, where the core would refuse the
 * save anyway.
 */
export function importWatchedFolder(folder: string, deps: WatchedFolderDeps): WatchedFolderResult {
  const { fs, core } = deps;
  const result: WatchedFolderResult = { imported: [], failed: [] };
  if (core.getState().mode !== 'edit') return result;
  const files = fs.listFiles(folder);
  if (!files) return result;

  for (const file of files.filter(isCandidate).sort()) {
    const from = fs.join(folder, file);
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
