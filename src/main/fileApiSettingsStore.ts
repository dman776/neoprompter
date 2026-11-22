import { defaultApiSettings, normalizeApiSettings, type ApiSettingsStore } from '../api';
import { createJsonFile } from './jsonFile';

/** Companion API settings (port, token) persisted as JSON on disk (main process only). */
export function createFileApiSettingsStore(file: string): ApiSettingsStore {
  const json = createJsonFile(file, {
    parse: (raw) => normalizeApiSettings(raw as Parameters<typeof normalizeApiSettings>[0]),
    fallback: () => ({ ...defaultApiSettings }),
  });
  return { load: json.read, save: json.write };
}
