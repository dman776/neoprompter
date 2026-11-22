import * as CFB from 'cfb';
import type { RichLine, Run } from '../core';
import type { ImportResult } from './index';

/**
 * Minimal reader for Word 97-2003 binary `.doc` files: the CFB container, the piece table
 * (text), character formatting (bold, italic, color), paragraph styles (headings) and the
 * style sheet (emphasis and color set by style). Everything else is ignored.
 */

class Unreadable extends Error {}
const fail = (why: string): never => {
  throw new Unreadable(why);
};

// Word 97 color palette (ico), index 1..16.
const ICO = [
  '', '#000000', '#0000ff', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#ffff00', '#ffffff',
  '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#c0c0c0',
];

type Fmt = { bold?: boolean; italic?: boolean; color?: string | null };
type Style = { basedOn?: number; para: boolean; chpx: Fmt };
type Span = { start: number; end: number; data: Uint8Array };

export function importDoc(bytes: Uint8Array, fileName: string): ImportResult {
  const unreadable = (extra = ''): ImportResult => ({
    ok: false,
    message: `"${fileName}" is not a readable Word (.doc) file.${extra}`,
  });
  let lines: RichLine[];
  try {
    lines = readDoc(bytes);
  } catch (e) {
    if (e instanceof Unreadable && e.message === 'encrypted') {
      return { ok: false, message: `"${fileName}" is password-protected; save an unprotected copy first.` };
    }
    return unreadable();
  }
  if (!lines.some((l) => l.runs.length > 0)) return { ok: false, message: `"${fileName}" has no text to import.` };
  return { ok: true, script: { name: fileName.replace(/\.doc$/i, ''), lines } };
}

