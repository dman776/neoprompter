/** A styled piece of text within a line. Fonts, sizes and spacing are never stored. */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Source color as `#rrggbb`, kept as-is. Absent means "use the Output text color". */
  color?: string;
}

/** One paragraph of a rich Script: styled runs plus an optional heading level (1 to 6). */
export interface RichLine {
  heading?: number;
  runs: Run[];
}

/** A Script line: a plain string (one unstyled run) or a RichLine. */
export type ScriptLine = string | RichLine;

/** A Script, as the core sees it. Plain-text Scripts are just all-string lines. */
export interface Script {
  name: string;
  lines: ScriptLine[];
}

/** The Operator view's two modes: preparing Scripts, and a live production. */
export type Mode = 'edit' | 'run';

/** The Operator view's color theme. */
export type Theme = 'dark' | 'light';

/** Which mode the app opens in: the one last used, or always Edit mode or Run mode. */
export type OpenInMode = 'last' | Mode;

/** Commands go in. Every input and surface (Operator view, shuttle, keyboard, API) uses these. */
export type Command =
  | { type: 'play' }
  | { type: 'pause' }
  /** Speed level from 0 (stopped) to MAX_SPEED_LEVEL (fast); any value in between (continuous). */
  | { type: 'setSpeed'; level: number }
  /** Change the speed level by a small step, or a larger one when `big`. Clamped. */
  | { type: 'nudgeSpeed'; direction: 1 | -1; big: boolean }
  /** How many lines the Output shows (changes with font size, never with speed). */
  | { type: 'setViewport'; lines: number }
  /**
   * The Output's measurement of the Script: how many visual lines each Script line (a
   * paragraph that may wrap) occupies. `revision` is the `scriptRevision` the Output measured;
   * a stale measurement is ignored.
   */
  | { type: 'setLineExtents'; extents: number[]; revision: number }
  /** Spring-loaded ring deflection from -1 (full back) to 1 (full forward); 0 is released. */
  | { type: 'setRing'; deflection: number }
  /** Reposition by a number of lines (mouse and trackpad scrolling); negative goes back. */
  | { type: 'scrollBy'; lines: number }
  | { type: 'jumpBack' }
  | { type: 'jumpForward' }
  | { type: 'returnToPlayStart' }
  /** `text` is the plain-text form; `lines` (optional) carries the styled form. */
  | { type: 'saveScript'; name: string; text: string; lines?: ScriptLine[] }
  | { type: 'loadScript'; id: string }
  | { type: 'renameScript'; id: string; name: string }
  | { type: 'deleteScript'; id: string }
  /** Minimal editing. Replace the text of one line (newlines split it); styling on unchanged text is kept. */
  | { type: 'editLine'; line: number; text: string }
  /**
   * The Script editor saving: replace the loaded Script's lines. Only text, bold, italic, a
   * `#rrggbb` color and heading levels are kept; fonts and sizes never are.
   */
  | { type: 'setScriptLines'; lines: ScriptLine[] }
  /** Remove `count` lines starting at `from`. */
  | { type: 'cutLines'; from: number; count: number }
  /** Color characters [start, end) of a line with any `#rrggbb` color; null clears it. */
  | { type: 'colorRange'; line: number; start: number; end: number; color: string | null }
  /** The Operator used a color (finished choosing it): it moves to the front of the recent colors. */
  | { type: 'pickColor'; color: string }
  | { type: 'setAppearance'; changes: Partial<Appearance> }
  /** Deliberately a separate command so shuttle button mapping can exclude it. */
  | { type: 'toggleMirror' }
  | { type: 'savePreset'; name: string }
  | { type: 'loadPreset'; name: string }
  | { type: 'deletePreset'; name: string }
  /** Switch the one Output on or off. Off keeps the reading position. Never persisted. */
  | { type: 'setOutput'; on: boolean }
  /** Switch the Operator view between Edit mode and Run mode (persisted). */
  | { type: 'setMode'; mode: Mode }
  /** Choose the theme (persisted). */
  | { type: 'setTheme'; theme: Theme }
  /** Choose which mode the app opens in (persisted). */
  | { type: 'setOpenInMode'; openIn: OpenInMode }
  /**
   * Show a plain-text Notification banner in the Operator view (never the Output). Called by
   * the HTTP API from the main process. `durationMs` overrides the display time.
   */
  | { type: 'notify'; text: string; durationMs?: number }
  /** Dismiss the Notification with `id`, or the newest visible one when omitted. */
  | { type: 'dismissNotification'; id?: number }
  /** How long a Notification shows before it disappears on its own (persisted). */
  | { type: 'setNotificationDuration'; ms: number };

