import type { ScriptLine } from './types';

/** A Script saved in the local library. */
export interface StoredScript {
  id: string;
  name: string;
  /** Plain-text form. Scripts stored before styled lines existed have only this. */
  text: string;
  /** Styled form, when the Script has one (e.g. imported). Wins over `text`. */
  lines?: ScriptLine[];
}

/** Where the library lives. The app injects a file-backed one; tests use memory. */
export interface LibraryStorage {
  readAll(): StoredScript[];
  writeAll(scripts: StoredScript[]): void;
}

export function createMemoryLibraryStorage(initial: StoredScript[] = []): LibraryStorage {
  let data = initial.map((s) => ({ ...s }));
  return {
    readAll: () => data.map((s) => ({ ...s })),
    writeAll: (scripts) => {
      data = scripts.map((s) => ({ ...s }));
    },
  };
}
