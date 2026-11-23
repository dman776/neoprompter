import { describe, expect, it } from 'vitest';
import type { ScriptLine } from '../core';
import { docToLines, linesToDoc } from './index';

const roundTrip = (lines: ScriptLine[]) => docToLines(linesToDoc(lines));

describe('Script to editor document and back', () => {
  it('keeps plain paragraphs and blank lines', () => {
    const lines = ['Welcome.', '', 'Please stand.'];
    expect(roundTrip(lines)).toEqual(lines);
  });

  it('keeps headings of every level', () => {
    const lines: ScriptLine[] = [
      { heading: 1, runs: [{ text: 'Opening' }] },
      { heading: 3, runs: [{ text: 'Detail' }] },
      'body',
    ];
    expect(roundTrip(lines)).toEqual(lines);
  });

  it('keeps bold, italic and color on runs, in order', () => {
    const lines: ScriptLine[] = [
      {
        runs: [
          { text: 'Say ' },
          { text: 'hello', bold: true },
          { text: ' and ' },
          { text: 'wave', italic: true, color: '#ff0000' },
          { text: ' now', bold: true, italic: true },
        ],
      },
    ];
    expect(roundTrip(lines)).toEqual(lines);
  });

  it('maps a line to a paragraph or heading node with marked text', () => {
    const doc = linesToDoc([{ heading: 2, runs: [{ text: 'Hi', bold: true, color: '#00ff00' }] }]);
    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            {
              type: 'text',
              text: 'Hi',
              marks: [{ type: 'bold' }, { type: 'color', attrs: { color: '#00ff00' } }],
            },
          ],
        },
      ],
    });
  });

  it('turns an unstyled one-run line back into a plain string', () => {
    expect(roundTrip([{ runs: [{ text: 'plain' }] }])).toEqual(['plain']);
  });

  it('merges neighbouring runs with the same style', () => {
    const doc = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    expect(docToLines(doc)).toEqual([{ runs: [{ text: 'ab', bold: true }] }]);
  });

  it('never produces fonts or sizes, even from pasted content that carries them', () => {
    const doc = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          attrs: { style: 'font-size: 40pt' },
          content: [
            {
              type: 'text',
              text: 'Pasted',
              marks: [
                { type: 'textStyle', attrs: { fontFamily: 'Comic Sans', fontSize: '40pt' } },
                { type: 'bold' },
              ],
            },
          ],
        },
      ],
    };
    const lines = docToLines(doc);
    expect(lines).toEqual([{ runs: [{ text: 'Pasted', bold: true }] }]);
    expect(JSON.stringify(lines)).not.toMatch(/font|size|style/i);
  });

  it('drops a color that is not #rrggbb', () => {
    const doc = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'x', marks: [{ type: 'color', attrs: { color: 'red' } }] },
          ],
        },
      ],
    };
    expect(docToLines(doc)).toEqual(['x']);
  });

  it('gives an empty document one empty line', () => {
    expect(docToLines({ type: 'doc', content: [] })).toEqual(['']);
  });
});