/** Default, minimum and maximum Notification display time (ms), and how many stack at once. */
export const DEFAULT_NOTIFICATION_MS = 8000;
export const MIN_NOTIFICATION_MS = 1000;
export const MAX_NOTIFICATION_MS = 60000;
export const MAX_NOTIFICATIONS = 5;

/** A plain-text Notification currently visible in the Operator view. */
export interface Notification {
  id: number;
  text: string;
}

export const MAX_SPEED_LEVEL = 10;
/** Speed level change for one nudge (an arrow key), and for a nudge with Shift. */
export const SPEED_NUDGE_STEP = 0.1;
export const SPEED_NUDGE_BIG_STEP = 0.5;
/** Lines per second at full ring deflection. */
export const RING_MAX_LINES_PER_SECOND = 20;
/** Lines per second for each speed level step. */
export const LINES_PER_SECOND_PER_LEVEL = 0.5;
/** Blank lines before the first line of the Script. */
export const LEAD_IN_LINES = 4;

/** A Script listed in the library. */
export interface LibraryEntry {
  id: string;
  name: string;
}

/** Appearance settings of the Output; a Preset is a named saved copy of these. */
export interface Appearance {
  /** px */
  fontSize: number;
  /** line-height multiplier */
  lineSpacing: number;
  /** Text width as percent of the Output width. */
  textWidth: number;
  /** Side margin as percent of the Output width. */
  margin: number;
  textColor: string;
  backgroundColor: string;
  /** Show the triangle Reading line. */
  readingLine: boolean;
  /** Flip the Output horizontally for beam-splitter glass. */
  mirror: boolean;
}

export const defaultAppearance: Appearance = {
  fontSize: 48,
  lineSpacing: 1.4,
  textWidth: 80,
  margin: 10,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  readingLine: true,
  mirror: false,
};

/** State comes out. Operator view and Output are thin renderers of this. */
export interface CoreState {
  script: Script;
  /** Bumps whenever the Script's content changes (edit, cut, color, load); the Output re-renders on it. */
  scriptRevision: number;
  /** Reading position in visual lines (wrapped paragraphs count each line) from the top of the Script. */
  position: number;
  /** Fraction of the Script read, 0 to 1. Drives the Progress bar. */
  progress: number;
  /** Visual lines left to read, from the reading position to the end-of-Script stop. */
  remainingLines: number;
  /** Scroll speed in visual lines per second (independent of font size). */
  speed: number;
  /** Speed as a level, 0 (stopped) to MAX_SPEED_LEVEL. */
  speedLevel: number;
  playing: boolean;
  /** Current ring deflection, -1 to 1; 0 when released. */
  ringDeflection: number;
  /** Visible Output height in lines. A Screen is this minus one. */
  viewportLines: number;
  /** Blank lines before the first line; the starting position is minus this. */
  leadIn: number;
  /** Saved Scripts, in the order they were saved. */
  library: LibraryEntry[];
  /** Id of the library Script currently loaded, or null (sample, or since deleted). */
  loadedScriptId: string | null;
  appearance: Appearance;
  /** Names of saved Presets. */
  presets: string[];
  activePreset: string | null;
  /** Whether the Output is switched on. Always Off at launch. */
  outputOn: boolean;
  /** Which mode the Operator view is in. */
  mode: Mode;
  theme: Theme;
  /** Which mode the app opens in; `mode` above is the current one. */
  openInMode: OpenInMode;
  /** Visible Notifications, newest first. Operator view only; see `outputState`. */
  notifications: Notification[];
  /** Default Notification display time in ms. */
  notificationDurationMs: number;
  /** The ten most recently used text colors (`#rrggbb`), newest first. */
  recentColors: string[];
}

/** What the Output may see: the core state without anything Operator-only (Notifications). */
export type OutputState = Omit<CoreState, 'notifications' | 'notificationDurationMs'>;

export function outputState(state: CoreState): OutputState {
  const { notifications: _n, notificationDurationMs: _d, ...rest } = state;
  return rest;
}