function readDoc(bytes: Uint8Array): RichLine[] {
  const cfb = CFB.read(bytes, { type: 'array' });
  const wordStream = CFB.find(cfb, '/WordDocument')?.content;
  if (!wordStream) return fail('no WordDocument stream');
  const wd = Uint8Array.from(wordStream as ArrayLike<number>);
  const v = new DataView(wd.buffer);
  const at = (n: number) => (n < 0 || n > wd.length ? fail('out of range') : n);

  if (v.getUint16(0, true) !== 0xa5ec) fail('not a Word document');
  if (v.getUint16(2, true) < 0xc1) fail('older than Word 97');
  const flags = v.getUint16(0x0a, true);
  if (flags & 0x0100) fail('encrypted');
  const tableName = flags & 0x0200 ? '/1Table' : '/0Table';
  const tableStream = CFB.find(cfb, tableName)?.content;
  if (!tableStream) return fail('no table stream');
  const table = Uint8Array.from(tableStream as ArrayLike<number>);
  const tv = new DataView(table.buffer);

  const cswEnd = 34 + v.getUint16(32, true) * 2;
  const lwStart = cswEnd + 2;
  const ccpText = v.getInt32(lwStart + 3 * 4, true);
  const fcLcbStart = lwStart + v.getUint16(cswEnd, true) * 4 + 2;
  const pair = (i: number) => ({
    fc: v.getUint32(fcLcbStart + i * 8, true),
    lcb: v.getUint32(fcLcbStart + i * 8 + 4, true),
  });

  // Piece table: character position (cp) to file offset.
  const clx = pair(33);
  let p = at(clx.fc);
  const clxEnd = clx.fc + clx.lcb;
  while (p < clxEnd && table[p] === 0x01) p += 3 + tv.getUint16(p + 1, true);
  if (table[p] !== 0x02) fail('no piece table');
  const plcLen = tv.getUint32(p + 1, true);
  const plc = p + 5;
  const pieceCount = (plcLen - 4) / 12;
  if (!Number.isInteger(pieceCount) || pieceCount < 1) fail('bad piece table');
  const pieces = Array.from({ length: pieceCount }, (_, i) => {
    const raw = tv.getUint32(plc + (pieceCount + 1) * 4 + i * 8 + 2, true);
    const compressed = (raw & 0x40000000) !== 0;
    return {
      cpStart: tv.getUint32(plc + i * 4, true),
      cpEnd: tv.getUint32(plc + (i + 1) * 4, true),
      compressed,
      fc: compressed ? (raw & 0x3fffffff) / 2 : raw & 0x3fffffff,
    };
  });

  const chpx = readFkpSpans(wd, table, pair(12), 'chpx');
  const papx = readFkpSpans(wd, table, pair(13), 'papx');
  const styles = readStyles(table, pair(1));
  const headings = headingStyles(styles);

  const resolveStyle = (istd: number | undefined): Fmt => {
    const chain: Fmt[] = [];
    const seen = new Set<number>();
    for (let s = istd; s !== undefined && s !== 0xfff && !seen.has(s) && styles.has(s); s = styles.get(s)!.basedOn) {
      seen.add(s);
      chain.unshift(styles.get(s)!.chpx);
    }
    return Object.assign({}, ...chain) as Fmt;
  };

  // Walk the main-document text, one character at a time, with its file offset for formatting.
  const lines: RichLine[] = [];
  let current: Run[][] = [[]];
  let fieldDepth: { hidden: boolean }[] = [];
  let atParaStart = true;
  let lastWasCell = false;

  const add = (ch: string, fmt: Fmt) => {
    const runs = current[current.length - 1];
    const last = runs[runs.length - 1];
    const style: Omit<Run, 'text'> = {
      ...(fmt.bold ? { bold: true } : {}),
      ...(fmt.italic ? { italic: true } : {}),
      ...(fmt.color ? { color: fmt.color } : {}),
    };
    if (last && last.bold === style.bold && last.italic === style.italic && last.color === style.color) last.text += ch;
    else runs.push({ text: ch, ...style });
  };
  const endParagraph = (istd: number) => {
    const heading = headings.get(istd);
    for (const runs of current) lines.push({ ...(heading ? { heading } : {}), runs });
    current = [[]];
  };

  const total = Math.min(ccpText, pieces[pieces.length - 1].cpEnd);
  for (const piece of pieces) {
    const width = piece.compressed ? 1 : 2;
    for (let cp = piece.cpStart; cp < Math.min(piece.cpEnd, total); cp++) {
      const off = at(piece.fc + (cp - piece.cpStart) * width);
      const code = piece.compressed ? cp1252(wd[at(off)]) : v.getUint16(at(off), true);
      const ch = String.fromCharCode(code);
      const spans = findSpan(papx, off);
      const istd = spans ? (spans.data[0] | (spans.data[1] << 8)) : 0;

      if (code === 0x13) {
        fieldDepth.push({ hidden: true });
      } else if (code === 0x14) {
        if (fieldDepth.length) fieldDepth[fieldDepth.length - 1].hidden = false;
      } else if (code === 0x15) {
        fieldDepth.pop();
      } else if (fieldDepth.some((f) => f.hidden)) {
        // field instructions are not text
      } else if (code === 0x0d || code === 0x07) {
        if (code === 0x07 && lastWasCell && atParaStart) {
          lastWasCell = false; // row-end mark
          continue;
        }
        lastWasCell = code === 0x07;
        endParagraph(istd);
        atParaStart = true;
        continue;
      } else if (code === 0x0b) {
        current.push([]);
      } else if (code === 0x09) {
        add(' ', direct(off));
      } else if (code === 0x1e) {
        add('-', direct(off));
      } else if (code === 0x1f || code === 0x0c || code < 0x20) {
        // optional hyphen, page break, pictures and other control characters
      } else {
        add(ch, direct(off));
      }
      if (code !== 0x13 && code !== 0x14 && code !== 0x15) {
        atParaStart = false;
        lastWasCell = false;
      }

      function direct(o: number): Fmt {
        const paraFmt = resolveStyle(istd);
        const span = findSpan(chpx, o);
        const fmt: Fmt = { ...paraFmt };
        if (span) {
          const d = span.data;
          const sprms = parseSprms(d);
          const charStyle = sprms.find((s) => s.op === 0x4a30);
          if (charStyle) Object.assign(fmt, resolveStyle(charStyle.val));
          for (const s of sprms) applySprm(fmt, s.op, s.val, s.bytes);
        }
        return fmt;
      }
    }
  }
  if (current.some((r) => r.length > 0) || current.length > 1) endParagraph(0);
  fieldDepth = [];
  return lines.map((l) => ({ ...l, runs: l.runs.filter((r) => r.text !== '') }));
}

function cp1252(b: number): number {
  if (b < 0x80 || b >= 0xa0) return b;
  const table = [
    0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d,
    0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d,
    0x17e, 0x178,
  ];
  return table[b - 0x80];
}

type Sprm = { op: number; val: number; bytes: Uint8Array };

/** Splits a property list (grpprl) into single-property modifiers. */
function parseSprms(d: Uint8Array): Sprm[] {
  const out: Sprm[] = [];
  let i = 0;
  while (i + 2 <= d.length) {
    const op = d[i] | (d[i + 1] << 8);
    const spra = op >> 13;
    let size: number;
    if (spra === 0 || spra === 1) size = 1;
    else if (spra === 2 || spra === 4 || spra === 5) size = 2;
    else if (spra === 3) size = 4;
    else if (spra === 7) size = 3;
    else size = 1 + (d[i + 2] ?? 0);
    const bytes = d.subarray(i + 2, i + 2 + size);
    if (bytes.length < size) break;
    out.push({ op, val: bytes[0] | ((bytes[1] ?? 0) << 8), bytes });
    i += 2 + size;
  }
  return out;
}

/** Applies the three properties we keep; other modifiers (fonts, sizes...) are ignored. */
function applySprm(fmt: Fmt, op: number, val: number, bytes: Uint8Array): void {
  const toggle = (cur: boolean | undefined) => (val === 0x80 ? cur : val === 0x81 ? !cur : (val & 1) === 1);
  if (op === 0x0835) fmt.bold = toggle(fmt.bold);
  else if (op === 0x0836) fmt.italic = toggle(fmt.italic);
  else if (op === 0x2a42) fmt.color = ICO[val & 0xff] || null;
  else if (op === 0x6870 && bytes.length === 4) {
    const auto = bytes[3] === 0xff;
    fmt.color = auto ? null : `#${[0, 1, 2].map((k) => bytes[k].toString(16).padStart(2, '0')).join('')}`;
  }
}

