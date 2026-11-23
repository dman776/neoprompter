import type { ActionId } from './index';

/**
 * A Key binding's key: the physical key (`KeyboardEvent.code`, so a numpad key differs from the
 * number row and a layout change does not move it) and the modifiers held with it.
 */
export interface KeyChord {
  code: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

/** The actions that can have a Key binding, in the order the Controls page lists them. */
export const BINDABLE_ACTIONS: readonly ActionId[] = [
  'playPause',
  'playBackward',
  'jumpBack',
  'jumpForward',
  'returnToPlayStart',
  'speedUp',
  'speedDown',
  'dismissNotification',
];

export type KeyBindingTable = Record<ActionId, KeyChord[]>;

const chord = (code: string, shift = false): KeyChord => ({
  code,
  shift,
  ctrl: false,
  alt: false,
  meta: false,
});

/** Today's keys, so an install nobody has configured behaves as it always has. */
export function defaultKeyBindings(): KeyBindingTable {
  return {
    playPause: [chord('Space')],
    playBackward: [chord('Space', true)],
    jumpBack: [chord('ArrowLeft'), chord('PageUp')],
    jumpForward: [chord('ArrowRight'), chord('PageDown')],
    returnToPlayStart: [],
    speedUp: [chord('ArrowUp')],
    speedDown: [chord('ArrowDown')],
    dismissNotification: [],
  };
}

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'CapsLock',
  'Fn',
]);

/** The part of a KeyboardEvent a chord needs; a test passes a plain object. */
export interface KeyEventLike {
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/** The chord a key press makes, or null for a lone modifier (not a key yet) or an unknown key. */
export function chordFromEvent(e: KeyEventLike): KeyChord | null {
  if (!e.code || e.code === 'Unidentified' || MODIFIER_CODES.has(e.code)) return null;
  return { code: e.code, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey };
}

/** A string that is the same for the same chord, for lookups and duplicate checks. */
export function chordId(c: KeyChord): string {
  return `${c.ctrl ? 'Ctrl+' : ''}${c.alt ? 'Alt+' : ''}${c.shift ? 'Shift+' : ''}${c.meta ? 'Cmd+' : ''}${c.code}`;
}

export const sameChord = (a: KeyChord, b: KeyChord): boolean => chordId(a) === chordId(b);

const CODE_LABELS: Record<string, string> = {
  Space: 'Space',
  ArrowUp: 'Up arrow',
  ArrowDown: 'Down arrow',
  ArrowLeft: 'Left arrow',
  ArrowRight: 'Right arrow',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Home: 'Home',
  End: 'End',
  Enter: 'Enter',
  NumpadEnter: 'Numpad Enter',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Escape: 'Esc',
  Tab: 'Tab',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
  NumpadAdd: 'Numpad +',
  NumpadSubtract: 'Numpad -',
  NumpadMultiply: 'Numpad *',
  NumpadDivide: 'Numpad /',
  NumpadDecimal: 'Numpad .',
  NumpadEqual: 'Numpad =',
};

function codeLabel(code: string): string {
  const known = CODE_LABELS[code];
  if (known) return known;
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^Digit(\d)$/.exec(code);
  if (m) return m[1];
  m = /^Numpad(\d)$/.exec(code);
  if (m) return `Numpad ${m[1]}`;
  return code; // F1 to F24, media keys and the like read well as they are
}

/** What the Operator reads: "Space", "Shift + Space", "Numpad 1", "F5", "Cmd + K". */
export function chordLabel(c: KeyChord): string {
  const parts: string[] = [];
  if (c.ctrl) parts.push('Ctrl');
  if (c.alt) parts.push('Alt');
  if (c.shift) parts.push('Shift');
  if (c.meta) parts.push('Cmd');
  parts.push(codeLabel(c.code));
  return parts.join(' + ');
}

/**
 * Keys the native menu uses as accelerators (with Cmd on macOS, Ctrl elsewhere), plus the
 * standard Cmd/Ctrl keys every app keeps. Either modifier counts, so a table saved on one
 * platform means the same on another.
 */
const MENU_KEYS: ReadonlyArray<{ codes: string[]; shift?: boolean }> = [
  { codes: ['KeyN'], shift: false },
  { codes: ['KeyI'], shift: true },
  { codes: ['Comma'], shift: false },
  { codes: ['KeyZ'] },
  { codes: ['KeyF'], shift: false },
  { codes: ['Digit1'], shift: false },
  { codes: ['Digit2'], shift: false },
  { codes: ['KeyL'], shift: true },
  { codes: ['Equal', 'NumpadAdd', 'Minus', 'NumpadSubtract'] },
  { codes: ['Backslash'], shift: false },
  { codes: ['KeyO'], shift: true },
  { codes: ['KeyK'], shift: true },
  { codes: ['KeyQ', 'KeyW', 'KeyH', 'KeyM', 'KeyC', 'KeyV', 'KeyX', 'KeyA'], shift: false },
];

/** Why a key cannot be a Key binding, or null when it can. Plain words, for the Operator. */
export function refusalReason(c: KeyChord): string | null {
  if (c.code === 'Escape') return 'Esc cancels choosing a key, so it cannot be a Key binding.';
  if (c.code === 'Tab') return 'Tab moves between controls, so it cannot be a Key binding.';
  if ((c.ctrl || c.meta) && !c.alt) {
    for (const k of MENU_KEYS) {
      if (k.codes.includes(c.code) && (k.shift === undefined || k.shift === c.shift)) {
        return `${chordLabel(c)} is used by a menu item, so it cannot be a Key binding.`;
      }
    }
  }
  return null;
}

/** A key read from outside (a saved file, a message from a window), or null when malformed. */
export function parseKeyChord(raw: unknown): KeyChord | null {
  if (!isChord(raw)) return null;
  return { code: raw.code, shift: raw.shift, ctrl: raw.ctrl, alt: raw.alt, meta: raw.meta };
}

function isChord(raw: unknown): raw is KeyChord {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.code === 'string' &&
    r.code.length > 0 &&
    r.code.length <= 40 &&
    ['shift', 'ctrl', 'alt', 'meta'].every((f) => typeof r[f] === 'boolean')
  );
}

