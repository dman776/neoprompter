import type { PresetStore } from '../core';
import { createJsonFile } from './jsonFile';

/** Presets persisted as JSON on disk (main process only). */
export function createFilePresetStore(file: string): PresetStore {
  const json = createJsonFile<ReturnType<PresetStore['load']>>(file, { fallback: () => ({}), indent: 2 });
  return { load: json.read, save: json.write };
}
