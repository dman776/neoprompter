import { strToU8, zipSync } from 'fflate';

/** Builds a minimal `.docx` (a zip of OOXML parts) from a `<w:body>` fragment, for tests. */
export function makeDocx(bodyXml: string, stylesXml = '<w:styles xmlns:w="W"/>'): Uint8Array {
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="xml" ContentType="application/xml"/></Types>',
    ),
    'word/document.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="${ns}"><w:body>${bodyXml}</w:body></w:document>`,
    ),
    'word/styles.xml': strToU8(stylesXml.replace('xmlns:w="W"', `xmlns:w="${ns}"`)),
  });
}

/** `<w:p>` with optional paragraph style id and a list of run fragments. */
export function para(runs: string[], styleId?: string): string {
  const ppr = styleId ? `<w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>` : '';
  return `<w:p>${ppr}${runs.join('')}</w:p>`;
}

/** `<w:r>` with raw run-property XML and text. */
export function run(text: string, rpr = ''): string {
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}
