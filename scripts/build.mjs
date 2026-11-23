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

// Every src/<name>/ with an index.html is a renderer page, bundled from src/<name>/<name>.ts, or
// from <name>.tsx for a React page (its CSS imports come out as <name>.css next to the script).
const pages = readdirSync('src').filter((name) => existsSync(`src/${name}/index.html`));

for (const page of pages) {
  mkdirSync(`dist/${page}`, { recursive: true });
  const entry = existsSync(`src/${page}/${page}.tsx`) ? `${page}.tsx` : `${page}.ts`;
  await build({
    ...common,
    entryPoints: [`src/${page}/${entry}`],
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: `dist/${page}/${page}.js`,
    platform: 'browser',
    format: 'iife',
  });
  cpSync(`src/${page}/index.html`, `dist/${page}/index.html`);
}
