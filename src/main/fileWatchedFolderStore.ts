import { normalizeWatchedFolder, type WatchedFolderStore } from '../watched-folder';
import { createJsonFile } from './jsonFile';

/** The Watched folder path persisted as JSON on disk (main process only). */
export function createFileWatchedFolderStore(file: string): WatchedFolderStore {
  const json = createJsonFile<string | null>(file, {
    parse: normalizeWatchedFolder,
    fallback: () => null,
    atomic: true,
  });
  return { load: json.read, save: json.write };
}
