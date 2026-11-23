import { systemClock, type Clock } from './clock';
import { sampleScript } from './sampleScript';
import {
  DEFAULT_NOTIFICATION_MS,
  LEAD_IN_LINES,
  MAX_NOTIFICATIONS,
  MAX_NOTIFICATION_MS,
  MIN_NOTIFICATION_MS,
  LINES_PER_SECOND_PER_LEVEL,
  MAX_SPEED_LEVEL,
  SPEED_NUDGE_BIG_STEP,
  SPEED_NUDGE_STEP,
  RING_MAX_LINES_PER_SECOND,
  type Command,
  type CoreState,
  type Mode,
  type OpenInMode,
  type Theme,
  type Script,
} from './types';
import { createMemoryLibraryStorage, type LibraryStorage, type StoredScript } from './library';
import { createMemoryPresetStore, type PresetStore } from './presets';
import { defaultAppearance, type Appearance } from './types';
import { colorLineRange, editLineText, remapPosition } from './editing';
import { MAX_RECENT_COLORS, SEED_COLORS, isHexColor, moveColorToFront } from './palette';
import { changedSpan, sanitizeLines } from './scriptLines';
import { contrastRatio, MIN_CONTRAST, readableTextOn } from './readableColor';
import { lineText } from './richScript';
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

/** An appearance whose text is unreadable on its background gets black or white text instead. */
function readable(a: Appearance): Appearance {
  return contrastRatio(a.textColor, a.backgroundColor) >= MIN_CONTRAST
    ? a
    : { ...a, textColor: readableTextOn(a.backgroundColor) };
}

