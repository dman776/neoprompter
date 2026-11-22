import { systemClock, type Clock } from './clock';
import { sampleScript } from './sampleScript';
import { createMemoryPresetStore, type PresetStore } from './presets';
import { defaultAppearance, type Appearance, type Command, type CoreState, type Script } from './types';

export interface CoreOptions {
  clock?: Clock;
  script?: Script;
  /** Lines per second. */
  speed?: number;
  presetStore?: PresetStore;
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

  const presetStore = options.presetStore ?? createMemoryPresetStore();
  let presets: Record<string, Appearance> = presetStore.load();
  let appearance: Appearance = { ...defaultAppearance };
  let activePreset: string | null = null;
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
    const total = script.lines.length;
    const progress = total > 0 ? Math.min(1, Math.max(0, position / total)) : 0;
    return {
      script,
      position,
      progress,
      speed,
      playing,
      appearance: { ...appearance },
      presets: Object.keys(presets),
      activePreset,
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
        case 'setAppearance':
          appearance = { ...appearance, ...command.changes };
          break;
        case 'toggleMirror':
          appearance = { ...appearance, mirror: !appearance.mirror };
          break;
        case 'savePreset': {
          const name = command.name.trim();
          if (!name) return;
          presets = { ...presets, [name]: { ...appearance } };
          activePreset = name;
          presetStore.save(presets);
          break;
        }
        case 'loadPreset':
          if (!presets[command.name]) return;
          appearance = { ...presets[command.name] };
          activePreset = command.name;
          break;
        case 'deletePreset': {
          if (!presets[command.name]) return;
          const { [command.name]: _gone, ...rest } = presets;
          presets = rest;
          if (activePreset === command.name) activePreset = null;
          presetStore.save(presets);
          break;
        }
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
