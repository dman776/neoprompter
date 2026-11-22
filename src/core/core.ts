import { systemClock, type Clock } from './clock';
import { sampleScript } from './sampleScript';
import { createMemoryLibraryStorage, type LibraryStorage } from './library';
import type { Command, CoreState, Script } from './types';

export interface CoreOptions {
  clock?: Clock;
  script?: Script;
  /** Lines per second. */
  speed?: number;
  /** Where the Script library is stored. Defaults to in-memory. */
  libraryStorage?: LibraryStorage;
}

export interface Core {
  dispatch(command: Command): void;
  /** Current state, with position brought up to date from the clock. */
  getState(): CoreState;
  /** Called after every command that changes state. Returns an unsubscribe function. */
  subscribe(listener: (state: CoreState) => void): () => void;
}

export function createCore(options: CoreOptions = {}): Core {
  const clock = options.clock ?? systemClock;
  let script = options.script ?? sampleScript;
  const storage = options.libraryStorage ?? createMemoryLibraryStorage();
  let stored = storage.readAll();
  let loadedScriptId: string | null = null;
  let nextId = stored.reduce((m, s) => Math.max(m, Number(s.id) || 0), 0) + 1;
  const speed = options.speed ?? 3;

  let position = 0;
  let playing = false;
  let lastTick = clock.now();
  const listeners = new Set<(state: CoreState) => void>();

  function tick(): void {
    const now = clock.now();
    if (playing) position += ((now - lastTick) / 1000) * speed;
    lastTick = now;
  }

  function snapshot(): CoreState {
    return {
      script,
      position,
      speed,
      playing,
      library: stored.map(({ id, name }) => ({ id, name })),
      loadedScriptId,
    };
  }

  return {
    dispatch(command) {
      tick();
      switch (command.type) {
        case 'play':
          playing = true;
          break;
        case 'pause':
          playing = false;
          break;
        case 'saveScript':
          stored = [...stored, { id: String(nextId++), name: command.name, text: command.text }];
          storage.writeAll(stored);
          break;
        case 'loadScript': {
          const found = stored.find((s) => s.id === command.id);
          if (!found) return;
          script = { name: found.name, lines: found.text.split(/\r?\n/) };
          loadedScriptId = found.id;
          position = 0;
          playing = false;
          break;
        }
        case 'renameScript':
          if (!stored.some((s) => s.id === command.id)) return;
          stored = stored.map((s) => (s.id === command.id ? { ...s, name: command.name } : s));
          storage.writeAll(stored);
          if (loadedScriptId === command.id) script = { ...script, name: command.name };
          break;
        case 'deleteScript':
          if (!stored.some((s) => s.id === command.id)) return;
          stored = stored.filter((s) => s.id !== command.id);
          storage.writeAll(stored);
          if (loadedScriptId === command.id) loadedScriptId = null;
          break;
      }
      const state = snapshot();
      listeners.forEach((l) => l(state));
    },
    getState() {
      tick();
      return snapshot();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
