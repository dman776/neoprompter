import fs from 'node:fs';
import { defaultApiSettings, normalizeApiSettings, type ApiSettingsStore } from '../api';

/** Companion API settings (port, token) persisted as JSON on disk (main process only). */
export function createFileApiSettingsStore(file: string): ApiSettingsStore {
  return {
    load() {
      try {
        return normalizeApiSettings(JSON.parse(fs.readFileSync(file, 'utf8')));
      } catch {
        return { ...defaultApiSettings };
      }
    },
    save(settings) {
      fs.writeFileSync(file, JSON.stringify(settings));
    },
  };
}
