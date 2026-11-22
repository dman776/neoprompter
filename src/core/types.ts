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

/** Commands go in. Every input and surface (Operator view, shuttle, keyboard, API) uses these. */
export type Command =
  | { type: 'play' }
  | { type: 'pause' }
  /** Speed level from 0 (stopped) to MAX_SPEED_LEVEL (fast). */
  | { type: 'setSpeed'; level: number }
  /** How many lines the Output shows (changes with font size, never with speed). */
  | { type: 'setViewport'; lines: number }
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
  /** Remove `count` lines starting at `from`. */
  | { type: 'cutLines'; from: number; count: number }
  /** Color characters [start, end) of a line with a palette color; null clears it. */
  | { type: 'colorRange'; line: number; start: number; end: number; color: string | null }
  | { type: 'setAppearance'; changes: Partial<Appearance> }
  /** Deliberately a separate command so shuttle button mapping can exclude it. */
  | { type: 'toggleMirror' }
  | { type: 'savePreset'; name: string }
  | { type: 'loadPreset'; name: string }
  | { type: 'deletePreset'; name: string }
  /** Operator confirms after a restore; until then the Output stays blank. */
  | { type: 'confirmOutput' };

export const MAX_SPEED_LEVEL = 10;
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
  /** Reading position in lines from the top of the Script. */
  position: number;
  /** Fraction of the Script read, 0 to 1. Drives the Progress bar. */
  progress: number;
  /** Scroll speed in lines per second (independent of font size). */
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
  /** True after a restore until the Operator confirms; the Output renders nothing. */
  outputBlank: boolean;
}
