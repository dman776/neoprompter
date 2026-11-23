import { lineHeading, lineRuns, type Run, type ScriptLine } from '../core';

/** The editor's document in TipTap's JSON form. Only what the Script model can hold appears. */
export interface EditorNode {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: EditorNode[];
}
export interface EditorDoc {
  type: 'doc';
  content: EditorNode[];
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function runToNode(run: Run): EditorNode {
  const marks: NonNullable<EditorNode['marks']> = [];
  if (run.bold) marks.push({ type: 'bold' });
  if (run.italic) marks.push({ type: 'italic' });
  if (run.color) marks.push({ type: 'color', attrs: { color: run.color } });
  return { type: 'text', text: run.text, ...(marks.length > 0 && { marks }) };
}

/** A Script's lines as an editor document: one paragraph or heading per line. */
export function linesToDoc(lines: ScriptLine[]): EditorDoc {
  return {
    type: 'doc',
    content: lines.map((line) => {
      const runs = lineRuns(line).filter((r) => r.text !== '');
      const heading = lineHeading(line);
      const content = runs.length > 0 ? { content: runs.map(runToNode) } : {};
      return heading
        ? { type: 'heading', attrs: { level: heading }, ...content }
        : { type: 'paragraph', ...content };
    }),
  };
}

function nodeToRun(node: EditorNode): Run | null {
  if (node.type !== 'text' || !node.text) return null;
  const run: Run = { text: node.text };
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') run.bold = true;
    else if (mark.type === 'italic') run.italic = true;
    else if (mark.type === 'color') {
      const color = mark.attrs?.color;
      if (typeof color === 'string' && HEX_COLOR.test(color)) run.color = color;
    }
    // Anything else (fonts, sizes, other marks) is dropped: the Script model never holds them.
  }
  return run;
}

const sameStyle = (a: Run, b: Run) =>
  !!a.bold === !!b.bold && !!a.italic === !!b.italic && a.color === b.color;

/** An editor document as Script lines. Fonts, sizes and unknown marks are never carried over. */
export function docToLines(doc: EditorDoc | EditorNode): ScriptLine[] {
  const lines: ScriptLine[] = (doc.content ?? []).map((block) => {
    const runs: Run[] = [];
    for (const child of block.content ?? []) {
      const run = nodeToRun(child);
      if (!run) continue;
      const last = runs[runs.length - 1];
      if (last && sameStyle(last, run)) last.text += run.text;
      else runs.push(run);
    }
    const level = block.type === 'heading' ? Number(block.attrs?.level) : NaN;
    const heading = Number.isInteger(level) && level >= 1 && level <= 6 ? level : undefined;
    const plain = runs.every((r) => !r.bold && !r.italic && !r.color);
    if (heading === undefined && plain) return runs.map((r) => r.text).join('');
    return { ...(heading !== undefined && { heading }), runs };
  });
  return lines.length > 0 ? lines : [''];
}
