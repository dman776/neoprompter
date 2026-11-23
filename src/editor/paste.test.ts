// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { cleanPastedHtml, pastedHtmlToLines } from './index';

const WORD = `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head>
<style><!-- p.MsoNormal { font-family: "Calibri"; font-size: 11pt } --></style></head><body>
<!--StartFragment-->
<h1 style="margin-top:12pt;mso-line-height-rule:exactly"><span style="font-size:16.0pt;font-family:'Calibri Light'">Opening</span></h1>
<p class="MsoNormal" style="margin-bottom:8pt;line-height:107%"><span style="font-size:14.0pt;font-family:Arial;color:#FF0000">Say </span><b style="mso-bidi-font-weight:normal"><span style="font-size:14pt">hello</span></b><span style="font-style:italic"> and wave</span><o:p></o:p></p>
<p class="MsoNormal"><o:p>&nbsp;</o:p></p>
<p class="MsoNormal"><span style="color:windowtext;font-weight:700">Done.</span></p>
<!--EndFragment--></body></html>`;

describe('pasting Word content', () => {
  it('keeps headings, bold, italic and color, and drops everything else', () => {
    expect(pastedHtmlToLines(WORD)).toEqual([
      { heading: 1, runs: [{ text: 'Opening' }] },
      {
        runs: [
          { text: 'Say ', color: '#ff0000' },
          { text: 'hello', bold: true },
          { text: ' and wave', italic: true },
        ],
      },
      '',
      { runs: [{ text: 'Done.', bold: true }] },
    ]);
  });

  it('reads rgb() and short hex colors', () => {
    expect(
      pastedHtmlToLines(
        '<p><span style="color:rgb(0, 128, 255)">a</span><span style="color:#0f0">b</span></p>',
      ),
    ).toEqual([
      {
        runs: [
          { text: 'a', color: '#0080ff' },
          { text: 'b', color: '#00ff00' },
        ],
      },
    ]);
  });

  it('splits lines at breaks and list items and collapses source whitespace', () => {
    expect(pastedHtmlToLines('<div>one<br>two</div><ul><li>  three \n four </li></ul>')).toEqual([
      'one',
      'two',
      'three four',
    ]);
  });

  it('produces clean HTML with no fonts, sizes or spacing', () => {
    const html = cleanPastedHtml(WORD);
    expect(html).not.toMatch(/font|size|margin|line-height|class=|mso|Calibri|windowtext/i);
    expect(html).toContain('<h1>Opening</h1>');
    expect(html).toContain('color: #ff0000');
    expect(html).toContain('<strong>hello</strong>');
  });
});
