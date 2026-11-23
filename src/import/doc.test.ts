import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { importDoc, importDocument } from './index';
import { makeDoc, type DocOptions, type DocPara } from './docFixtures';

function script(paras: DocPara[], options?: DocOptions) {
  const result = importDoc(makeDoc(paras, options), 'Old.doc');
  if (!result.ok) throw new Error(result.message);
  return result.script;
}
const lines = (paras: DocPara[], options?: DocOptions) => script(paras, options).lines;

describe('importDoc (legacy .doc)', () => {
  it('imports paragraphs as lines and names the Script after the file', () => {
    expect(script([{ runs: [{ text: 'One' }] }, { runs: [{ text: 'Two' }] }])).toEqual({
      name: 'Old',
      lines: [{ runs: [{ text: 'One' }] }, { runs: [{ text: 'Two' }] }],
    });
  });

  it('keeps empty paragraphs as blank lines', () => {
    expect(lines([{ runs: [{ text: 'A' }] }, { runs: [] }, { runs: [{ text: 'B' }] }])).toEqual([
      { runs: [{ text: 'A' }] },
      { runs: [] },
      { runs: [{ text: 'B' }] },
    ]);
  });

  it('reads UTF-16 text', () => {
    expect(lines([{ runs: [{ text: 'Grace — é中' }] }], { unicode: true })).toEqual([
      { runs: [{ text: 'Grace — é中' }] },
    ]);
  });

  it('keeps bold and italic from direct formatting and merges equal neighbours', () => {
    expect(
      lines([
        {
          runs: [
            { text: 'a ', bold: true },
            { text: 'b ', bold: true },
            { text: 'c ', italic: true },
            { text: 'd ', bold: false },
          ],
        },
      ]),
    ).toEqual([
      { runs: [{ text: 'a b ', bold: true }, { text: 'c ', italic: true }, { text: 'd ' }] },
    ]);
  });

  it('keeps source colors from the palette and from 24-bit values', () => {
    expect(
      lines([
        {
          runs: [
            { text: 'red', ico: 6 },
            { text: 'auto', ico: 0 },
            { text: 'orange', rgb: 0xff8000 },
          ],
        },
      ]),
    ).toEqual([
      {
        runs: [
          { text: 'red', color: '#ff0000' },
          { text: 'auto' },
          { text: 'orange', color: '#ff8000' },
        ],
      },
    ]);
  });

  it('keeps headings from the paragraph style', () => {
    expect(
      lines([
        { runs: [{ text: 'Title' }], style: 1 },
        { runs: [{ text: 'Sub' }], style: 2 },
        { runs: [{ text: 'Body' }], style: 0 },
      ]),
    ).toEqual([
      { heading: 1, runs: [{ text: 'Title', bold: true }] },
      { heading: 2, runs: [{ text: 'Sub', bold: true }] },
      { runs: [{ text: 'Body' }] },
    ]);
  });

  it('reads emphasis and color from paragraph and character styles, following basedOn', () => {
    const styles: DocOptions['styles'] = [
      { name: 'Normal', type: 'paragraph' },
      { name: 'Quote', type: 'paragraph', basedOn: 0, italic: true, ico: 2 },
      { name: 'Loud', type: 'character', bold: true },
      { name: 'Louder', type: 'character', basedOn: 2, ico: 6 },
    ];
    expect(
      lines(
        [
          { runs: [{ text: 'q' }, { text: 'n', italic: false }], style: 1 },
          {
            runs: [
              { text: 'x', charStyle: 2 },
              { text: 'y', charStyle: 3 },
            ],
          },
        ],
        { styles },
      ),
    ).toEqual([
      {
        runs: [
          { text: 'q', italic: true, color: '#0000ff' },
          { text: 'n', color: '#0000ff' },
        ],
      },
      {
        runs: [
          { text: 'x', bold: true },
          { text: 'y', bold: true, color: '#ff0000' },
        ],
      },
    ]);
  });

  it('splits line breaks, drops field codes and non-text controls', () => {
    expect(
      lines([
        {
          runs: [
            { text: 'x\vy' },
            { text: '\x13 HYPERLINK "u" \x14link\x15' },
            { text: '\x01\x08z' },
          ],
        },
      ]),
    ).toEqual([{ runs: [{ text: 'x' }] }, { runs: [{ text: 'ylinkz' }] }]);
  });

  it('treats table cells as lines and skips the row-end mark', () => {
    expect(lines([{ runs: [{ text: 'A\x07B\x07\x07C' }] }])).toEqual([
      { runs: [{ text: 'A' }] },
      { runs: [{ text: 'B' }] },
      { runs: [{ text: 'C' }] },
    ]);
  });

  it('gives a clear message for a corrupt file', () => {
    for (const bytes of [
      strToU8('definitely not a cfb'),
      makeDoc([{ runs: [{ text: 'x' }] }]).slice(0, 700),
    ]) {
      const result = importDoc(bytes, 'bad.doc');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/bad\.doc.*not a readable Word/i);
    }
  });

  it('says so when the document has no text', () => {
    const result = importDoc(makeDoc([{ runs: [] }]), 'empty.doc');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/no text/i);
  });
});

describe('importDocument', () => {
  it('dispatches by extension', () => {
    const doc = importDocument(makeDoc([{ runs: [{ text: 'hi' }] }]), 'A.DOC');
    expect(doc).toEqual({ ok: true, script: { name: 'A', lines: [{ runs: [{ text: 'hi' }] }] } });
    const other = importDocument(strToU8('x'), 'A.png');
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.message).toMatch(/\.doc, \.docx or \.txt/);
  });
});
