/** A Script saved in the local library. */
export interface StoredScript {
  id: string;
  name: string;
  text: string;
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
