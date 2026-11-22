/** A Script, as the core sees it. Later tickets extend this with structure and emphasis. */
export interface Script {
  name: string;
  lines: string[];
}

/** Commands go in. Every input and surface (Operator view, shuttle, keyboard, API) uses these. */
export type Command =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'saveScript'; name: string; text: string }
  | { type: 'loadScript'; id: string }
  | { type: 'renameScript'; id: string; name: string }
  | { type: 'deleteScript'; id: string };

/** A Script listed in the library. */
export interface LibraryEntry {
  id: string;
  name: string;
}

/** State comes out. Operator view and Output are thin renderers of this. */
export interface CoreState {
  script: Script;
  /** Reading position in lines from the top of the Script. */
  position: number;
  /** Scroll speed in lines per second (independent of font size). */
  speed: number;
  playing: boolean;
  /** Saved Scripts, in the order they were saved. */
  library: LibraryEntry[];
  /** Id of the library Script currently loaded, or null (sample, or since deleted). */
  loadedScriptId: string | null;
}
