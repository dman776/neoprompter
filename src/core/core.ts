import { systemClock, type Clock } from './clock';
import { sampleScript } from './sampleScript';
import type { Command, CoreState, Script } from './types';

export interface CoreOptions {
  clock?: Clock;
  script?: Script;
  /** Lines per second. */
  speed?: number;
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
  const script = options.script ?? sampleScript;
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
    return { script, position, speed, playing };
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
