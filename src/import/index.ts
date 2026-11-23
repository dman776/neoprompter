import { strFromU8, unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import type { RichLine, Run, Script } from '../core';
import { importDoc } from './doc';
import { importPdf } from './pdf';
import { importText } from './text';

export { importDoc };

/** Imports a Word, text or PDF file, choosing the reader by extension. */
export async function importDocument(bytes: Uint8Array, fileName: string): Promise<ImportResult> {
  if (/\.docx$/i.test(fileName)) return importDocx(bytes, fileName);
  if (/\.doc$/i.test(fileName)) return importDoc(bytes, fileName);
  if (/\.txt$/i.test(fileName)) return importText(bytes, fileName);
  if (/\.pdf$/i.test(fileName)) return importPdf(bytes, fileName);
  return {
    ok: false,
    message: `"${fileName}" is not a file Neoprompter can import; choose a .doc, .docx, .txt or .pdf file.`,
  };
}

export type ImportResult = { ok: true; script: Script } | { ok: false; message: string };

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
});

/**
 * Import a `.docx` as a Script. Pure: file bytes in, Script (or a clear message) out.
 * Keeps paragraphs, headings, bold, italic and source colors as-is. Fonts, sizes and
 * spacing are dropped, so the Output always looks the way the Preset says.
 */
export function importDocx(bytes: Uint8Array, fileName: string): ImportResult {
  const unreadable: ImportResult = {
    ok: false,
    message: `"${fileName}" is not a readable Word (.docx) file.`,
  };
  let documentXml: XmlNode[];
  let stylesXml: XmlNode[] = [];
  try {
    const files = unzipSync(bytes, {
      filter: (f) => f.name === 'word/document.xml' || f.name === 'word/styles.xml',
    });
    if (!files['word/document.xml']) return unreadable;
    documentXml = parser.parse(strFromU8(files['word/document.xml'])) as XmlNode[];
    if (files['word/styles.xml'])
      stylesXml = parser.parse(strFromU8(files['word/styles.xml'])) as XmlNode[];
  } catch {
    return unreadable;
  }

  const headingByStyleId = readHeadingStyles(stylesXml);
  const styleFormats = readStyleFormats(stylesXml);
  const lines: RichLine[] = [];
  collectParagraphs(documentXml, headingByStyleId, styleFormats, lines);

  if (!lines.some((l) => l.runs.length > 0)) {
    return { ok: false, message: `"${fileName}" has no text to import.` };
  }
  return { ok: true, script: { name: fileName.replace(/\.docx$/i, ''), lines } };
}

const children = (node: XmlNode, tag: string): XmlNode[] =>
  (node[tag] as XmlNode[] | undefined) ?? [];
const attrs = (node: XmlNode): Record<string, string> =>
  (node[':@'] as Record<string, string>) ?? {};
const tagOf = (node: XmlNode): string => Object.keys(node).find((k) => k !== ':@') ?? '';

function headingLevel(text: string | undefined): number | undefined {
  if (!text) return undefined;
  if (/^title$/i.test(text)) return 1;
  const m = /^heading\s*([1-9])$/i.exec(text);
  return m ? Math.min(6, Number(m[1])) : undefined;
}

/** Maps style ids to heading levels, by the style's name ("heading 2") as Word writes it. */
function readHeadingStyles(styles: XmlNode[]): Map<string, number> {
  const map = new Map<string, number>();
  const visit = (nodes: XmlNode[]) => {
    for (const node of nodes) {
      const tag = tagOf(node);
      if (tag === 'w:style') {
        const level = headingLevel(
          children(node, tag)
            .filter((c) => tagOf(c) === 'w:name')
            .map((c) => attrs(c)['w:val'])[0],
        );
        const id = attrs(node)['w:styleId'];
        if (id && level) map.set(id, level);
      } else {
        visit(children(node, tag));
      }
    }
  };
  visit(styles);
  return map;
}

function collectParagraphs(
  nodes: XmlNode[],
  headings: Map<string, number>,
  formats: StyleFormats,
  out: RichLine[],
): void {
  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === 'w:p') out.push(...readParagraph(children(node, tag), headings, formats));
    else if (tag && tag !== '#text' && tag !== 'w:sectPr')
      collectParagraphs(children(node, tag), headings, formats, out);
  }
}

