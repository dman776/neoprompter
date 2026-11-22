// Bundles main/preload (node, CJS) and each renderer (browser, IIFE) into dist/.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });

const common = { bundle: true, sourcemap: true, logLevel: 'info' };

await build({
  ...common,
  entryPoints: ['src/main/main.ts', 'src/main/preload.ts'],
  outdir: 'dist/main',
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
});

for (const page of ['operator', 'output']) {
  mkdirSync(`dist/${page}`, { recursive: true });
  await build({
    ...common,
    entryPoints: [`src/${page}/${page}.ts`],
    outfile: `dist/${page}/${page}.js`,
    platform: 'browser',
    format: 'iife',
  });
  cpSync(`src/${page}/index.html`, `dist/${page}/index.html`);
}
