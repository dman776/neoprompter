import { lineText, type ScriptLine } from '../core';

/** Spoken words per minute used for the read-time estimate. */
export const WORDS_PER_MINUTE = 150;

export interface ScriptStats {
  words: number;
  readSeconds: number;
}

/** Words in a Script and how long it takes to read aloud. */
export function scriptStats(lines: ScriptLine[]): ScriptStats {
  const words = lines
    .map((l) => lineText(l).split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);
  return { words, readSeconds: Math.round((words / WORDS_PER_MINUTE) * 60) };
}

/** Seconds as `m:ss`. */
export function formatReadTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