/** One paragraph is one line, plus one more per line break inside it. */
function readParagraph(
  nodes: XmlNode[],
  headings: Map<string, number>,
  formats: StyleFormats,
): RichLine[] {
  let heading: number | undefined;
  let paraStyleId: string | undefined;
  const lines: Run[][] = [[]];

  const addText = (text: string, style: Omit<Run, 'text'>) => {
    const runs = lines[lines.length - 1];
    const last = runs[runs.length - 1];
    if (
      last &&
      last.bold === style.bold &&
      last.italic === style.italic &&
      last.color === style.color
    ) {
      last.text += text;
    } else {
      runs.push({ text, ...style });
    }
  };

  const readRun = (run: XmlNode[]) => {
    const rPr = run.find((c) => tagOf(c) === 'w:rPr');
    const rStyle = rPr && children(rPr, 'w:rPr').find((c) => tagOf(c) === 'w:rStyle');
    const style = finalize(
      mergeFmt(
        mergeFmt(formats.defaults, formats.resolve(paraStyleId)),
        mergeFmt(formats.resolve(rStyle && attrs(rStyle)['w:val']), readRunFmt(rPr)),
      ),
    );
    for (const part of run) {
      const tag = tagOf(part);
      if (tag === 'w:t') addText(textOf(children(part, tag)), style);
      else if (tag === 'w:tab') addText(' ', style);
      else if (tag === 'w:noBreakHyphen') addText('-', style);
      else if (tag === 'w:br') lines.push([]);
    }
  };

  const walk = (items: XmlNode[]) => {
    for (const item of items) {
      const tag = tagOf(item);
      if (tag === 'w:pPr') {
        const id = children(item, tag).find((c) => tagOf(c) === 'w:pStyle');
        const styleId = id && attrs(id)['w:val'];
        paraStyleId = styleId || undefined;
        if (styleId) heading = headings.get(styleId) ?? headingLevel(styleId);
      } else if (tag === 'w:r') readRun(children(item, tag));
      else if (tag && tag !== '#text' && tag !== 'w:del') walk(children(item, tag)); // hyperlink, ins, smartTag...
    }
  };
  walk(nodes);

  return lines.map((runs) => ({
    ...(heading ? { heading } : {}),
    runs: runs.filter((r) => r.text !== ''),
  }));
}

function textOf(nodes: XmlNode[]): string {
  return nodes.map((n) => (typeof n['#text'] === 'string' ? n['#text'] : '')).join('');
}

/** Tri-state formatting: undefined = inherit, false/null = explicitly off/none. */
type Fmt = { bold?: boolean; italic?: boolean; color?: string | null };
type StyleFormats = { defaults: Fmt; resolve: (styleId: string | undefined) => Fmt };

const mergeFmt = (base: Fmt, over: Fmt): Fmt => ({ ...base, ...over });

function finalize(f: Fmt): Omit<Run, 'text'> {
  const style: Omit<Run, 'text'> = {};
  if (f.bold) style.bold = true;
  if (f.italic) style.italic = true;
  if (f.color) style.color = f.color;
  return style;
}

/** Only bold, italic and color survive; every other run property (fonts, size...) is ignored. */
function readRunFmt(rPr: XmlNode | undefined): Fmt {
  const fmt: Fmt = {};
  if (!rPr) return fmt;
  for (const prop of children(rPr, 'w:rPr')) {
    const tag = tagOf(prop);
    const val = attrs(prop)['w:val'];
    const on = !['0', 'false', 'off'].includes((val ?? '').toLowerCase());
    if (tag === 'w:b') fmt.bold = on;
    else if (tag === 'w:i') fmt.italic = on;
    else if (tag === 'w:color' && val)
      fmt.color = /^[0-9a-f]{6}$/i.test(val) ? `#${val.toLowerCase()}` : null;
  }
  return fmt;
}

/** Reads document defaults and every style's own run formatting, resolving basedOn chains. */
function readStyleFormats(styles: XmlNode[]): StyleFormats {
  let defaults: Fmt = {};
  const own = new Map<string, { basedOn?: string; fmt: Fmt }>();
  const visit = (nodes: XmlNode[]) => {
    for (const node of nodes) {
      const tag = tagOf(node);
      if (tag === 'w:rPrDefault') {
        defaults = readRunFmt(children(node, tag).find((c) => tagOf(c) === 'w:rPr'));
      } else if (tag === 'w:style') {
        const id = attrs(node)['w:styleId'];
        const kids = children(node, tag);
        const basedOn = kids.find((c) => tagOf(c) === 'w:basedOn');
        if (id) {
          own.set(id, {
            basedOn: basedOn && attrs(basedOn)['w:val'],
            fmt: readRunFmt(kids.find((c) => tagOf(c) === 'w:rPr')),
          });
        }
      } else if (tag && tag !== '#text') visit(children(node, tag));
    }
  };
  visit(styles);

  const cache = new Map<string, Fmt>();
  const resolve = (id: string | undefined): Fmt => {
    if (!id) return {};
    const hit = cache.get(id);
    if (hit) return hit;
    const chain: Fmt[] = [];
    const seen = new Set<string>();
    for (
      let cur: string | undefined = id;
      cur && !seen.has(cur) && own.has(cur);
      cur = own.get(cur)?.basedOn
    ) {
      seen.add(cur);
      chain.unshift(own.get(cur)!.fmt);
    }
    const merged = chain.reduce(mergeFmt, {} as Fmt);
    cache.set(id, merged);
    return merged;
  };
  return { defaults, resolve };
}
