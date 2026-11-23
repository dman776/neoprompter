import { describe, expect, it } from 'vitest';
import { strToU8 } from 'fflate';
import { importDocument } from './index';

describe('importDocument for .txt', () => {
  it('imports each line as a plain paragraph and names the Script after the file', async () => {
    const result = await importDocument(strToU8('One\nTwo'), 'Sunday.txt');
    expect(result).toEqual({ ok: true, script: { name: 'Sunday', lines: ['One', 'Two'] } });
  });

  it('keeps blank lines and reads Windows and old-Mac line endings', async () => {
    const result = await importDocument(strToU8('A\r\n\r\nB\rC'), 'x.txt');
    expect(result).toMatchObject({ ok: true, script: { lines: ['A', '', 'B', 'C'] } });
  });

  it('strips a UTF-8 byte order mark', async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8('Grace é')]);
    expect(await importDocument(bytes, 'x.txt')).toMatchObject({
      ok: true,
      script: { lines: ['Grace é'] },
    });
  });

  it('reads UTF-16 with a byte order mark, either byte order', async () => {
    const le = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x0a, 0x00, 0x42, 0x00]);
    const be = new Uint8Array([0xfe, 0xff, 0x00, 0x41, 0x00, 0x0a, 0x00, 0x42]);
    for (const bytes of [le, be])
      expect(await importDocument(bytes, 'x.txt')).toMatchObject({
        ok: true,
        script: { lines: ['A', 'B'] },
      });
  });

  it('refuses bytes that are not valid text', async () => {
    const result = await importDocument(new Uint8Array([0x41, 0xff, 0xfe, 0x00, 0x80]), 'x.txt');
    expect(result).toEqual({ ok: false, message: '"x.txt" is not readable text.' });
  });

  it('refuses a file with no text', async () => {
    expect(await importDocument(strToU8('  \n\n'), 'x.txt')).toEqual({
      ok: false,
      message: '"x.txt" has no text to import.',
    });
  });
});
