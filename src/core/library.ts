import type { ScriptLine } from './types';

/** How a Script got into the library, and what file it came from. */
export interface ImportSource {
  /** Chosen by hand (Import…) or picked up from the Watched folder. */
  method: 'manual' | 'watched';
  /** Where the file is on disk (for the Watched folder, where it was moved to). */
  filePath: string;
  fileType: 'doc' | 'docx' | 'txt' | 'pdf';
  /** Bytes. */
  fileSize: number;
  /** The file's own last-modified time (ms), or null when unknown. */
  fileModifiedMs: number | null;
  /** When it was added to the library (clock milliseconds). */
  importedAt: number;
}

/** A Script saved in the local library. */
export interface StoredScript {
  id: string;
  name: string;
  /** Plain-text form. Scripts stored before styled lines existed have only this. */
  text: string;
  /** Styled form, when the Script has one (e.g. imported). Wins over `text`. */
  lines?: ScriptLine[];
  /** When it was last edited (clock milliseconds). Absent for Scripts stored before this. */
  editedAt?: number;
  /** Set only for Scripts that came from a file. */
  source?: ImportSource;
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
