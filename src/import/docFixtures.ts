// Legacy `.doc` (Word 97-2003 binary) fixtures, built in code so no binaries are committed.
import * as CFB from 'cfb';

export type DocRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Word 97 color palette index (1 black, 2 blue, 6 red, ...). */
  ico?: number;
  /** 24-bit color as 0xRRGGBB (sprmCCv). */
  rgb?: number;
  /** Character style id (istd). */
  charStyle?: number;
};
export type DocPara = { runs: DocRun[]; style?: number };
export type DocStyle = {
  name: string;
  type: 'paragraph' | 'character';
  basedOn?: number;
  bold?: boolean;
  italic?: boolean;
  ico?: number;
};
export type DocOptions = {
  /** Style table by istd. Defaults to Normal, heading 1, heading 2. */
  styles?: DocStyle[];
  /** Store the text as UTF-16 instead of compressed cp1252. */
  unicode?: boolean;
};

const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

function chpxSprms(r: {
  bold?: boolean;
  italic?: boolean;
  ico?: number;
  rgb?: number;
  charStyle?: number;
}): number[] {
  const out: number[] = [];
  if (r.charStyle !== undefined) out.push(...u16(0x4a30), ...u16(r.charStyle));
  if (r.bold !== undefined) out.push(...u16(0x0835), r.bold ? 1 : 0);
  if (r.italic !== undefined) out.push(...u16(0x0836), r.italic ? 1 : 0);
  if (r.ico !== undefined) out.push(...u16(0x2a42), r.ico);
  if (r.rgb !== undefined) out.push(...u16(0x6870), (r.rgb >> 16) & 0xff, (r.rgb >> 8) & 0xff, r.rgb & 0xff, 0);
  return out;
}

const evenPad = (b: number[]) => (b.length % 2 ? [...b, 0] : b);

function stshStream(styles: DocStyle[]): number[] {
  const stshi = [...u16(styles.length), ...u16(10), ...new Array(14).fill(0)];
  const out: number[] = [...u16(stshi.length), ...stshi];
  for (const s of styles) {
    const name = [...u16(s.name.length), ...[...s.name].flatMap((c) => u16(c.charCodeAt(0))), 0, 0];
    const isPara = s.type === 'paragraph';
    const base = [
      ...u16(0), // sti + flags
      ...u16(((s.basedOn ?? 0xfff) << 4) | (isPara ? 1 : 2)), // istdBase + stk
      ...u16(isPara ? 2 : 1), // cupx + istdNext
      ...u16(0), // bchUpx
      ...u16(0), // grfstd
    ];
    const upx = (b: number[]) => [...u16(b.length), ...evenPad(b)];
    const std = [...base, ...name];
    const padded = evenPad(std);
    if (isPara) padded.push(...upx(u16(0)), ...upx(chpxSprms(s)));
    else padded.push(...upx(chpxSprms(s)));
    out.push(...u16(padded.length), ...padded);
  }
  return out;
}