/** Reads the character (chpx) or paragraph (papx) formatting runs, keyed by file offset. */
function readFkpSpans(
  wd: Uint8Array,
  table: Uint8Array,
  loc: { fc: number; lcb: number },
  kind: 'chpx' | 'papx',
): Span[] {
  const spans: Span[] = [];
  if (loc.lcb === 0) return spans;
  const tv = new DataView(table.buffer);
  const n = (loc.lcb - 4) / 8;
  if (!Number.isInteger(n) || n < 1) return fail('bad bin table');
  for (let i = 0; i < n; i++) {
    const pn = tv.getUint32(loc.fc + (n + 1) * 4 + i * 4, true) & 0x3fffff;
    const page = pn * 512;
    if (page + 512 > wd.length) fail('bad FKP page');
    const wv = new DataView(wd.buffer, wd.byteOffset + page, 512);
    const crun = wd[page + 511];
    const bxSize = kind === 'chpx' ? 1 : 13;
    for (let r = 0; r < crun; r++) {
      const bOffset = wd[page + (crun + 1) * 4 + r * bxSize];
      const start = wv.getUint32(r * 4, true);
      const end = wv.getUint32((r + 1) * 4, true);
      if (bOffset === 0) continue;
      const o = page + bOffset * 2;
      let data: Uint8Array;
      if (kind === 'chpx') {
        data = wd.subarray(o + 1, o + 1 + wd[o]);
      } else {
        const cb = wd[o] === 0 ? wd[o + 1] * 2 : wd[o] * 2 - 1;
        const from = wd[o] === 0 ? o + 2 : o + 1;
        data = wd.subarray(from, from + cb);
      }
      spans.push({ start, end, data });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

function findSpan(spans: Span[], off: number): Span | undefined {
  let lo = 0;
  let hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (off < spans[mid].start) hi = mid - 1;
    else if (off >= spans[mid].end) lo = mid + 1;
    else return spans[mid];
  }
  return undefined;
}

/** Reads the style sheet: each style's base, kind and own bold/italic/color. */
function readStyles(table: Uint8Array, loc: { fc: number; lcb: number }): Map<number, Style & { name: string }> {
  const out = new Map<number, Style & { name: string }>();
  if (loc.lcb === 0) return out;
  const tv = new DataView(table.buffer);
  const end = Math.min(table.length, loc.fc + loc.lcb);
  const cbStshi = tv.getUint16(loc.fc, true);
  const cstd = tv.getUint16(loc.fc + 2, true);
  const cbBase = tv.getUint16(loc.fc + 4, true);
  let p = loc.fc + 2 + cbStshi;
  for (let istd = 0; istd < cstd && p + 2 <= end; istd++) {
    const cb = tv.getUint16(p, true);
    const std = p + 2;
    p = std + cb;
    if (cb === 0) continue;
    const w1 = tv.getUint16(std + 2, true);
    const w2 = tv.getUint16(std + 4, true);
    const stk = w1 & 0xf;
    const para = stk === 1;
    const cupx = w2 & 0xf;
    const cch = tv.getUint16(std + cbBase, true);
    let q = std + cbBase + 2 + cch * 2 + 2;
    q += q % 2 === (std % 2) ? 0 : 1;
    let name = '';
    for (let i = 0; i < cch; i++) name += String.fromCharCode(tv.getUint16(std + cbBase + 2 + i * 2, true));
    const upxs: Uint8Array[] = [];
    for (let k = 0; k < cupx && q + 2 <= std + cb; k++) {
      const len = tv.getUint16(q, true);
      upxs.push(table.subarray(q + 2, q + 2 + len));
      q += 2 + len + (len % 2);
    }
    const chpxBytes = para ? upxs[1] : upxs[0];
    const chpx: Fmt = {};
    if (chpxBytes) for (const s of parseSprms(chpxBytes)) applySprm(chpx, s.op, s.val, s.bytes);
    out.set(istd, { name, para, basedOn: (w1 >> 4) === 0xfff ? undefined : w1 >> 4, chpx });
  }
  return out;
}

/** istd to heading level, by style name ("heading 2", "Title"), falling back to Word's built-in 1..9. */
function headingStyles(styles: Map<number, Style & { name: string }>): Map<number, number> {
  const map = new Map<number, number>();
  for (const [istd, s] of styles) {
    if (!s.para) continue;
    if (/^title$/i.test(s.name)) map.set(istd, 1);
    else {
      const m = /^heading\s*([1-9])$/i.exec(s.name);
      if (m) map.set(istd, Math.min(6, Number(m[1])));
    }
  }
  if (styles.size === 0) for (let i = 1; i <= 6; i++) map.set(i, i);
  return map;
}
