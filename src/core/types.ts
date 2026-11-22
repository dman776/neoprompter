/** A Script, as the core sees it. Later tickets extend this with structure and emphasis. */
export interface Script {
  name: string;
  lines: string[];
}

/** Commands go in. Every input and surface (Operator view, shuttle, keyboard, API) uses these. */
export type Command =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'setAppearance'; changes: Partial<Appearance> }
  /** Deliberately a separate command so shuttle button mapping can exclude it. */
  | { type: 'toggleMirror' }
  | { type: 'savePreset'; name: string }
  | { type: 'loadPreset'; name: string }
  | { type: 'deletePreset'; name: string };

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
  playing: boolean;
  appearance: Appearance;
  /** Names of saved Presets. */
  presets: string[];
  activePreset: string | null;
}
