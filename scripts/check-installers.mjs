// Verifies the installers produced by `npm run dist:*` exist and are non-trivial.
// Usage: node scripts/check-installers.mjs [mac] [win]   (default: both)
import { readdirSync, readFileSync, statSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
// What `npm run dist:*` writes (see `artifactName` in electron-builder.yml).
const expected = {
  mac: [`NeoPrompter-${version}-mac-arm64.dmg`, `NeoPrompter-${version}-mac-x64.dmg`],
  win: [`NeoPrompter-Setup-${version}-win-x64.exe`],
};
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ['mac', 'win'];
let files = [];
try {
  files = readdirSync('release');
} catch {
  // no release/ yet
}
let failed = false;
for (const target of wanted) {
  for (const name of expected[target] ?? []) {
    const size = files.includes(name) ? statSync(`release/${name}`).size : 0;
    if (size < 10_000_000) {
      console.error(`MISSING or too small: ${target} installer release/${name}`);
      failed = true;
    } else {
      console.log(`ok ${target}: release/${name} (${(size / 1e6).toFixed(0)} MB)`);
    }
  }
}
process.exit(failed ? 1 : 0);
