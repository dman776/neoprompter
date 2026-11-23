import { describe, expect, it } from 'vitest';
import { importDocument } from './index';
import { makePdf } from './pdfFixtures';

describe('importDocument for .pdf', () => {
  it('joins wrapped lines into a paragraph and names the Script after the file', async () => {
    const pdf = makePdf([
      [
        { text: 'Good morning', y: 700 },
        { text: 'everyone', y: 686 },
      ],
    ]);
    expect(await importDocument(pdf, 'Sunday.pdf')).toEqual({
      ok: true,
      script: { name: 'Sunday', lines: ['Good morning everyone'] },
    });
  });

  it('starts a new paragraph where the vertical gap is larger than a wrapped line', async () => {
    const pdf = makePdf([
      [
        { text: 'Good morning', y: 700 },
        { text: 'everyone', y: 686 },
        { text: 'Please stand', y: 658 },
      ],
    ]);
    expect(await importDocument(pdf, 'x.pdf')).toMatchObject({
      ok: true,
      script: { lines: ['Good morning everyone', 'Please stand'] },
    });
  });

  it('lets pages flow together, with no page break marker', async () => {
    const pdf = makePdf([
      [{ text: 'Let us pray for', y: 100 }],
      [{ text: 'our community', y: 700 }],
    ]);
    expect(await importDocument(pdf, 'x.pdf')).toMatchObject({
      ok: true,
      script: { lines: ['Let us pray for our community'] },
    });
  });

  it('keeps text on one baseline together as one line', async () => {
    const pdf = makePdf([
      [
        { text: 'Hello ', y: 700, x: 72 },
        { text: 'world', y: 700, x: 110 },
      ],
    ]);
    expect(await importDocument(pdf, 'x.pdf')).toMatchObject({
      ok: true,
      script: { lines: ['Hello world'] },
    });
  });

  it('refuses a PDF with no text, such as a scan, and says there is no OCR', async () => {
    expect(await importDocument(makePdf([[], []]), 'Scan.pdf')).toEqual({
      ok: false,
      message:
        '"Scan.pdf" has no text to import. A scanned PDF has only pictures, and there is no OCR.',
    });
  });

  it('refuses a password-protected PDF', async () => {
    const pdf = makePdf([[{ text: 'Secret', y: 700 }]], { encrypted: true });
    expect(await importDocument(pdf, 'Locked.pdf')).toEqual({
      ok: false,
      message: '"Locked.pdf" is password-protected; remove the password and try again.',
    });
  });

  it('refuses bytes that are not a PDF', async () => {
    expect(await importDocument(new TextEncoder().encode('not a pdf'), 'Bad.pdf')).toEqual({
      ok: false,
      message: '"Bad.pdf" is not a readable PDF.',
    });
  });

  it('reads the Buffer that fs.readFileSync returns', async () => {
    const pdf = Buffer.from(makePdf([[{ text: 'Hello there', y: 700 }]]));
    expect(await importDocument(pdf, 'x.pdf')).toMatchObject({
      ok: true,
      script: { lines: ['Hello there'] },
    });
  });
});
