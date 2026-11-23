import type { ImportResult } from './index';

/** Imports a plain-text file: one plain paragraph per line. */
export function importText(bytes: Uint8Array, fileName: string): ImportResult {
  let text: string;
  try {
    text = decode(bytes);
  } catch {
    return { ok: false, message: `"${fileName}" is not readable text.` };
  }
  const lines = text.split(/\r\n|\r|\n/);
  if (!lines.some((l) => l.trim() !== '')) {
    return { ok: false, message: `"${fileName}" has no text to import.` };
  }
  return { ok: true, script: { name: fileName.replace(/\.txt$/i, ''), lines } };
}

/** UTF-8 (BOM stripped) or UTF-16 told by its BOM; anything else is an error. */
function decode(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
}
