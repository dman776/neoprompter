import fs from 'node:fs';
import type { PresetStore } from '../core';

/** Presets persisted as JSON on disk (main process only). */
export function createFilePresetStore(file: string): PresetStore {
  return {
    load() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        return {};
      }
    },
    save(presets) {
      fs.writeFileSync(file, JSON.stringify(presets, null, 2));
    },
  };
}
