// Bundles main/preload (node, CJS) and each renderer (browser, IIFE) into dist/.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';

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

// Every src/<name>/ with an index.html is a renderer page, bundled from src/<name>/<name>.ts.
const pages = readdirSync('src').filter((name) => existsSync(`src/${name}/index.html`));

for (const page of pages) {
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
