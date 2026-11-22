import type { Run, ScriptLine } from './types';

/** The styled runs of a line; a plain string is one unstyled run. */
export function lineRuns(line: ScriptLine): Run[] {
  return typeof line === 'string' ? [{ text: line }] : line.runs;
}

/** The text of a line with all styling removed. */
export function lineText(line: ScriptLine): string {
  return typeof line === 'string' ? line : line.runs.map((r) => r.text).join('');
}

/** Heading level (1 to 6) of a line, or undefined for body text. */
export function lineHeading(line: ScriptLine): number | undefined {
  return typeof line === 'string' ? undefined : line.heading;
}
