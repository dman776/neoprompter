// Verifies the installers produced by `npm run dist:*` exist and are non-trivial.
// Usage: node scripts/check-installers.mjs [mac] [win]   (default: both)
import { readdirSync, statSync } from 'node:fs';

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ['mac', 'win'];
const ext = { mac: '.dmg', win: '.exe' };
let files = [];
try {
  files = readdirSync('release');
} catch {
  // no release/ yet
}
let failed = false;
for (const target of wanted) {
  const hit = files.find((f) => f.endsWith(ext[target]));
  const size = hit ? statSync(`release/${hit}`).size : 0;
  if (size < 10_000_000) {
    console.error(`MISSING or too small: ${target} installer (${ext[target]}) in release/`);
    failed = true;
  } else {
    console.log(`ok ${target}: release/${hit} (${(size / 1e6).toFixed(0)} MB)`);
  }
}
process.exit(failed ? 1 : 0);
