import type { Core } from '../core';

/**
 * Abstract device events. The Virtual shuttle, the keyboard, the mouse/trackpad and the real
 * ShuttleXPress adapter all produce these; one mapper turns them into core commands.
 */
export type DeviceEvent =
  /** Spring-loaded ring, -1 (full back) to 1 (full forward); 0 means released. */
  | { kind: 'ring'; deflection: number }
  /**
   * Jog wheel as an absolute counter (0 to JOG_WRAP - 1, wrapping). Turning up raises speed by the
   * change in the counter, so a fractional position (the Virtual shuttle's smooth drag) gives a
   * continuous speed. `rebase` only sets the baseline (a device that connects, a window that opens).
   */
  | { kind: 'jog'; position: number; rebase?: boolean }
  /** One of the five buttons (1 to 5). Actions fire on press. */
  | { kind: 'button'; button: ButtonId; pressed: boolean }
  /** Mouse/trackpad scrolling, already in lines; positive is forward. */
  | { kind: 'scroll'; lines: number };

export type ButtonId = 1 | 2 | 3 | 4 | 5;
export const BUTTON_IDS: readonly ButtonId[] = [1, 2, 3, 4, 5];
/** The real device's jog wheel reports an 8-bit counter. */
export const JOG_WRAP = 256;

/**
 * Actions a button (or key) can run. Deliberately excludes the Output mirror: it is its own
 * core command and `setButton` rejects anything not registered here.
 */
export type ActionId = string;

export type ButtonMapping = Record<ButtonId, ActionId>;

export const defaultButtonMapping: ButtonMapping = {
  1: 'playPause',
  2: 'jumpBack',
  3: 'jumpForward',
  4: 'none',
  /** Dismisses the newest Notification. */
  5: 'dismissNotification',
};

/** User-facing names for the actions, for the Virtual shuttle and the Controls page. */
export const ACTION_LABELS: Record<string, string> = {
  none: 'Unassigned',
  playPause: 'Play / Pause',
  jumpBack: 'Back a Screen',
  jumpForward: 'Forward a Screen',
  returnToPlayStart: 'Play start',
  speedUp: 'Speed up',
  speedDown: 'Speed down',
  dismissNotification: 'Dismiss Notification',
};

const KEYS: Record<string, ActionId> = {
  ' ': 'playPause',
  ArrowUp: 'speedUp',
  ArrowDown: 'speedDown',
  PageUp: 'jumpBack',
  PageDown: 'jumpForward',
};

export function keyToAction(key: string): ActionId | null {
  return KEYS[key] ?? null;
}

const PIXELS_PER_LINE = 40;

/** Convert a wheel event's delta to lines. deltaMode 0 is pixels, 1 is already lines. */
export function wheelToLines(delta: number, deltaMode = 0): number {
  return deltaMode === 1 ? delta : delta / PIXELS_PER_LINE;
}

export interface InputMapper {
  handle(event: DeviceEvent): void;
  /** Run an action directly (keyboard shortcuts use this). */
  runAction(action: ActionId): void;
  getMapping(): ButtonMapping;
  /** Remap a button. Returns false (and changes nothing) for unknown actions such as mirror. */
  setButton(button: ButtonId, action: ActionId): boolean;
  /** Action ids that can be chosen for a button. */
  availableActions(): ActionId[];
  /** Add or replace an action (for example dismiss Notification, registered by the Operator view). */
  registerAction(id: ActionId, run: () => void): void;
}

