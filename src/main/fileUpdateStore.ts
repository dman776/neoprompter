import { DEFAULT_UPDATE_SETTINGS, normalizeUpdateSettings, type UpdateStore } from '../updates';
import { createJsonFile } from './jsonFile';

/** The Update check's settings persisted as JSON on disk (main process only). */
export function createFileUpdateStore(file: string): UpdateStore {
  const json = createJsonFile(file, {
    parse: normalizeUpdateSettings,
    fallback: () => ({ ...DEFAULT_UPDATE_SETTINGS }),
    atomic: true,
  });
  return { load: json.read, save: json.write };
}
