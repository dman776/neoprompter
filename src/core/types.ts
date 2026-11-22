/** A Script, as the core sees it. Later tickets extend this with structure and emphasis. */
export interface Script {
  name: string;
  lines: string[];
}

/** Commands go in. Every input and surface (Operator view, shuttle, keyboard, API) uses these. */
export type Command =
  | { type: 'play' }
  | { type: 'pause' }
  /** Speed level from 0 (stopped) to MAX_SPEED_LEVEL (fast). */
  | { type: 'setSpeed'; level: number }
  /** How many lines the Output shows (changes with font size, never with speed). */
  | { type: 'setViewport'; lines: number }
  | { type: 'jumpBack' }
  | { type: 'jumpForward' }
  | { type: 'returnToPlayStart' };

export const MAX_SPEED_LEVEL = 10;
/** Lines per second for each speed level step. */
export const LINES_PER_SECOND_PER_LEVEL = 0.5;
/** Blank lines before the first line of the Script. */
export const LEAD_IN_LINES = 4;

/** State comes out. Operator view and Output are thin renderers of this. */
export interface CoreState {
  script: Script;
  /** Reading position in lines from the top of the Script. */
  position: number;
  /** Scroll speed in lines per second (independent of font size). */
  speed: number;
  /** Speed as a level, 0 (stopped) to MAX_SPEED_LEVEL. */
  speedLevel: number;
  playing: boolean;
  /** Visible Output height in lines. A Screen is this minus one. */
  viewportLines: number;
  /** Blank lines before the first line; the starting position is minus this. */
  leadIn: number;
}