export function createInputMapper(
  core: Pick<Core, 'dispatch' | 'getState'>,
  initialMapping: Partial<ButtonMapping> = {},
): InputMapper {
  const actions = new Map<ActionId, () => void>([
    ['none', () => {}],
    ['playPause', () => core.dispatch({ type: core.getState().playing ? 'pause' : 'play' })],
    ['jumpBack', () => core.dispatch({ type: 'jumpBack' })],
    ['jumpForward', () => core.dispatch({ type: 'jumpForward' })],
    ['returnToPlayStart', () => core.dispatch({ type: 'returnToPlayStart' })],
    ['speedUp', () => core.dispatch({ type: 'setSpeed', level: core.getState().speedLevel + 1 })],
    ['speedDown', () => core.dispatch({ type: 'setSpeed', level: core.getState().speedLevel - 1 })],
    ['dismissNotification', () => core.dispatch({ type: 'dismissNotification' })],
  ]);
  let mapping: ButtonMapping = { ...defaultButtonMapping };
  let lastJog: number | null = null;

  const mapper: InputMapper = {
    handle(event) {
      switch (event.kind) {
        case 'ring':
          core.dispatch({ type: 'setRing', deflection: event.deflection });
          break;
        case 'jog': {
          if (lastJog !== null && !event.rebase) {
            let delta = (((event.position - lastJog) % JOG_WRAP) + JOG_WRAP) % JOG_WRAP;
            if (delta > JOG_WRAP / 2) delta -= JOG_WRAP;
            if (delta !== 0) {
              core.dispatch({
                type: 'setSpeed',
                level: core.getState().speedLevel + delta,
              });
            }
          }
          lastJog = event.position;
          break;
        }
        case 'button':
          if (event.pressed) mapper.runAction(mapping[event.button]);
          break;
        case 'scroll':
          core.dispatch({ type: 'scrollBy', lines: event.lines });
          break;
      }
    },
    runAction(action) {
      actions.get(action)?.();
    },
    getMapping: () => ({ ...mapping }),
    setButton(button, action) {
      if (!actions.has(action)) return false;
      mapping = { ...mapping, [button]: action };
      return true;
    },
    availableActions: () => [...actions.keys()],
    registerAction(id, run) {
      actions.set(id, run);
    },
  };
  for (const id of BUTTON_IDS) {
    const wanted = initialMapping[id];
    if (wanted) mapper.setButton(id, wanted);
  }
  return mapper;
}

/** Reads a saved mapping: known buttons with string actions are kept, anything else is dropped. */
export function normalizeButtonMapping(raw: unknown): Partial<ButtonMapping> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Partial<ButtonMapping> = {};
  for (const id of BUTTON_IDS) {
    const action = (raw as Record<string, unknown>)[id];
    if (typeof action === 'string') out[id] = action;
  }
  return out;
}

/** Where the button mapping is kept; the main process backs it with a file. */
export interface ButtonMappingStore {
  load(): Partial<ButtonMapping> | null;
  save(mapping: ButtonMapping): void;
}

/** The mapping and the action choices, as the windows (Virtual shuttle, Controls) see them. */
export interface ButtonMappingView {
  mapping: ButtonMapping;
  actions: ActionId[];
}

/**
 * The one input entry point of the main process: the Virtual shuttle, the real ShuttleXPress
 * adapter (a later ticket) and any other device call `handle`; the mapping is shared and saved.
 */
export interface InputService {
  handle(event: DeviceEvent): void;
  getView(): ButtonMappingView;
  getMapping(): ButtonMapping;
  /** Remap and save a button. False (nothing changed) for an unknown action such as mirror. */
  setButton(button: ButtonId, action: ActionId): boolean;
  /** Called with the new view after every mapping change. */
  subscribe(listener: (view: ButtonMappingView) => void): void;
}

export function createInputService(
  core: Pick<Core, 'dispatch' | 'getState'>,
  store: ButtonMappingStore,
): InputService {
  const mapper = createInputMapper(core, store.load() ?? {});
  const listeners: Array<(view: ButtonMappingView) => void> = [];
  const getView = (): ButtonMappingView => ({
    mapping: mapper.getMapping(),
    actions: mapper.availableActions(),
  });
  return {
    handle: (event) => mapper.handle(event),
    getView,
    getMapping: () => mapper.getMapping(),
    setButton(button, action) {
      if (!mapper.setButton(button, action)) return false;
      store.save(mapper.getMapping());
      const view = getView();
      listeners.forEach((l) => l(view));
      return true;
    },
    subscribe: (listener) => void listeners.push(listener),
  };
}