/** Builds a minimal but structurally real `.doc`: CFB with WordDocument and 1Table streams. */
export function makeDoc(paragraphs: DocPara[], options: DocOptions = {}): Uint8Array {
  const styles: DocStyle[] = options.styles ?? [
    { name: 'Normal', type: 'paragraph' },
    { name: 'heading 1', type: 'paragraph', basedOn: 0, bold: true },
    { name: 'heading 2', type: 'paragraph', basedOn: 0, bold: true },
  ];
  const unicode = options.unicode ?? false;
  const width = unicode ? 2 : 1;
  const TEXT_FC = 1024;

  let text = '';
  const chpx: { start: number; end: number; sprms: number[] }[] = [];
  const papx: { start: number; end: number; istd: number }[] = [];
  for (const p of paragraphs) {
    const pStart = text.length;
    for (const r of p.runs) {
      if (r.text === '') continue;
      chpx.push({ start: text.length, end: text.length + r.text.length, sprms: chpxSprms(r) });
      text += r.text;
    }
    text += '\r';
    papx.push({ start: pStart, end: text.length, istd: p.style ?? 0 });
  }
  const ccpText = text.length;
  const wd: number[] = new Array(TEXT_FC).fill(0);
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (unicode) wd.push(...u16(c));
    else wd.push(c & 0xff);
  }
  const fcOf = (i: number) => TEXT_FC + i * width;

  type Entry = { start: number; end: number; data: number[]; bx: (off: number) => number[] };
  const fkp = (entries: Entry[]) => {
    const page = new Array(512).fill(0);
    const n = entries.length;
    entries.forEach((e, i) => page.splice(i * 4, 4, ...u32(fcOf(e.start))));
    page.splice(n * 4, 4, ...u32(fcOf(entries[n - 1].end)));
    const bxStart = (n + 1) * 4;
    const bxSize = entries[0].bx(0).length;
    let dataPos = bxStart + n * bxSize;
    dataPos += dataPos % 2;
    entries.forEach((e, i) => {
      page.splice(bxStart + i * bxSize, bxSize, ...e.bx(dataPos / 2));
      page.splice(dataPos, e.data.length, ...e.data);
      dataPos += e.data.length + (e.data.length % 2);
    });
    if (dataPos > 511) throw new Error('fixture too large for one FKP');
    page[511] = n;
    return page;
  };
  const alignTo512 = () => {
    while (wd.length % 512) wd.push(0);
  };

  alignTo512();
  const chpxPage = wd.length / 512;
  if (chpx.length > 0) {
    wd.push(...fkp(chpx.map((e) => ({ ...e, data: [e.sprms.length, ...e.sprms], bx: (off) => [off] }))));
  }
  const papxPage = wd.length / 512;
  const papxData = (istd: number) => {
    const body = [...u16(istd), 0]; // istd + pad: odd length, as Word writes it
    return [(body.length + 1) / 2, ...body];
  };
  wd.push(
    ...fkp(papx.map((e) => ({ ...e, data: papxData(e.istd), bx: (off) => [off, ...new Array(12).fill(0)] }))),
  );

  // Table stream: Clx, PlcfBteChpx, PlcfBtePapx, STSH.
  const table: number[] = [];
  const pcd = [...u16(0), ...u32(unicode ? TEXT_FC : (TEXT_FC * 2) | 0x40000000), ...u16(0)];
  const plcPcd = [...u32(0), ...u32(ccpText), ...pcd];
  table.push(0x02, ...u32(plcPcd.length), ...plcPcd);
  const clx = { fc: 0, lcb: table.length };
  const plc = (page: number) => [...u32(fcOf(0)), ...u32(fcOf(ccpText)), ...u32(page)];
  const chpxLoc = { fc: table.length, lcb: 0 };
  if (chpx.length > 0) table.push(...plc(chpxPage));
  chpxLoc.lcb = table.length - chpxLoc.fc;
  const papxLoc = { fc: table.length, lcb: 0 };
  table.push(...plc(papxPage));
  papxLoc.lcb = table.length - papxLoc.fc;
  const stshLoc = { fc: table.length, lcb: 0 };
  table.push(...stshStream(styles));
  stshLoc.lcb = table.length - stshLoc.fc;

  const fib: number[] = [...u16(0xa5ec), ...u16(0x00c1), ...u16(0), ...u16(0x0409), ...u16(0), ...u16(0x0200)];
  while (fib.length < 32) fib.push(0);
  fib.push(...u16(14), ...new Array(28).fill(0)); // csw + fibRgW
  const rgLw = new Array(22).fill(0);
  rgLw[3] = ccpText;
  fib.push(...u16(22), ...rgLw.flatMap(u32)); // cslw + fibRgLw
  const pairs: { fc: number; lcb: number }[] = Array.from({ length: 93 }, () => ({ fc: 0, lcb: 0 }));
  pairs[1] = stshLoc;
  pairs[12] = chpxLoc;
  pairs[13] = papxLoc;
  pairs[33] = clx;
  fib.push(...u16(93), ...pairs.flatMap((p) => [...u32(p.fc), ...u32(p.lcb)]));
  wd.splice(0, fib.length, ...fib);

  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, '/WordDocument', Uint8Array.from(wd));
  CFB.utils.cfb_add(cfb, '/1Table', Uint8Array.from(table));
  return Uint8Array.from(CFB.write(cfb, { type: 'array' }) as number[]);
}
