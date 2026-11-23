import { isHexColor } from './palette';
import type { Run, ScriptLine } from './types';

/** Whether two Script lines hold the same text and styling. */
export const sameLine = (a: ScriptLine, b: ScriptLine): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Clean lines that arrive from outside (the editor): only text, bold, italic, a `#rrggbb` color
 * and a heading level 1 to 6 survive, so fonts and sizes can never reach the stored Script.
 * An empty list becomes one empty line.
 */
export function sanitizeLines(lines: ScriptLine[]): ScriptLine[] {
  const clean = lines.map((line): ScriptLine => {
    if (typeof line === 'string') return line;
    const runs: Run[] = (line.runs ?? []).map((r) => ({
      text: String(r.text ?? ''),
      ...(r.bold && { bold: true }),
      ...(r.italic && { italic: true }),
      ...(isHexColor(r.color) && { color: r.color }),
    }));
    const level = line.heading;
    const heading =
      level !== undefined && Number.isInteger(level) && level >= 1 && level <= 6
        ? level
        : undefined;
    if (heading === undefined && runs.every((r) => !r.bold && !r.italic && !r.color)) {
      return runs.map((r) => r.text).join('');
    }
    return { ...(heading !== undefined && { heading }), runs };
  });
  return clean.length > 0 ? clean : [''];
}

/**
 * The smallest span that differs between two line lists: `at` lines are shared at the start, and
 * `removed` old lines became `added` new ones. Null when they are the same.
 */
export function changedSpan(
  before: ScriptLine[],
  after: ScriptLine[],
): { at: number; removed: number; added: ScriptLine[] } | null {
  let start = 0;
  while (start < before.length && start < after.length && sameLine(before[start], after[start])) {
    start++;
  }
  if (start === before.length && start === after.length) return null;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    sameLine(before[before.length - 1 - end], after[after.length - 1 - end])
  ) {
    end++;
  }
  return {
    at: start,
    removed: before.length - start - end,
    added: after.slice(start, after.length - end),
  };
}
