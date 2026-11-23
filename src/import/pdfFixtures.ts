/** One piece of text on a page: `y` counts up from the bottom edge, in points. */
export interface PdfText {
  text: string;
  y: number;
  x?: number;
  size?: number;
}

export interface PdfOptions {
  /** Marks the file as password-protected (a standard security handler with an unknown password). */
  encrypted?: boolean;
}

const escape = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/**
 * Builds a small, valid PDF in code: one Helvetica text object per entry, pages in order. A page
 * with no entries has no text at all, like a scanned page. Tests use it the way `.docx` tests
 * use `fixtures.ts`.
 */
export function makePdf(pages: PdfText[][], options: PdfOptions = {}): Uint8Array {
  const objects: string[] = [];
  // 1 = catalog, 2 = pages, 3 = font; then a page object and a content stream for each page.
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = '<</Type/Catalog/Pages 2 0 R>>';
  objects[2] = `<</Type/Pages/Kids[${pageIds.map((id) => `${id} 0 R`).join(' ')}]/Count ${pages.length}>>`;
  objects[3] = '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>';
  pages.forEach((items, i) => {
    const content = items
      .map((t) => `BT /F1 ${t.size ?? 12} Tf ${t.x ?? 72} ${t.y} Td (${escape(t.text)}) Tj ET`)
      .join('\n');
    const pageId = 4 + i * 2;
    objects[pageId] =
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents ${pageId + 1} 0 R/Resources<</Font<</F1 3 0 R>>>>>>`;
    objects[pageId + 1] = `<</Length ${content.length}>>\nstream\n${content}\nendstream`;
  });
  const encryptId = objects.length;
  const zeros = '0'.repeat(64);
  if (options.encrypted) {
    objects[encryptId] = `<</Filter/Standard/V 1/R 2/O<${zeros}>/U<${zeros}>/P -4>>`;
  }

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  const extra = options.encrypted
    ? `/Encrypt ${encryptId} 0 R/ID[<${'a'.repeat(32)}><${'a'.repeat(32)}>]`
    : '';
  out += `trailer\n<</Size ${objects.length}/Root 1 0 R${extra}>>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
