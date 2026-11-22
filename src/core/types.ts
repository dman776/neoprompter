/** A Script, as the core sees it. Later tickets extend this with structure and emphasis. */
export interface Script {
  name: string;
  lines: string[];
}

/** Commands go in. Every input and surface (Operator view, shuttle, keyboard, API) uses these. */
export type Command = { type: 'play' } | { type: 'pause' };

/** State comes out. Operator view and Output are thin renderers of this. */
export interface CoreState {
  script: Script;
  /** Reading position in lines from the top of the Script. */
  position: number;
  /** Fraction of the Script read, 0 to 1. Drives the Progress bar. */
  progress: number;
  /** Scroll speed in lines per second (independent of font size). */
  speed: number;
  playing: boolean;
}