export function createCore(options: CoreOptions = {}): Core {
  const clock = options.clock ?? systemClock;
  let script = options.script ?? sampleScript;
  const storage = options.libraryStorage ?? createMemoryLibraryStorage();
  let stored = storage.readAll();
  let loadedScriptId: string | null = null;
  let nextId = stored.reduce((m, s) => Math.max(m, Number(s.id) || 0), 0) + 1;
  // Rounded to three decimals so repeated 0.1 nudges do not drift.
  const clampLevel = (l: number) =>
    Math.max(0, Math.min(MAX_SPEED_LEVEL, Math.round(l * 1000) / 1000));
  let speedLevel = clampLevel((options.speed ?? 3) / LINES_PER_SECOND_PER_LEVEL);
  let viewportLines = 10;

  const presetStore = options.presetStore ?? createMemoryPresetStore();
  let presets: Record<string, Appearance> = presetStore.load();
  let appearance: Appearance = { ...defaultAppearance };
  let activePreset: string | null = null;
  const minPosition = -LEAD_IN_LINES;
  /**
   * Position, speed and the viewport are in visual lines. A Script line is a paragraph and
   * may wrap, so `extents[i]` is how many visual lines Script line i occupies (as measured by
   * the Output; 1 until reported). Always the same length as `script.lines`.
   */
  let extents: number[] = script.lines.map(() => 1);
  let scriptRevision = 0;
  const totalVisual = () => extents.reduce((a, b) => a + b, 0);
  /** Furthest the Script scrolls: last visual line at the bottom of the Output. */
  const maxPosition = () => Math.max(minPosition, totalVisual() - viewportLines);
  /** Visual position -> fractional Script line index (identity inside the lead-in). */
  function toLineIndex(visual: number): number {
    if (visual <= 0) return visual;
    let cum = 0;
    for (let i = 0; i < extents.length; i++) {
      if (visual < cum + extents[i]) return i + (visual - cum) / extents[i];
      cum += extents[i];
    }
    return extents.length + (visual - cum);
  }
  /** Fractional Script line index -> visual position, using the current `extents`. */
  function toVisual(index: number): number {
    if (index <= 0) return index;
    const i = Math.floor(index);
    if (i >= extents.length) return totalVisual() + (index - extents.length);
    let cum = 0;
    for (let k = 0; k < i; k++) cum += extents[k];
    return cum + (index - i) * extents[i];
  }
  const clampPosition = (p: number) => Math.max(minPosition, Math.min(maxPosition(), p));

  let position = minPosition;
  let playStart = minPosition;
  let playing = false;
  let ring = 0;
  let lastTick = clock.now();
  const sessionStore = options.sessionStore ?? createMemorySessionStore();
  let outputOn = false;
  let lastSave = clock.now();
  const SAVE_INTERVAL_MS = 1000;

  let mode: Mode = 'edit';
  /** Never persisted: every launch and every mode change starts locked. */
  let unlocked = false;
  /** The Script is locked against editing in Run mode (ADR 0003); a live fix has its own rule. */
  const locked = () => mode === 'run';
  let theme: Theme = 'dark';
  let rightColumnCollapsed = false;
  let openInMode: OpenInMode = 'last';
  let notificationDurationMs = DEFAULT_NOTIFICATION_MS;
  const clampDuration = (ms: number) =>
    Math.max(MIN_NOTIFICATION_MS, Math.min(MAX_NOTIFICATION_MS, Math.round(ms)));
  /** Oldest first; each carries its own expiry. Never persisted, never logged. */
  let notifications: { id: number; text: string; expiresAt: number }[] = [];
  let nextNotificationId = 1;

  let recentColors: string[] = [...SEED_COLORS];

  const restored = sessionStore.load();
  if (restored) {
    const entry = restored.loadedScriptId
      ? stored.find((s) => s.id === restored.loadedScriptId)
      : undefined;
    if (restored.loadedScriptId === null || entry) {
      script = restored.script;
      extents = script.lines.map(() => 1);
      loadedScriptId = entry ? entry.id : null;
      position = clampPosition(restored.position);
      playStart = position;
    }
    speedLevel = clampLevel(restored.speedLevel);
    appearance = readable({ ...defaultAppearance, ...restored.appearance });
    activePreset =
      restored.activePreset && presets[restored.activePreset] ? restored.activePreset : null;
  }
  if (restored?.mode === 'edit' || restored?.mode === 'run') mode = restored.mode;
  if (restored?.theme === 'light') theme = 'light';
  if (restored?.openInMode === 'edit' || restored?.openInMode === 'run') {
    openInMode = restored.openInMode;
    mode = openInMode;
  }
  if (restored?.rightColumnCollapsed === true) rightColumnCollapsed = true;
  if (restored?.notificationDurationMs !== undefined) {
    notificationDurationMs = clampDuration(restored.notificationDurationMs);
  }

  if (restored?.recentColors) {
    recentColors = restored.recentColors
      .filter(isHexColor)
      .map((c) => c.toLowerCase())
      .slice(0, MAX_RECENT_COLORS);
  }

  function autosave(): void {
    lastSave = clock.now();
    sessionStore.save({
      script,
      loadedScriptId,
      position,
      speedLevel,
      appearance,
      activePreset,
      mode,
      theme,
      rightColumnCollapsed,
      openInMode,
      notificationDurationMs,
      recentColors,
    });
  }

  /** Replace `removed` lines at `at` with `added`, keeping the reading position on the same text. */
  function spliceLines(
    at: number,
    removed: number,
    added: Script['lines'],
    keepExtents = false,
  ): void {
    const lines = [...script.lines];
    lines.splice(at, removed, ...added);
    const remap = (p: number) => remapPosition(toLineIndex(p), at, removed, added.length);
    const nextPosition = remap(position);
    const nextPlayStart = remap(playStart);
    // New lines count as one visual line until the Output measures them.
    const nextExtents = [...extents];
    if (!keepExtents) nextExtents.splice(at, removed, ...added.map(() => 1));
    script = { ...script, lines };
    extents = nextExtents;
    scriptRevision++;
    position = clampPosition(toVisual(nextPosition));
    playStart = clampPosition(toVisual(nextPlayStart));
    const entry = loadedScriptId ? stored.find((s) => s.id === loadedScriptId) : undefined;
    if (entry) {
      const { lines: _old, ...rest } = entry;
      const updated = {
        ...rest,
        editedAt: clock.now(),
        text: lines.map(lineText).join('\n'),
        ...(lines.some((l) => typeof l !== 'string') && { lines }),
      };
      stored = stored.map((s) => (s.id === entry.id ? updated : s));
      storage.writeAll(stored);
    }
  }

  /** Make a library Script the loaded one: replaces the Script, back to the start, paused. */
  function loadStored(found: StoredScript): void {
    script = { name: found.name, lines: found.lines ?? found.text.split(/\r?\n/) };
    extents = script.lines.map(() => 1);
    scriptRevision++;
    loadedScriptId = found.id;
    position = minPosition;
    playStart = minPosition;
    playing = false;
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
    notifications = notifications.filter((n) => n.expiresAt > now);
  }

  function snapshot(): CoreState {
    const range = maxPosition() - minPosition;
    const progress = range > 0 ? Math.min(1, Math.max(0, (position - minPosition) / range)) : 0;
    return {
      script,
      scriptRevision,
      position,
      progress,
      remainingLines: Math.max(0, maxPosition() - position),
      speed: speedLevel * LINES_PER_SECOND_PER_LEVEL,
      speedLevel,
      playing,
      ringDeflection: ring,
      viewportLines,
      leadIn: LEAD_IN_LINES,
      library: stored.map(({ id, name, editedAt }) => ({ id, name, editedAt: editedAt ?? null })),
      loadedScriptId,
      appearance: { ...appearance },
      presets: Object.keys(presets),
      activePreset,
      outputOn,
      mode,
      unlocked,
      theme,
      rightColumnCollapsed,
      openInMode,
      notifications: notifications.map(({ id, text }) => ({ id, text })).reverse(),
      notificationDurationMs,
      recentColors: [...recentColors],
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
        case 'nudgeSpeed':
          speedLevel = clampLevel(
            speedLevel +
              command.direction * (command.big ? SPEED_NUDGE_BIG_STEP : SPEED_NUDGE_STEP),
          );
          break;
        case 'setViewport':
          viewportLines = Math.max(1, Math.round(command.lines));
          position = clampPosition(position);
          break;
        case 'setLineExtents': {
          if (command.revision !== scriptRevision) return;
          if (command.extents.length !== script.lines.length) return;
          const next = command.extents.map((e) => Math.max(1, Math.round(e) || 1));
          // Keep the reading position (and play start) on the same text under the new layout.
          const pos = toLineIndex(position);
          const start = toLineIndex(playStart);
          extents = next;
          position = clampPosition(toVisual(pos));
          playStart = clampPosition(toVisual(start));
          break;
        }
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
          stored = [
            ...stored,
            {
              id: String(nextId++),
              name: command.name,
              text: command.text,
              editedAt: clock.now(),
              ...(command.lines && { lines: command.lines }),
            },
          ];
          storage.writeAll(stored);
          break;
        case 'newScript': {
          const entry = {
            id: String(nextId++),
            name: 'New Script',
            text: '',
            editedAt: clock.now(),
          };
          stored = [...stored, entry];
          storage.writeAll(stored);
          loadStored(entry);
          break;
        }
        case 'duplicateScript': {
          const original = stored.find((s) => s.id === command.id);
          if (!original) return;
          stored = [
            ...stored,
            {
              ...original,
              id: String(nextId++),
              name: `${original.name} copy`,
              editedAt: clock.now(),
            },
          ];
          storage.writeAll(stored);
          break;
        }
        case 'loadScript': {
          const found = stored.find((s) => s.id === command.id);
          if (!found) return;
          loadStored(found);
          break;
        }
        case 'renameScript':
          if (!stored.some((s) => s.id === command.id)) return;
          stored = stored.map((s) =>
            s.id === command.id ? { ...s, name: command.name, editedAt: clock.now() } : s,
          );
          storage.writeAll(stored);
          if (loadedScriptId === command.id) script = { ...script, name: command.name };
          break;
        case 'deleteScript':
          if (!stored.some((s) => s.id === command.id)) return;
          stored = stored.filter((s) => s.id !== command.id);
          storage.writeAll(stored);
          if (loadedScriptId === command.id) loadedScriptId = null;
          break;
        case 'editLine': {
          if (locked()) return;
          const old = script.lines[command.line];
          if (old === undefined) return;
          spliceLines(command.line, 1, editLineText(old, command.text));
          break;
        }
        case 'setScriptLines': {
          if (locked()) return;
          const span = changedSpan(script.lines, sanitizeLines(command.lines));
          if (span) spliceLines(span.at, span.removed, span.added);
          break;
        }
        case 'cutLines': {
          if (locked()) return;
          const from = Math.max(0, Math.floor(command.from));
          const count = Math.min(Math.floor(command.count), script.lines.length - from);
          if (!(count > 0)) return;
          spliceLines(from, count, []);
          break;
        }
        case 'colorRange': {
          if (locked()) return;
          const old = script.lines[command.line];
          if (old === undefined) return;
          if (command.color !== null && !isHexColor(command.color)) return;
          spliceLines(command.line, 1, [
            colorLineRange(old, command.start, command.end, command.color?.toLowerCase() ?? null),
          ]);
          break;
        }
        case 'pickColor':
          recentColors = moveColorToFront(recentColors, command.color);
          break;
        case 'setAppearance':
          appearance = readable({ ...appearance, ...command.changes });
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
          appearance = readable({ ...presets[command.name] });
          activePreset = command.name;
          break;
        case 'setOutput':
          if (typeof command.on !== 'boolean') return;
          outputOn = command.on;
          break;
        case 'setMode':
          if (command.mode !== 'edit' && command.mode !== 'run') return;
          mode = command.mode;
          unlocked = false;
          break;
        case 'setUnlocked':
          if (typeof command.unlocked !== 'boolean') return;
          unlocked = mode === 'run' && command.unlocked;
          break;
        case 'liveFix': {
          if (!(mode === 'run' && unlocked)) return;
          const old = script.lines[command.line];
          if (old === undefined || typeof command.text !== 'string') return;
          const [fixed] = editLineText(old, command.text.replace(/\r?\n/g, ' '));
          if (fixed === undefined || lineText(fixed) === lineText(old)) return;
          // One paragraph in, one out, and its measured wrapping kept until the Output
          // measures again, so the reading position stays on the same spot.
          spliceLines(command.line, 1, [fixed], true);
          break;
        }
        case 'setTheme':
          if (command.theme !== 'dark' && command.theme !== 'light') return;
          theme = command.theme;
          break;
        case 'setRightColumnCollapsed':
          if (typeof command.collapsed !== 'boolean') return;
          rightColumnCollapsed = command.collapsed;
          break;
        case 'setOpenInMode':
          if (!['last', 'edit', 'run'].includes(command.openIn)) return;
          openInMode = command.openIn;
          break;
        case 'notify': {
          const text = command.text.trim();
          if (!text) return;
          if (
            command.durationMs !== undefined &&
            !(Number.isFinite(command.durationMs) && command.durationMs > 0)
          )
            return;
          const ms =
            command.durationMs !== undefined
              ? Math.min(command.durationMs, MAX_NOTIFICATION_MS)
              : notificationDurationMs;
          notifications = [
            ...notifications,
            { id: nextNotificationId++, text, expiresAt: clock.now() + ms },
          ].slice(-MAX_NOTIFICATIONS);
          break;
        }
        case 'dismissNotification': {
          const target = command.id ?? notifications[notifications.length - 1]?.id;
          notifications = notifications.filter((n) => n.id !== target);
          break;
        }
        case 'setNotificationDuration':
          notificationDurationMs = clampDuration(command.ms);
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
