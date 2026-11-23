import { docToLines, type EditorDoc, type EditorNode } from './convert';
import type { ScriptLine } from '../core';

const BLOCKS = new Set([
  'P',
  'DIV',
  'LI',
  'UL',
  'OL',
  'TR',
  'TABLE',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
]);
/** Blocks that always make a line, even an empty one (an empty Word paragraph is a blank line). */
const LINE_BLOCKS = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const SKIPPED = new Set(['STYLE', 'SCRIPT', 'HEAD', 'TITLE', 'META', 'LINK']);

interface Style {
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

const hex2 = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');

/** `#rrggbb`, `#rgb` or `rgb(r, g, b)` as `#rrggbb`; anything else (names, windowtext) is not kept. */
export function parseColor(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(v);
  if (rgb) return `#${hex2(+rgb[1])}${hex2(+rgb[2])}${hex2(+rgb[3])}`;
  return undefined;
}

function styleOf(el: Element, inherited: Style): Style {
  const style = { ...inherited };
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') style.bold = true;
  if (tag === 'I' || tag === 'EM') style.italic = true;
  const css = (el as HTMLElement).style;
  const weight = css?.fontWeight;
  if (weight) style.bold = weight === 'bold' || weight === 'bolder' || Number(weight) >= 600;
  if (css?.fontStyle) style.italic = css.fontStyle === 'italic' || css.fontStyle === 'oblique';
  const color = css?.color ? parseColor(css.color) : undefined;
  if (color) style.color = color;
  const fontColor = tag === 'FONT' ? parseColor(el.getAttribute('color') ?? '') : undefined;
  if (fontColor) style.color = fontColor;
  return style;
}

/**
 * Pasted HTML (Word, web pages) as an editor document. Only paragraphs, headings, bold, italic and
 * `#rrggbb` color survive; fonts, sizes, spacing and classes are never read.
 */
export function pastedHtmlToDoc(html: string): EditorDoc {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const blocks: EditorNode[] = [];
  let inline: EditorNode[] = [];
  let heading: number | undefined;

  const flush = (force: boolean) => {
    // Source whitespace is not content: trim the ends of the line.
    const text = inline.map((n) => ({ ...n }));
    if (text.length > 0) {
      text[0].text = text[0].text!.replace(/^ +/, '');
      text[text.length - 1].text = text[text.length - 1].text!.replace(/ +$/, '');
    }
    const content = text.filter((n) => n.text !== '');
    if (content.length > 0 || force) {
      blocks.push({
        type: heading ? 'heading' : 'paragraph',
        ...(heading && { attrs: { level: heading } }),
        ...(content.length > 0 && { content }),
      });
    }
    inline = [];
  };

  const walk = (node: Node, style: Style) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/[\s ]+/g, ' ');
      if (text === '' || (text === ' ' && inline.length === 0)) return;
      const marks: NonNullable<EditorNode['marks']> = [];
      if (style.bold) marks.push({ type: 'bold' });
      if (style.italic) marks.push({ type: 'italic' });
      if (style.color) marks.push({ type: 'color', attrs: { color: style.color } });
      inline.push({ type: 'text', text, ...(marks.length > 0 && { marks }) });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName;
    if (SKIPPED.has(tag)) return;
    if (tag === 'BR') return flush(true);
    const next = styleOf(el, style);
    const isBlock = BLOCKS.has(tag);
    if (isBlock) flush(false);
    const outer = heading;
    if (/^H[1-6]$/.test(tag)) heading = Number(tag[1]);
    el.childNodes.forEach((child) => walk(child, next));
    if (isBlock) flush(LINE_BLOCKS.has(tag));
    heading = outer;
  };

  body.childNodes.forEach((child) => walk(child, {}));
  flush(false);
  return { type: 'doc', content: blocks.length > 0 ? blocks : [{ type: 'paragraph' }] };
}

/** Pasted HTML as Script lines (the conversion the paste test checks). */
export function pastedHtmlToLines(html: string): ScriptLine[] {
  return docToLines(pastedHtmlToDoc(html));
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Clean HTML for the editor to parse: structure, emphasis and color only. */
export function cleanPastedHtml(html: string): string {
  return pastedHtmlToDoc(html)
    .content.map((block) => {
      const tag = block.type === 'heading' ? `h${block.attrs?.level}` : 'p';
      const inner = (block.content ?? [])
        .map((n) => {
          let out = escapeHtml(n.text ?? '');
          for (const m of n.marks ?? []) {
            if (m.type === 'bold') out = `<strong>${out}</strong>`;
            else if (m.type === 'italic') out = `<em>${out}</em>`;
            else if (m.type === 'color')
              out = `<span style="color: ${m.attrs?.color}">${out}</span>`;
          }
          return out;
        })
        .join('');
      return `<${tag}>${inner}</${tag}>`;
    })
    .join('');
}
