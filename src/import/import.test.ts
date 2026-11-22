import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { importDocx } from './index';
import { makeDocx, para, run } from './fixtures';

function lines(body: string, styles?: string) {
  const result = importDocx(makeDocx(body, styles), 'Sunday.docx');
  if (!result.ok) throw new Error(result.message);
  return result.script.lines;
}

describe('importDocx', () => {
  it('imports paragraphs as lines and names the Script after the file', () => {
    const result = importDocx(makeDocx(para([run('One')]) + para([run('Two')])), 'Sunday.docx');
    expect(result).toEqual({
      ok: true,
      script: { name: 'Sunday', lines: [{ runs: [{ text: 'One' }] }, { runs: [{ text: 'Two' }] }] },
    });
  });

  it('keeps empty paragraphs as blank lines', () => {
    expect(lines(para([run('A')]) + para([]) + para([run('B')]))).toEqual([
      { runs: [{ text: 'A' }] },
      { runs: [] },
      { runs: [{ text: 'B' }] },
    ]);
  });

  it('keeps headings by built-in style id and by style name', () => {
    const styles =
      '<w:styles xmlns:w="W"><w:style w:styleId="Big"><w:name w:val="heading 2"/></w:style></w:styles>';
    expect(
      lines(
        para([run('Title')], 'Heading1') + para([run('Sub')], 'Big') + para([run('Body')], 'Normal'),
        styles,
      ),
    ).toEqual([
      { heading: 1, runs: [{ text: 'Title' }] },
      { heading: 2, runs: [{ text: 'Sub' }] },
      { runs: [{ text: 'Body' }] },
    ]);
  });

  it('keeps bold and italic, and merges neighbouring runs with the same style', () => {
    expect(
      lines(
        para([
          run('a ', '<w:b/>'),
          run('b ', '<w:b w:val="1"/>'),
          run('c ', '<w:i/>'),
          run('d ', '<w:b w:val="false"/>'),
        ]),
      ),
    ).toEqual([
      { runs: [{ text: 'a b ', bold: true }, { text: 'c ', italic: true }, { text: 'd ' }] },
    ]);
  });

  it('keeps source colors as-is and ignores "auto"', () => {
    expect(
      lines(
        para([
          run('red', '<w:color w:val="C00000"/>'),
          run('auto', '<w:color w:val="auto"/>'),
          run('pale', '<w:color w:val="FFFF00"/>'),
        ]),
      ),
    ).toEqual([
      { runs: [{ text: 'red', color: '#c00000' }, { text: 'auto' }, { text: 'pale', color: '#ffff00' }] },
    ]);
  });

  it('drops fonts, sizes and spacing', () => {
    const body = para([
      run(
        'plain',
        '<w:rFonts w:ascii="Comic Sans MS"/><w:sz w:val="72"/><w:szCs w:val="72"/><w:spacing w:val="40"/>',
      ),
    ]).replace('<w:p>', '<w:p><w:pPr><w:spacing w:before="480" w:after="480"/><w:jc w:val="center"/></w:pPr>');
    expect(lines(body)).toEqual([{ runs: [{ text: 'plain' }] }]);
  });

  it('reads paragraphs inside tables and splits on line breaks', () => {
    const cell = '<w:tbl><w:tr><w:tc>' + para([run('In cell')]) + '</w:tc></w:tr></w:tbl>';
    const br = para([run('x'), '<w:r><w:br/></w:r>', run('y')]);
    expect(lines(cell + br)).toEqual([
      { runs: [{ text: 'In cell' }] },
      { runs: [{ text: 'x' }] },
      { runs: [{ text: 'y' }] },
    ]);
  });

  it('gives a clear message for a corrupt file', () => {
    const result = importDocx(strToU8('definitely not a zip'), 'bad.docx');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/bad\.docx.*not a readable Word/i);
  });

  it('gives a clear message for a zip that is not a Word document', () => {
    const result = importDocx(makeDocx('').slice(0, 20), 'cut.docx');
    expect(result.ok).toBe(false);
  });

  it('says so when the document has no text', () => {
    const result = importDocx(makeDocx(para([])), 'empty.docx');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/no text/i);
  });
});

describe('importDocx style inheritance', () => {
  const W = '<w:styles xmlns:w="W">';
  it('reads bold, italic and color from character styles, following basedOn', () => {
    const styles =
      W +
      '<w:style w:type="character" w:styleId="Strong"><w:rPr><w:b/></w:rPr></w:style>' +
      '<w:style w:type="character" w:styleId="Red"><w:basedOn w:val="Strong"/><w:rPr><w:i/><w:color w:val="FF0000"/></w:rPr></w:style></w:styles>';
    expect(
      lines(
        para([run('a', '<w:rStyle w:val="Strong"/>'), run('b', '<w:rStyle w:val="Red"/>'), run('c')]),
        styles,
      ),
    ).toEqual([
      { runs: [{ text: 'a', bold: true }, { text: 'b', bold: true, italic: true, color: '#ff0000' }, { text: 'c' }] },
    ]);
  });

  it('reads emphasis from paragraph styles and lets direct formatting override them', () => {
    const styles =
      W +
      '<w:style w:type="paragraph" w:styleId="Quote"><w:rPr><w:i/><w:color w:val="0000FF"/></w:rPr></w:style></w:styles>';
    expect(
      lines(para([run('q'), run('n', '<w:i w:val="0"/><w:color w:val="00FF00"/>')], 'Quote'), styles),
    ).toEqual([{ runs: [{ text: 'q', italic: true, color: '#0000ff' }, { text: 'n', color: '#00ff00' }] }]);
  });

  it('applies document defaults and basedOn chains of paragraph styles, including heading styles', () => {
    const styles =
      W +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:color w:val="333333"/></w:rPr></w:rPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Fancy"><w:basedOn w:val="Heading1"/><w:rPr><w:b w:val="0"/><w:i/></w:rPr></w:style></w:styles>';
    expect(lines(para([run('H')], 'Heading1') + para([run('F')], 'Fancy') + para([run('P')]), styles)).toEqual([
      { heading: 1, runs: [{ text: 'H', bold: true, color: '#333333' }] },
      { runs: [{ text: 'F', italic: true, color: '#333333' }] },
      { runs: [{ text: 'P', color: '#333333' }] },
    ]);
  });

  it('survives a basedOn loop', () => {
    const styles =
      W +
      '<w:style w:styleId="A"><w:basedOn w:val="B"/><w:rPr><w:b/></w:rPr></w:style><w:style w:styleId="B"><w:basedOn w:val="A"/></w:style></w:styles>';
    expect(lines(para([run('x')], 'A'), styles)).toEqual([{ runs: [{ text: 'x', bold: true }] }]);
  });
});
