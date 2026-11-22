import { lineHeading, lineRuns, lineText } from './richScript';
import type { Run, ScriptLine } from './types';

const sameStyle = (a: Run, b: Run) =>
  !!a.bold === !!b.bold && !!a.italic === !!b.italic && a.color === b.color;

const styleOf = (r: Run): Omit<Run, 'text'> => {
  const { text: _t, ...style } = r;
  return style;
};

/** Split runs so that a boundary falls at character offset `at`. */
function splitAt(runs: Run[], at: number): Run[] {
  const out: Run[] = [];
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.text.length;
    if (at > pos && at < end) {
      out.push({ ...r, text: r.text.slice(0, at - pos) }, { ...r, text: r.text.slice(at - pos) });
    } else out.push(r);
    pos = end;
  }
  return out;
}

function normalize(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && sameStyle(last, r)) out[out.length - 1] = { ...last, text: last.text + r.text };
    else out.push({ ...r });
  }
  return out;
}

function toLine(runs: Run[], heading: number | undefined, wasPlain: boolean): ScriptLine {
  const merged = normalize(runs);
  const unstyled = merged.every((r) => !r.bold && !r.italic && !r.color);
  if (heading === undefined && (wasPlain || unstyled) && unstyled) {
    return merged.map((r) => r.text).join('');
  }
  return heading === undefined ? { runs: merged } : { heading, runs: merged };
}

/**
 * Replace the text of a line, keeping styling on text that did not change.
 * Newlines in `text` split the result into several lines (heading stays on the first).
 */
export function editLineText(line: ScriptLine, text: string): ScriptLine[] {
  const old = lineText(line);
  let p = 0;
  while (p < old.length && p < text.length && old[p] === text[p]) p++;
  let s = 0;
  while (
    s < old.length - p &&
    s < text.length - p &&
    old[old.length - 1 - s] === text[text.length - 1 - s]
  )
    s++;
  const cutEnd = old.length - s;
  const inserted = text.slice(p, text.length - s);

  let runs = splitAt(splitAt(lineRuns(line), p), cutEnd);
  const out: Run[] = [];
  let pos = 0;
  let style: Omit<Run, 'text'> | undefined;
  let done = false;
  const insert = () => {
    if (done) return;
    done = true;
    if (inserted) out.push({ ...(style ?? {}), text: inserted });
  };
  for (const r of runs) {
    const end = pos + r.text.length;
    if (pos >= p && end <= cutEnd && end > pos) {
      style ??= styleOf(r); // first removed run supplies the style
      pos = end;
      continue;
    }
    if (pos >= cutEnd && !done) {
      style ??= out.length ? styleOf(out[out.length - 1]) : styleOf(r);
      insert();
    }
    out.push(r);
    if (end <= p && end > pos) style = styleOf(r);
    pos = end;
  }
  style ??= out.length ? styleOf(out[out.length - 1]) : undefined;
  insert();
  runs = out;

  const wasPlain = typeof line === 'string';
  const heading = lineHeading(line);
  // Split on newlines.
  const lines: Run[][] = [[]];
  for (const r of runs) {
    r.text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      lines[lines.length - 1].push({ ...r, text: part });
    });
  }
  return lines.map((l, i) => toLine(l, i === 0 ? heading : undefined, wasPlain));
}

/** Set (or clear, with null) the color of characters [start, end) of a line. */
export function colorLineRange(
  line: ScriptLine,
  start: number,
  end: number,
  color: string | null,
): ScriptLine {
  const len = lineText(line).length;
  const a = Math.max(0, Math.min(len, start));
  const b = Math.max(a, Math.min(len, end));
  if (a === b) return line;
  const split = splitAt(splitAt(lineRuns(line), a), b);
  let pos = 0;
  const runs = split.map((r) => {
    const rs = pos;
    pos += r.text.length;
    if (rs < a || pos > b) return r;
    const { color: _c, ...rest } = r;
    return color ? { ...rest, color } : rest;
  });
  return toLine(runs, lineHeading(line), typeof line === 'string');
}

/**
 * Where a reading position goes when `removed` lines at `at` become `added` lines,
 * so the Operator keeps reading the same text.
 */
export function remapPosition(p: number, at: number, removed: number, added: number): number {
  if (p >= at + removed) return p + added - removed;
  if (removed > added && p >= at + added) return at + added; // the line being read was cut
  return p;
}
