import fs from 'node:fs';
import path from 'node:path';

/** One JSON file on disk (main process only). Shared by the settings, preset, session and quick-message stores. */
export interface JsonFile<T> {
  /** The parsed file, or `fallback()` when it is missing, unreadable or not JSON. */
  read(): T;
  write(value: T): void;
}

export function createJsonFile<T>(
  file: string,
  options: {
    /** Turns the raw parsed JSON into a `T`; return null to use the fallback. */
    parse?: (raw: unknown) => T | null;
    fallback: () => T;
    /** Pretty-print with this indent. */
    indent?: number;
    /** Write to `<file>.tmp` and rename, so a crash never leaves half a file. */
    atomic?: boolean;
  },
): JsonFile<T> {
  return {
    read() {
      try {
        const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        return options.parse ? (options.parse(raw) ?? options.fallback()) : (raw as T);
      } catch {
        return options.fallback();
      }
    },
    write(value) {
      const text = JSON.stringify(value, null, options.indent);
      if (options.atomic) {
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, text);
        fs.renameSync(tmp, file);
      } else fs.writeFileSync(file, text);
    },
  };
}

/** File IO for the library store: a missing file reads as null; writing creates the folder. */
export const libraryFileIo = {
  readFile: (p: string): string | null => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null),
  writeFile: (p: string, data: string): void => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
  },
};
