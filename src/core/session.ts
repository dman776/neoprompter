import type { Appearance } from './types';

/** What survives a crash or restart. Never includes "playing": a restore is always paused. */
export interface Session {
  script: { name: string; lines: string[] };
  loadedScriptId: string | null;
  position: number;
  speedLevel: number;
  appearance: Appearance;
  activePreset: string | null;
}

/** Persistence for the last session. Injected so tests never touch the disk. */
export interface SessionStore {
  load(): Session | null;
  save(session: Session): void;
}

export function createMemorySessionStore(): SessionStore {
  let data: Session | null = null;
  return {
    load: () => (data ? structuredClone(data) : null),
    save: (s) => {
      data = structuredClone(s);
    },
  };
}
