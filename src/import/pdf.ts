import * as worker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ImportResult } from './index';

// pdf.js runs its parser in a worker; handing it the worker module keeps it in this process
// (in Node it would otherwise look for the worker file on disk, which a bundle does not have).
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;

/**
 * A gap between two lines, in line heights, above which the next line starts a new paragraph.
 * Wrapped lines sit about 1.2 to 1.5 heights apart; a blank line or paragraph spacing is more.
 */
const PARAGRAPH_GAP = 1.6;

interface Line {
  text: string;
  y: number;
  height: number;
}

/** Imports a `.pdf` as a Script: its text only, with wrapped lines joined into paragraphs. */
export async function importPdf(bytes: Uint8Array, fileName: string): Promise<ImportResult> {
  // A plain Uint8Array copy: pdf.js refuses a Node Buffer and takes ownership of what it is given.
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (error) {
    if ((error as { name?: string }).name === 'PasswordException') {
      return {
        ok: false,
        message: `"${fileName}" is password-protected; remove the password and try again.`,
      };
    }
    return { ok: false, message: `"${fileName}" is not a readable PDF.` };
  }
  const lines: string[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length > 0) lines.push(paragraph.join(' '));
    paragraph = [];
  };

  try {
    for (let n = 1; n <= doc.numPages; n++) {
      let previous: Line | null = null;
      for (const line of linesOf(await (await doc.getPage(n)).getTextContent())) {
        if (previous && previous.y - line.y > PARAGRAPH_GAP * previous.height) endParagraph();
        paragraph.push(line.text);
        previous = line;
      }
    }
  } catch {
    return { ok: false, message: `"${fileName}" is not a readable PDF.` };
  } finally {
    await task.destroy();
  }
  endParagraph();
  if (lines.length === 0) {
    return {
      ok: false,
      message: `"${fileName}" has no text to import. A scanned PDF has only pictures, and there is no OCR.`,
    };
  }
  return { ok: true, script: { name: fileName.replace(/\.pdf$/i, ''), lines } };
}

/** One page's text items in reading order, with items sharing a baseline joined into one line. */
function linesOf(content: { items: unknown[] }): Line[] {
  const lines: Line[] = [];
  for (const item of content.items) {
    if (typeof item !== 'object' || item === null || !('str' in item)) continue;
    const { str, transform, height } = item as { str: string; transform: number[]; height: number };
    const y = transform[5];
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - y) < (height || last.height) / 2) last.text += str;
    else lines.push({ text: str, y, height: height || 12 });
  }
  return lines
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text !== '');
}
