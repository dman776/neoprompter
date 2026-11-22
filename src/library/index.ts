import type { LibraryStorage, StoredScript } from '../core';

/** The slice of node:fs the file-backed library needs, so tests can fake it. */
export interface LibraryFs {
  readFile(path: string): string | null;
  writeFile(path: string, data: string): void;
}

/** Stores the whole library as one JSON file. A missing or corrupt file reads as empty. */
export function createFileLibraryStorage(filePath: string, fs: LibraryFs): LibraryStorage {
  return {
    readAll() {
      const raw = fs.readFile(filePath);
      if (raw === null) return [];
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as StoredScript[]) : [];
      } catch {
        return [];
      }
    },
    writeAll(scripts) {
      fs.writeFile(filePath, JSON.stringify(scripts, null, 2));
    },
  };
}