/**
 * Reads a saved table. Unknown actions, malformed or refused keys and a key given twice are
 * dropped (the first one wins); an action missing from the file keeps its default keys unless
 * another action already took them. Anything that is not an object gives null (the defaults).
 */
export function normalizeKeyBindings(raw: unknown): KeyBindingTable | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const defaults = defaultKeyBindings();
  const table: KeyBindingTable = {};
  const taken = new Set<string>();
  const take = (action: ActionId, list: unknown[]) => {
    table[action] = [];
    for (const item of list) {
      const clean = parseKeyChord(item);
      if (!clean) continue;
      const id = chordId(clean);
      if (refusalReason(clean) || taken.has(id)) continue;
      taken.add(id);
      table[action].push(clean);
    }
  };
  for (const action of BINDABLE_ACTIONS) {
    const saved = input[action];
    take(action, Array.isArray(saved) ? saved : []);
  }
  for (const action of BINDABLE_ACTIONS) {
    if (!Array.isArray(input[action]))
      take(
        action,
        defaults[action].filter((d) => !taken.has(chordId(d))),
      );
  }
  return table;
}

/** The action a key press runs, or null. */
export function actionForChord(table: KeyBindingTable, c: KeyChord): ActionId | null {
  const id = chordId(c);
  for (const action of BINDABLE_ACTIONS) {
    if (table[action]?.some((k) => chordId(k) === id)) return action;
  }
  return null;
}

/**
 * What a key press means in Run mode: the action it is bound to, or, when Shift is held with a
 * Speed up or Speed down key that has no binding of its own, that action with `big` set (a
 * bigger step). Null when the key is not bound.
 */
export function resolveKey(
  table: KeyBindingTable,
  c: KeyChord,
): { action: ActionId; big: boolean } | null {
  const action = actionForChord(table, c);
  if (action) return { action, big: false };
  if (c.shift) {
    const plain = actionForChord(table, { ...c, shift: false });
    if (plain === 'speedUp' || plain === 'speedDown') return { action: plain, big: true };
  }
  return null;
}

export type AddKeyResult =
  | { status: 'added' | 'unchanged' }
  | { status: 'refused'; reason: string }
  /** The key is already another action's; `move` takes it over. */
  | { status: 'conflict'; action: ActionId };

/** The Key binding table with its rules. Mutations return what happened; nothing throws. */
export interface KeyBindings {
  getTable(): KeyBindingTable;
  actionFor(c: KeyChord): ActionId | null;
  add(action: ActionId, c: KeyChord): AddKeyResult;
  /** Takes the key off the action that has it and gives it to `action`. */
  move(action: ActionId, c: KeyChord): AddKeyResult;
  remove(action: ActionId, c: KeyChord): boolean;
  reset(): void;
}

export function createKeyBindings(initial: unknown = null): KeyBindings {
  let table: KeyBindingTable = normalizeKeyBindings(initial) ?? defaultKeyBindings();
  const copy = (): KeyBindingTable =>
    Object.fromEntries(
      Object.entries(table).map(([action, keys]) => [action, keys.map((k) => ({ ...k }))]),
    );
  const bindable = (action: ActionId) => BINDABLE_ACTIONS.includes(action);

  const kb: KeyBindings = {
    getTable: copy,
    actionFor: (c) => actionForChord(table, c),
    add(action, c) {
      if (!bindable(action)) return { status: 'refused', reason: 'That action has no keys.' };
      const reason = refusalReason(c);
      if (reason) return { status: 'refused', reason };
      const owner = actionForChord(table, c);
      if (owner === action) return { status: 'unchanged' };
      if (owner) return { status: 'conflict', action: owner };
      table = { ...table, [action]: [...table[action], { ...c }] };
      return { status: 'added' };
    },
    move(action, c) {
      const first = kb.add(action, c);
      if (first.status !== 'conflict') return first;
      const id = chordId(c);
      table = {
        ...table,
        [first.action]: table[first.action].filter((k) => chordId(k) !== id),
      };
      return kb.add(action, c);
    },
    remove(action, c) {
      const id = chordId(c);
      if (!table[action]?.some((k) => chordId(k) === id)) return false;
      table = { ...table, [action]: table[action].filter((k) => chordId(k) !== id) };
      return true;
    },
    reset() {
      table = defaultKeyBindings();
    },
  };
  return kb;
}

/** Where the Key bindings are kept; the main process backs it with a file. */
export interface KeyBindingsStore {
  load(): unknown;
  save(table: KeyBindingTable): void;
}

/** The table and the actions in the order they are listed, as the windows see them. */
export interface KeyBindingsView {
  table: KeyBindingTable;
  actions: ActionId[];
}
