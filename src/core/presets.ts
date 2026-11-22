import type { Appearance } from './types';

/** Persistence for Presets. Injected so tests never touch the disk. */
export interface PresetStore {
  load(): Record<string, Appearance>;
  save(presets: Record<string, Appearance>): void;
}

export function createMemoryPresetStore(initial: Record<string, Appearance> = {}): PresetStore {
  let data = structuredClone(initial);
  return {
    load: () => structuredClone(data),
    save: (p) => {
      data = structuredClone(p);
    },
  };
}
