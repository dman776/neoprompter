// Builds the app icons in build/ from build/icon.svg. macOS only (it uses rsvg-convert and
// iconutil); the results are committed, so this only runs when the drawing changes:
//   brew install librsvg && node scripts/make-icon.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const svg = 'build/icon.svg';
const render = (source, size, out) =>
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), source, '-o', out]);

const work = mkdtempSync(join(tmpdir(), 'neoprompter-icon-'));
try {
  // macOS: the full 1024 canvas, with the margin and shadow of the system icon grid.
  const set = join(work, 'icon.iconset');
  mkdirSync(set);
  for (const size of [16, 32, 128, 256, 512]) {
    render(svg, size, join(set, `icon_${size}x${size}.png`));
    render(svg, size * 2, join(set, `icon_${size}x${size}@2x.png`));
  }
  execFileSync('iconutil', ['-c', 'icns', set, '-o', 'build/icon.icns']);
  render(svg, 1024, 'build/icon.png');

  // Windows: a multi-size .ico of PNGs, cropped to the tile (no transparent margin or shadow),
  // so it does not look small next to other icons.
  const tile = join(work, 'tile.svg');
  writeFileSync(
    tile,
    readFileSync(svg, 'utf8').replace('viewBox="0 0 1024 1024"', 'viewBox="100 100 824 824"'),
  );
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = sizes.map((size) => {
    const file = join(work, `win-${size}.png`);
    render(tile, size, file);
    return { size, data: readFileSync(file) };
  });
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e[0] = size === 256 ? 0 : size;
    e[1] = size === 256 ? 0 : size;
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  writeFileSync('build/icon.ico', Buffer.concat([head, ...entries, ...images.map((i) => i.data)]));
} finally {
  rmSync(work, { recursive: true, force: true });
}
