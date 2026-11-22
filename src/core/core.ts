import { systemClock, type Clock } from './clock';
import { sampleScript } from './sampleScript';
import {
  LEAD_IN_LINES,
  LINES_PER_SECOND_PER_LEVEL,
  MAX_SPEED_LEVEL,
  RING_MAX_LINES_PER_SECOND,
  type Command,
  type CoreState,
  type Script,
} from './types';
import { createMemoryLibraryStorage, type LibraryStorage } from './library';
import { createMemoryPresetStore, type PresetStore } from './presets';
import { defaultAppearance, type Appearance } from './types';
import { createMemorySessionStore, type SessionStore } from './session';

export interface CoreOptions {
  clock?: Clock;
  script?: Script;
  /** Lines per second. */
  speed?: number;
  /** Where the Script library is stored. Defaults to in-memory. */
  libraryStorage?: LibraryStorage;
  presetStore?: PresetStore;
  /** Where the last session is autosaved. Defaults to in-memory. */
  sessionStore?: SessionStore;
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
  const clampLevel = (l: number) => Math.max(0, Math.min(MAX_SPEED_LEVEL, Math.round(l)));
  let speedLevel = clampLevel((options.speed ?? 3) / LINES_PER_SECOND_PER_LEVEL);
  let viewportLines = 10;

  const presetStore = options.presetStore ?? createMemoryPresetStore();
  let presets: Record<string, Appearance> = presetStore.load();
  let appearance: Appearance = { ...defaultAppearance };
  let activePreset: string | null = null;
  const minPosition = -LEAD_IN_LINES;
  /** Furthest the Script scrolls: last line at the bottom of the Output. */
  const maxPosition = () => Math.max(minPosition, script.lines.length - viewportLines);
  const clampPosition = (p: number) => Math.max(minPosition, Math.min(maxPosition(), p));

  let position = minPosition;
  let playStart = minPosition;
  let playing = false;
  let ring = 0;
  let lastTick = clock.now();
  const sessionStore = options.sessionStore ?? createMemorySessionStore();
  let outputBlank = false;
  let lastSave = clock.now();
  const SAVE_INTERVAL_MS = 1000;

  const restored = sessionStore.load();
  if (restored) {
    const entry = restored.loadedScriptId
      ? stored.find((s) => s.id === restored.loadedScriptId)
      : undefined;
    if (restored.loadedScriptId === null || entry) {
      script = restored.script;
      loadedScriptId = entry ? entry.id : null;
      position = clampPosition(restored.position);
      playStart = position;
    }
    speedLevel = clampLevel(restored.speedLevel);
    appearance = { ...defaultAppearance, ...restored.appearance };
    activePreset =
      restored.activePreset && presets[restored.activePreset] ? restored.activePreset : null;
    outputBlank = true;
  }

  function autosave(): void {
    lastSave = clock.now();
    sessionStore.save({ script, loadedScriptId, position, speedLevel, appearance, activePreset });
  }

  const listeners = new Set<(state: CoreState) => void>();

  function tick(): void {
    const now = clock.now();
    if (playing || ring !== 0) {
      const rate =
        (playing ? speedLevel * LINES_PER_SECOND_PER_LEVEL : 0) + ring * RING_MAX_LINES_PER_SECOND;
      position = clampPosition(position + ((now - lastTick) / 1000) * rate);
      if (playing && position >= maxPosition()) playing = false;
    }
    lastTick = now;
  }

  function snapshot(): CoreState {
    const range = maxPosition() - minPosition;
    const progress = range > 0 ? Math.min(1, Math.max(0, (position - minPosition) / range)) : 0;
    return {
      script,
      position,
      progress,
      speed: speedLevel * LINES_PER_SECOND_PER_LEVEL,
      speedLevel,
      playing,
      ringDeflection: ring,
      viewportLines,
      leadIn: LEAD_IN_LINES,
      library: stored.map(({ id, name }) => ({ id, name })),
      loadedScriptId,
      appearance: { ...appearance },
      presets: Object.keys(presets),
      activePreset,
      outputBlank,
    };
  }

  return {
    dispatch(command) {
      tick();
      switch (command.type) {
        case 'play':
          if (!playing) playStart = position;
          playing = position < maxPosition();
          break;
        case 'pause':
          playing = false;
          break;
        case 'setSpeed':
          speedLevel = clampLevel(command.level);
          break;
        case 'setViewport':
          viewportLines = Math.max(1, Math.round(command.lines));
          position = clampPosition(position);
          break;
        case 'setRing':
          ring = Math.max(-1, Math.min(1, command.deflection || 0));
          break;
        case 'scrollBy':
          position = clampPosition(position + command.lines);
          break;
        case 'jumpBack':
          position = clampPosition(position - (viewportLines - 1));
          break;
        case 'jumpForward':
          position = clampPosition(position + (viewportLines - 1));
          break;
        case 'returnToPlayStart':
          position = clampPosition(playStart);
          break;
        case 'saveScript':
          stored = [...stored, {
              id: String(nextId++),
              name: command.name,
              text: command.text,
              ...(command.lines && { lines: command.lines }),
            }];
          storage.writeAll(stored);
          break;
        case 'loadScript': {
          const found = stored.find((s) => s.id === command.id);
          if (!found) return;
          script = { name: found.name, lines: found.lines ?? found.text.split(/\r?\n/) };
          loadedScriptId = found.id;
          position = minPosition;
          playStart = minPosition;
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
        case 'confirmOutput':
          outputBlank = false;
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
      autosave();
      const state = snapshot();
      listeners.forEach((l) => l(state));
    },
    getState() {
      tick();
      if (playing && clock.now() - lastSave >= SAVE_INTERVAL_MS) autosave();
      return snapshot();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
